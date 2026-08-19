export interface SafeUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  createdAt: Date;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}
