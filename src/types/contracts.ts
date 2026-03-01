import type { CUserContract, VerifyBasicResponseContract } from '@contracts/index';

export type ApiError = {
  code?: string;
  message?: string;
};

export type UserDto = CUserContract;
export type VerifyBasicResponse = VerifyBasicResponseContract;

export type MeResponse = {
  user: CUserContract;
  balance: number;
  csrfToken?: string | null;
};

export type PointsSummaryResponse = {
  balance: number;
};
