export interface SafeUser {
  id: string;
  email: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}