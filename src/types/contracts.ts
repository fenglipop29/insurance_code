// Keep local contract types to avoid cross-repo path dependency in CI.
export type CUserContract = {
  id: number;
  name: string;
  mobile: string;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

export type VerifyBasicResponseContract = {
  token: string;
  csrfToken?: string;
  user: CUserContract;
};

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
