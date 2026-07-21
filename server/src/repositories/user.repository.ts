import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string;
  role: "TEACHER";
  status: "ACTIVE" | "DISABLED";
}

export class UserRepository {
  async findById(id: number): Promise<UserRow | null> {
    const [rows] = await pool.query<UserRow[]>("SELECT * FROM users WHERE id=? LIMIT 1", [id]);
    return rows[0] ?? null;
  }
  async findByUsername(username: string): Promise<UserRow | null> {
    const [rows] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username],
    );
    return rows[0] ?? null;
  }

  async touchLogin(id: number): Promise<void> {
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [
      id,
    ]);
  }
}
