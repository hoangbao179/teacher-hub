import bcrypt from "bcryptjs";
import type { Pool } from "mysql2/promise";
import { assertAdminPassword, assertPasswordConfirmation } from "../auth/password-policy";
import { config } from "../config/config";
import { clearLoginFailuresForUsername } from "../middleware/login-rate-limit";
import { AdminUserRepository } from "../repositories/admin-user.repository";
import { AuditRepository } from "../repositories/audit.repository";

export class AdminPasswordNotFoundError extends Error {
  constructor(username: string) {
    super(`Không tìm thấy admin với username: ${username}`);
  }
}

export interface AdminPasswordResetResult {
  userId: number;
  username: string;
  clearedLoginEntries: number;
}

export class AdminPasswordService {
  constructor(
    private readonly database: Pool,
    private readonly users = new AdminUserRepository(),
    private readonly audit = new AuditRepository(),
    private readonly clearFailures: (username: string) => number = clearLoginFailuresForUsername,
  ) {}

  async resetPassword(
    rawUsername: string,
    password: string,
    confirmation: string,
  ): Promise<AdminPasswordResetResult> {
    const username = rawUsername.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
      throw new Error("Username phải dài 3–64 ký tự và chỉ gồm a-z, 0-9, dấu chấm, gạch dưới hoặc gạch ngang.");
    }
    assertAdminPassword(password, config.auth.adminPasswordMinLength);
    assertPasswordConfirmation(password, confirmation);

    const passwordHash = await bcrypt.hash(password, 12);
    const connection = await this.database.getConnection();
    let userId: number;
    try {
      await connection.beginTransaction();
      const user = await this.users.findByUsernameForUpdate(connection, username);
      if (!user) throw new AdminPasswordNotFoundError(username);
      userId = user.id;
      await this.users.updatePasswordHash(connection, user.id, passwordHash);
      await this.audit.record(connection, {
        actorUserId: user.id,
        action: "ADMIN_PASSWORD_RESET",
        entityType: "USER",
        entityId: user.id,
        newValues: { passwordReset: true },
        reason: "Admin password reset command",
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      userId,
      username,
      clearedLoginEntries: this.clearFailures(username),
    };
  }
}
