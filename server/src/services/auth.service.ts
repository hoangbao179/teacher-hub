import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { LoginResponse } from "@teacher/shared";
import { config } from "../config/config";
import { AppError } from "../errors/app-error";
import { UserRepository } from "../repositories/user.repository";

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await this.users.findByUsername(username.trim().toLowerCase());
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Tên đăng nhập hoặc mật khẩu không đúng.",
      );
    }
    const authUser = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    const token = jwt.sign(authUser, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"],
    });
    await this.users.touchLogin(user.id);
    return { token, user: authUser };
  }

  async me(userId: number): Promise<LoginResponse["user"]> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== "ACTIVE") {
      throw new AppError(401, "INVALID_TOKEN", "Phiên đăng nhập không còn hợp lệ.");
    }
    return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
  }
}
