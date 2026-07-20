import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: "TEACHER";
  status: "ACTIVE" | "DISABLED";
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return rows[0] ?? null;
  }

  async touchLogin(id: number): Promise<void> {
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
      id,
    ]);
  }
}
