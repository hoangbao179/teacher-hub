import assert from "node:assert/strict";
import test from "node:test";
import { resolveStudentReportSettings } from "./student-report-settings";

test("student report account number is optional and accepts bank digits", () => {
  assert.deepEqual(resolveStudentReportSettings({}), { vietinBankAccountNumber: "" });
  assert.deepEqual(resolveStudentReportSettings({ REPORT_VIETINBANK_ACCOUNT_NUMBER: " 123456789012 " }), {
    vietinBankAccountNumber: "123456789012",
  });
});

test("student report account number rejects unsafe or malformed values", () => {
  for (const value of ["123", "1234 5678", "1234-5678", "=12345678"])
    assert.throws(
      () => resolveStudentReportSettings({ REPORT_VIETINBANK_ACCOUNT_NUMBER: value }),
      /must contain 8 to 20 digits/,
    );
});
