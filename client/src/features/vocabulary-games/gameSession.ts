const prefix = "teacherHub:vocabulary-session:";

interface StoredGameSession { publicCode: string; sessionToken: string; expiresAt: string }

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function saveGameSession(value: StoredGameSession, target: Storage | null = storage()): void {
  if (!target) return;
  target.setItem(`${prefix}${value.publicCode}`, JSON.stringify(value));
  target.setItem(`${prefix}token:${value.sessionToken}`, value.publicCode);
}

export function loadGameSession(publicCode: string, target: Storage | null = storage()): StoredGameSession | null {
  if (!target) return null;
  try {
    const value = JSON.parse(target.getItem(`${prefix}${publicCode}`) ?? "null") as StoredGameSession | null;
    if (!value || value.publicCode !== publicCode || new Date(value.expiresAt).getTime() <= Date.now()) {
      if (value?.sessionToken) target.removeItem(`${prefix}token:${value.sessionToken}`);
      target.removeItem(`${prefix}${publicCode}`);
      return null;
    }
    return value;
  } catch {
    target.removeItem(`${prefix}${publicCode}`);
    return null;
  }
}

export function clearGameSession(sessionToken: string, target: Storage | null = storage()): void {
  if (!target) return;
  const code = target.getItem(`${prefix}token:${sessionToken}`);
  if (code) target.removeItem(`${prefix}${code}`);
  target.removeItem(`${prefix}token:${sessionToken}`);
}
