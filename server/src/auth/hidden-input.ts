import { emitKeypressEvents } from "node:readline";

export async function readHiddenInput(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error("Không có terminal tương tác; dùng biến môi trường ADMIN_RESET_* cho automation.");
  }

  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const stdin = process.stdin;
    const stdout = process.stdout;
    const wasRaw = stdin.isRaw;

    function cleanup(): void {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode?.(Boolean(wasRaw));
      stdin.pause();
    }

    function onKeypress(character: string, key: { name?: string; ctrl?: boolean }): void {
      if (key.ctrl && key.name === "c") {
        cleanup();
        stdout.write("\n");
        reject(new Error("Đã hủy thao tác reset password."));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (character && !key.ctrl) value += character;
    }

    stdout.write(prompt);
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", onKeypress);
  });
}
