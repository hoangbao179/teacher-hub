export const AUTH_TOKEN_KEY = "teacher-token";
const REMEMBERED_USERNAME_KEY = "teacher-remembered-username";
const LEGACY_REMEMBERED_EMAIL_KEY = "teacher-remembered-email";
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

export function getRememberedUsername(): string {
  return localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? "";
}

export function saveRememberedUsername(username: string): void {
  localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
  localStorage.removeItem(LEGACY_REMEMBERED_EMAIL_KEY);
}

export function clearRememberedUsername(): void {
  localStorage.removeItem(REMEMBERED_USERNAME_KEY);
  localStorage.removeItem(LEGACY_REMEMBERED_EMAIL_KEY);
}

export function getRememberPreference(): boolean {
  return localStorage.getItem(REMEMBER_PREFERENCE_KEY) !== "false";
}

export function saveRememberPreference(remember: boolean): void {
  localStorage.setItem(REMEMBER_PREFERENCE_KEY, String(remember));
}
