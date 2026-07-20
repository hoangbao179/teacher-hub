import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./pool";

async function bootstrap(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? "Cô giáo";

  if (!email || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD là bắt buộc.",
    );
  }
  if (password.length < 10)
    throw new Error("Password bootstrap phải có ít nhất 10 ký tự.");

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users(email, password_hash, display_name, role, status)
     VALUES (?, ?, ?, 'TEACHER', 'ACTIVE')
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash), status = 'ACTIVE'`,
    [email.toLowerCase(), passwordHash, displayName],
  );
  console.log(`Admin ready: ${email}`);
  await pool.end();
}

void bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
