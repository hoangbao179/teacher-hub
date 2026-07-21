export function assertAdminPassword(password: string, minimumLength: number): void {
  if (password.length < minimumLength) {
    throw new Error(`Mật khẩu admin phải có ít nhất ${minimumLength} ký tự.`);
  }
}

export function assertPasswordConfirmation(password: string, confirmation: string): void {
  if (password !== confirmation) {
    throw new Error("Mật khẩu xác nhận không khớp.");
  }
}
