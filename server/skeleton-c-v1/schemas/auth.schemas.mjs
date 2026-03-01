import { z } from 'zod';

const mobileSchema = z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const nameSchema = z.string().trim().regex(/^[\u4e00-\u9fa5·]{2,20}$/, '姓名格式不正确');
const codeSchema = z.string().trim().regex(/^\d{6}$/, '验证码格式不正确');

export const sendCodeBodySchema = z.object({
  mobile: mobileSchema,
});

export const verifyBasicBodySchema = z.object({
  name: nameSchema,
  mobile: mobileSchema,
  code: codeSchema,
  tenantId: z.coerce.number().int().positive().optional(),
  tenantCode: z.string().trim().min(1).optional(),
  tenantKey: z.string().trim().min(1).optional(),
});
