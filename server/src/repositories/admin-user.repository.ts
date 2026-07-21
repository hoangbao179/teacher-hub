import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export interface AdminPasswordUserRow extends RowDataPacket {
  id: number;
  username: string;
  status: "ACTIVE" | "DISABLED";
}

export class AdminUserRepository {
  async findByUsernameForUpdate(
    connection: PoolConnection,
    username: string,
  ): Promise<AdminPasswordUserRow | null> {
    const [rows] = await connection.query<AdminPasswordUserRow[]>(
      "SELECT id, username, status FROM users WHERE username = ? LIMIT 1 FOR UPDATE",
      [username],
    );
    return rows[0] ?? null;
  }

  async updatePasswordHash(
    connection: PoolConnection,
    userId: number,
    passwordHash: string,
  ): Promise<void> {
    await connection.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, userId],
    );
  }
}
