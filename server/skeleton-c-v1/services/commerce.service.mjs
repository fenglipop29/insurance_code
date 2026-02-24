import {
  appendAuditLog,
  appendDomainEvent,
  generateWriteoffToken,
  getBalance,
  getState,
  nextId,
  persistState,
  withIdempotency,
} from '../common/state.mjs';
import { recordPoints } from './points.service.mjs';

function ensureCommerceArrays(state) {
  if (!Array.isArray(state.orders)) state.orders = [];
  if (!Array.isArray(state.orderPayments)) state.orderPayments = [];
  if (!Array.isArray(state.orderFulfillments)) state.orderFulfillments = [];
  if (!Array.isArray(state.orderRefunds)) state.orderRefunds = [];
  if (!Array.isArray(state.redemptions)) state.redemptions = [];
  if (!Array.isArray(state.bWriteOffRecords)) state.bWriteOffRecords = [];
}

function findActiveProduct(state, productId) {
  const pid = Number(productId);
  return (state.mallItems || []).find((row) => Number(row.id) === pid && Boolean(row.isActive));
}

export function createOrder({ tenantId = 1, customerId, productId, quantity = 1, idempotencyKey, actor }) {
  const state = getState();
  ensureCommerceArrays(state);

  const product = findActiveProduct(state, productId);
  if (!product) throw new Error('ITEM_NOT_FOUND');
  if (Number(quantity) <= 0) throw new Error('INVALID_QUANTITY');
  if (Number(product.stock) < Number(quantity)) throw new Error('OUT_OF_STOCK');

  const key = idempotencyKey || `order-create:${tenantId}:${customerId}:${productId}:${quantity}`;
  const idempotent = withIdempotency({
    tenantId,
    bizType: 'order.create',
    bizKey: key,
    execute: () => {
      const order = {
        id: nextId(state.orders),
        tenantId: Number(tenantId),
        customerId: Number(customerId),
        productId: Number(product.id),
        productName: product.name,
        quantity: Number(quantity),
        pointsAmount: Number(product.pointsCost) * Number(quantity),
        status: 'created',
        paymentStatus: 'pending',
        fulfillmentStatus: 'pending',
        refundStatus: 'none',
        orderNo: `OD${Date.now()}${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.orders.push(order);
      appendDomainEvent('order.created', { orderId: order.id, tenantId: order.tenantId, customerId: order.customerId }, { tenantId });
      appendAuditLog({
        tenantId,
        actorType: actor?.actorType || 'customer',
        actorId: Number(actor?.actorId || customerId),
        action: 'order.create',
        resourceType: 'order',
        resourceId: String(order.id),
        result: 'success',
      });
      return order;
    },
  });

  persistState();
  return { order: idempotent.value, idempotent: idempotent.hit };
}

export function payOrderWithPoints({ tenantId = 1, orderId, customerId, idempotencyKey, actor }) {
  const state = getState();
  ensureCommerceArrays(state);

  const order = state.orders.find((row) => Number(row.id) === Number(orderId));
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (Number(order.customerId) !== Number(customerId)) throw new Error('ORDER_FORBIDDEN');
  if (order.paymentStatus === 'paid') return { order, idempotent: true };

  const key = idempotencyKey || `order-pay:${tenantId}:${orderId}`;
  const idempotent = withIdempotency({
    tenantId,
    bizType: 'order.pay',
    bizKey: key,
    execute: () => {
      const product = findActiveProduct(state, order.productId);
      if (!product) throw new Error('ITEM_NOT_FOUND');
      if (Number(product.stock) < Number(order.quantity)) throw new Error('OUT_OF_STOCK');
      const balance = getBalance(customerId);
      if (balance < Number(order.pointsAmount)) throw new Error('INSUFFICIENT_POINTS');

      product.stock -= Number(order.quantity);
      order.status = 'paid';
      order.paymentStatus = 'paid';
      order.updatedAt = new Date().toISOString();

      recordPoints({
        userId: Number(customerId),
        direction: 'out',
        amount: Number(order.pointsAmount),
        sourceType: 'order_pay',
        sourceId: String(order.id),
        idempotencyKey: `points-order-pay:${tenantId}:${order.id}`,
        description: `订单支付 ${order.orderNo}`,
      });

      state.orderPayments.push({
        id: nextId(state.orderPayments),
        tenantId: Number(tenantId),
        orderId: Number(order.id),
        paymentMethod: 'points',
        paymentStatus: 'paid',
        amount: Number(order.pointsAmount),
        createdAt: new Date().toISOString(),
      });

      const redemption = {
        id: nextId(state.redemptions),
        orderId: Number(order.id),
        userId: Number(customerId),
        itemId: Number(order.productId),
        pointsCost: Number(order.pointsAmount),
        status: 'pending',
        writeoffToken: generateWriteoffToken(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        writtenOffAt: null,
      };
      state.redemptions.push(redemption);

      appendDomainEvent(
        'order.paid',
        { orderId: order.id, customerId: order.customerId, points: order.pointsAmount, productId: order.productId },
        { tenantId }
      );
      appendDomainEvent('inventory.decremented', { productId: order.productId, quantity: order.quantity, orderId: order.id }, { tenantId });
      appendAuditLog({
        tenantId,
        actorType: actor?.actorType || 'customer',
        actorId: Number(actor?.actorId || customerId),
        action: 'order.pay',
        resourceType: 'order',
        resourceId: String(order.id),
        result: 'success',
      });
      return { order, redemption };
    },
  });

  persistState();
  const value = idempotent.value;
  return { order: value.order || value, redemption: value.redemption || null, idempotent: idempotent.hit };
}

export function cancelOrder({ tenantId = 1, orderId, customerId, reason = '', actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const order = state.orders.find((row) => Number(row.id) === Number(orderId));
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (Number(order.customerId) !== Number(customerId)) throw new Error('ORDER_FORBIDDEN');
  if (order.fulfillmentStatus === 'written_off' || order.fulfillmentStatus === 'shipped') throw new Error('ORDER_ALREADY_FULFILLED');
  if (order.status === 'cancelled') return { order, idempotent: true };

  if (order.paymentStatus === 'paid' && order.refundStatus !== 'refunded') {
    recordPoints({
      userId: Number(customerId),
      direction: 'in',
      amount: Number(order.pointsAmount),
      sourceType: 'order_cancel_refund',
      sourceId: String(order.id),
      idempotencyKey: `points-order-cancel-refund:${tenantId}:${order.id}`,
      description: `取消订单返还 ${order.orderNo}`,
    });

    const product = findActiveProduct(state, order.productId);
    if (product) product.stock += Number(order.quantity);
    order.refundStatus = 'refunded';
  }

  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  state.orderRefunds.push({
    id: nextId(state.orderRefunds),
    tenantId: Number(tenantId),
    orderId: Number(order.id),
    refundType: 'cancel',
    status: 'success',
    reason,
    createdAt: new Date().toISOString(),
  });
  appendDomainEvent('order.cancelled', { orderId: order.id, reason }, { tenantId });
  appendAuditLog({
    tenantId,
    actorType: actor?.actorType || 'customer',
    actorId: Number(actor?.actorId || customerId),
    action: 'order.cancel',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
  });

  persistState();
  return { order, idempotent: false };
}

export function fulfillOrderWriteoff({ tenantId = 1, orderId, operatorAgentId, token, actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const order = state.orders.find((row) => Number(row.id) === Number(orderId));
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.paymentStatus !== 'paid') throw new Error('ORDER_NOT_PAID');
  if (order.fulfillmentStatus === 'written_off') return { order, idempotent: true };

  const redemption = state.redemptions.find((row) => Number(row.orderId) === Number(order.id));
  if (!redemption) throw new Error('REDEMPTION_NOT_FOUND');
  if (token && token !== redemption.writeoffToken) throw new Error('INVALID_TOKEN');
  if (new Date(redemption.expiresAt).getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  redemption.status = 'written_off';
  redemption.writtenOffAt = new Date().toISOString();
  order.fulfillmentStatus = 'written_off';
  order.status = 'fulfilled';
  order.updatedAt = new Date().toISOString();

  state.orderFulfillments.push({
    id: nextId(state.orderFulfillments),
    tenantId: Number(tenantId),
    orderId: Number(order.id),
    mode: 'writeoff',
    operatorAgentId: Number(operatorAgentId),
    createdAt: new Date().toISOString(),
  });
  state.bWriteOffRecords.push({
    id: nextId(state.bWriteOffRecords),
    tenantId: Number(tenantId),
    redeemRecordId: Number(redemption.id),
    operatorAgentId: Number(operatorAgentId),
    writeoffToken: redemption.writeoffToken,
    status: 'success',
    createdAt: new Date().toISOString(),
  });
  appendDomainEvent('order.written_off', { orderId: order.id, redemptionId: redemption.id }, { tenantId });
  appendAuditLog({
    tenantId,
    actorType: actor?.actorType || 'agent',
    actorId: Number(actor?.actorId || operatorAgentId),
    action: 'order.writeoff',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
  });

  persistState();
  return { order, redemption, idempotent: false };
}

export function refundOrder({ tenantId = 1, orderId, operatorId, reason = 'manual_refund', actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const order = state.orders.find((row) => Number(row.id) === Number(orderId));
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.paymentStatus !== 'paid') throw new Error('ORDER_NOT_PAID');
  if (order.refundStatus === 'refunded') return { order, idempotent: true };
  if (order.fulfillmentStatus === 'written_off' || order.fulfillmentStatus === 'shipped') {
    throw new Error('ORDER_ALREADY_FULFILLED');
  }

  recordPoints({
    userId: Number(order.customerId),
    direction: 'in',
    amount: Number(order.pointsAmount),
    sourceType: 'order_refund',
    sourceId: String(order.id),
    idempotencyKey: `points-order-refund:${tenantId}:${order.id}`,
    description: `订单退款返还 ${order.orderNo}`,
  });
  const product = findActiveProduct(state, order.productId);
  if (product) product.stock += Number(order.quantity);

  order.refundStatus = 'refunded';
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  state.orderRefunds.push({
    id: nextId(state.orderRefunds),
    tenantId: Number(tenantId),
    orderId: Number(order.id),
    refundType: 'manual',
    status: 'success',
    reason,
    createdAt: new Date().toISOString(),
  });
  appendDomainEvent('order.refunded', { orderId: order.id, reason }, { tenantId });
  appendAuditLog({
    tenantId,
    actorType: actor?.actorType || 'employee',
    actorId: Number(actor?.actorId || operatorId),
    action: 'order.refund',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
  });

  persistState();
  return { order, idempotent: false };
}
