import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pool } from "../db/pool";
import { AdminPasswordService } from "../services/admin-password.service";
import { readHiddenInput } from "./hidden-input";

async function readUsername(defaultUsername: string): Promise<string> {
  const terminal = createInterface({ input, output });
  try {
    const entered = await terminal.question(`Username admin [${defaultUsername}]: `);
    return entered.trim() || defaultUsername;
  } finally {
    terminal.close();
  }
}

async function credentials(): Promise<{ username: string; password: string; confirmation: string }> {
  const defaultUsername = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase() || "covy";
  const automatedPassword = process.env.ADMIN_RESET_PASSWORD;
  const automatedConfirmation = process.env.ADMIN_RESET_PASSWORD_CONFIRMATION;
  const automatedUsername = process.env.ADMIN_RESET_USERNAME?.trim().toLowerCase();

  if (automatedPassword !== undefined || automatedConfirmation !== undefined || automatedUsername !== undefined) {
    if (!automatedUsername || automatedPassword === undefined || automatedConfirmation === undefined) {
      throw new Error("Automation yêu cầu đủ ADMIN_RESET_USERNAME, ADMIN_RESET_PASSWORD và ADMIN_RESET_PASSWORD_CONFIRMATION.");
    }
    return { username: automatedUsername, password: automatedPassword, confirmation: automatedConfirmation };
  }

  const username = await readUsername(defaultUsername);
  const password = await readHiddenInput("Mật khẩu mới: ");
  const confirmation = await readHiddenInput("Nhập lại mật khẩu mới: ");
  return { username, password, confirmation };
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
