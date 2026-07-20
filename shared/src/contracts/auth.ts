export type UserRole = "TEACHER";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
