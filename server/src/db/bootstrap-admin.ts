import "dotenv/config";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { assertAdminPassword } from "../auth/password-policy";
import { config } from "../config/config";
import { pool } from "./pool";

interface UserIdRow extends RowDataPacket {
  id: number;
}

async function bootstrap(): Promise<void> {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? "Cô Vy";

  if (!username || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_USERNAME và BOOTSTRAP_ADMIN_PASSWORD là bắt buộc.",
    );
  }
  if (!/^[a-z0-9._-]{3,64}$/.test(username))
    throw new Error("Username bootstrap phải dài 3–64 ký tự và chỉ gồm a-z, 0-9, dấu chấm, gạch dưới hoặc gạch ngang.");
  assertAdminPassword(password, config.auth.adminPasswordMinLength);

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [matching] = await connection.query<UserIdRow[]>(
      "SELECT id FROM users WHERE username = ? LIMIT 1 FOR UPDATE",
      [username],
    );
    let userId = matching[0]?.id;
    if (!userId) {
      const [existing] = await connection.query<UserIdRow[]>(
        "SELECT id FROM users ORDER BY id FOR UPDATE",
      );
      if (existing.length > 1)
        throw new Error("Có nhiều tài khoản hiện hữu; không thể tự chọn tài khoản để đổi username.");
      userId = existing[0]?.id;
    }

    if (userId) {
      await connection.query(
        "UPDATE users SET username = ?, password_hash = ?, display_name = ?, role = 'TEACHER', status = 'ACTIVE' WHERE id = ?",
        [username, passwordHash, displayName, userId],
      );
    } else {
      await connection.query(
        `INSERT INTO users(username, email, password_hash, display_name, role, status)
         VALUES (?, NULL, ?, ?, 'TEACHER', 'ACTIVE')`,
        [username, passwordHash, displayName],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  console.log(`Admin ready: ${username}`);
  await pool.end();
}

void bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
