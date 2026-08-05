const HO_CHI_MINH_UTC_OFFSET = "+07:00";

export function todayInHoChiMinh(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function millisecondsUntilNextHoChiMinhDay(now: Date = new Date(), bufferMs = 1_000): number {
  const nextDate = addDays(todayInHoChiMinh(now), 1);
  const nextMidnight = new Date(`${nextDate}T00:00:00${HO_CHI_MINH_UTC_OFFSET}`).getTime();
  return Math.max(0, nextMidnight - now.getTime() + bufferMs);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const weekday = value.getUTCDay() || 7;
  return addDays(date, 1 - weekday);
}

export function displayDate(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })
    .format(new Date(`${date}T00:00:00Z`));
}

export function displayDashboardDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const weekday = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][value.getUTCDay()];
  return `${weekday}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
