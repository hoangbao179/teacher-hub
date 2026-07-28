export interface StudentReportSettings {
  vietinBankAccountNumber: string;
}

export function resolveStudentReportSettings(
  env: Record<string, string | undefined>,
): StudentReportSettings {
  const vietinBankAccountNumber = env.REPORT_VIETINBANK_ACCOUNT_NUMBER?.trim() ?? "";
  if (vietinBankAccountNumber && !/^\d{8,20}$/.test(vietinBankAccountNumber))
    throw new Error("REPORT_VIETINBANK_ACCOUNT_NUMBER must contain 8 to 20 digits");
  return { vietinBankAccountNumber };
}
