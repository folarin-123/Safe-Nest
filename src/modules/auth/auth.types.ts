export interface SafeUser {
  id: string;
  email: string;
  phone: string;
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
