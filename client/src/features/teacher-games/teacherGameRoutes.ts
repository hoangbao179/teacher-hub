/** Explicitly accessible teacher game routes while the old Admin UI is disabled.
 * Always render these beneath the existing authenticated <Protected> boundary. */
export const isTeacherGamesPath = (pathname: string): boolean =>
  /^\/admin\/games(?:\/new|\/[1-9]\d*\/edit)?$/.test(pathname);
