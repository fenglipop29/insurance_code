import { z } from 'zod';

export const createPolicyBodySchema = z.object({
  company: z.string().trim().min(1, '保险公司不能为空'),
  name: z.string().trim().min(1, '保单名称不能为空'),
  applicant: z.string().trim().min(1, '投保人不能为空'),
  insured: z.string().trim().min(1, '被保人不能为空'),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  paymentPeriod: z.string().trim().min(1, '缴费期不能为空'),
  coveragePeriod: z.string().trim().min(1, '保障期不能为空'),
  amount: z.coerce.number().positive('保额必须大于0'),
  firstPremium: z.coerce.number().positive('首期保费必须大于0'),
  type: z.string().trim().optional(),
});

export const policyIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
