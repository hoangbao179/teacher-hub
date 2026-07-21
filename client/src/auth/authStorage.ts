export const AUTH_TOKEN_KEY = "teacher-token";
const REMEMBERED_EMAIL_KEY = "teacher-remembered-email";
const REMEMBER_PREFERENCE_KEY = "teacher-remember-login";

/** Token lookup is deterministic: persistent local storage first, then the
 * current browser session. saveToken/clearToken guarantee only one copy. */
export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveToken(token: string, remember: boolean): void {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(AUTH_TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getRememberedEmail(): string {
  return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
}

export function saveRememberedEmail(email: string): void {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
}

export function clearRememberedEmail(): void {
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

export function getRememberPreference(): boolean {
  return localStorage.getItem(REMEMBER_PREFERENCE_KEY) !== "false";
}

export function saveRememberPreference(remember: boolean): void {
  localStorage.setItem(REMEMBER_PREFERENCE_KEY, String(remember));
}
