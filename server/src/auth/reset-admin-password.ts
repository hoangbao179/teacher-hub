import "dotenv/config";
import { pool } from "../db/pool";
import { AdminPasswordService } from "../services/admin-password.service";
import { readHiddenInput } from "./hidden-input";

const ADMIN_USERNAME = "covy";

async function credentials(): Promise<{ username: string; password: string; confirmation: string }> {
  const automatedPassword = process.env.ADMIN_RESET_PASSWORD;
  const automatedConfirmation = process.env.ADMIN_RESET_PASSWORD_CONFIRMATION;

  if (automatedPassword !== undefined || automatedConfirmation !== undefined) {
    if (automatedPassword === undefined || automatedConfirmation === undefined) {
      throw new Error("Automation yêu cầu đủ ADMIN_RESET_PASSWORD và ADMIN_RESET_PASSWORD_CONFIRMATION.");
    }
    return { username: ADMIN_USERNAME, password: automatedPassword, confirmation: automatedConfirmation };
  }

  const password = await readHiddenInput("Mật khẩu mới: ");
  const confirmation = await readHiddenInput("Nhập lại mật khẩu mới: ");
  return { username: ADMIN_USERNAME, password, confirmation };
}

async function main(): Promise<void> {
  try {
    const requested = await credentials();
    const result = await new AdminPasswordService(pool).resetPassword(
      requested.username,
      requested.password,
      requested.confirmation,
    );
    console.log(`Đã đổi mật khẩu cho admin: ${result.username}`);
    if (result.clearedLoginEntries > 0) {
      console.log(`Đã xóa ${result.clearedLoginEntries} mục giới hạn đăng nhập trong tiến trình hiện tại.`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể đổi mật khẩu admin.");
  process.exitCode = 1;
});
