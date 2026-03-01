import { z } from 'zod';

export const redemptionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const writeoffBodySchema = z.object({
  token: z.string().trim().min(1).max(120).optional(),
});

