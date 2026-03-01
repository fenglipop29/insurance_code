import { z } from 'zod';

export const redeemBodySchema = z.object({
  itemId: z.coerce.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
});
