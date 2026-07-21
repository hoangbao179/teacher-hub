export type UserRole = "TEACHER";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
