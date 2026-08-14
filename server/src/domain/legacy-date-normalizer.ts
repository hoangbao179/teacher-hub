import type { LegacyDateResolution } from "@teacher/shared";

export interface LegacyDateInput {
  raw: unknown;
  display: string;
}

export interface NormalizedLegacyDate {
  originalDate: string;
  normalizedDate: string | null;
  resolution: LegacyDateResolution;
}

interface DateParts { day: number; month: number; year: number | null }

const monthNames: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function partsFromValue(value: unknown, display: string): DateParts | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return { day: value.getUTCDate(), month: value.getUTCMonth() + 1, year: value.getUTCFullYear() };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
  }
  const isoMatch = display.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (isoMatch) return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  const namedMatch = display.trim().toLowerCase().match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (namedMatch && monthNames[namedMatch[1]]) {
    return { year: null, month: monthNames[namedMatch[1]], day: Number(namedMatch[2]) };
  }
  const match = display.trim().match(/(?:^|\D)(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\s*[./-]\s*(\d{2,4}))?(?:\D|$)/);
  if (!match) return null;
  const shortYear = match[3] ? Number(match[3]) : null;
  return {
    day: Number(match[1]), month: Number(match[2]),
    year: shortYear == null ? null : shortYear < 100 ? 2000 + shortYear : shortYear,
  };
}

export class LegacyDateNormalizer {
  normalize(inputs: LegacyDateInput[], tuitionReferenceDates: string[]): NormalizedLegacyDate[] {
    const references = [...new Set(tuitionReferenceDates)].sort();
    const parsed = inputs.map((input) => partsFromValue(input.raw, input.display));
    const offsets: number[] = [];
    let offset = 0;
    let previousMonth: number | null = null;
    for (const part of parsed) {
      if (part && previousMonth != null && previousMonth - part.month >= 6) offset += 1;
      offsets.push(offset);
      if (part) previousMonth = part.month;
    }

    const baseYearVotes = new Map<number, number>();
    parsed.forEach((part, index) => {
      if (!part) return;
      if (part.year != null) {
        const base = part.year - offsets[index];
        baseYearVotes.set(base, (baseYearVotes.get(base) ?? 0) + 4);
        return;
      }
      for (const reference of references) {
        if (Number(reference.slice(5, 7)) === part.month && Number(reference.slice(8, 10)) === part.day) {
          const base = Number(reference.slice(0, 4)) - offsets[index];
          baseYearVotes.set(base, (baseYearVotes.get(base) ?? 0) + 1);
        }
      }
    });
    const baseYear = [...baseYearVotes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0]
      ?? (references[0] ? Number(references[0].slice(0, 4)) : null);

    return inputs.map((input, index): NormalizedLegacyDate => {
      const part = parsed[index];
      if (!part) return { originalDate: input.display, normalizedDate: null, resolution: "UNRESOLVED" };
      const year = part.year ?? (baseYear == null ? null : baseYear + offsets[index]);
      const normalizedDate = year == null ? null : iso(year, part.month, part.day);
      if (!normalizedDate) return { originalDate: input.display, normalizedDate: null, resolution: "UNRESOLVED" };
      if (part.year != null) return { originalDate: input.display, normalizedDate, resolution: "EXACT" };
      return { originalDate: input.display, normalizedDate,
        resolution: references.includes(normalizedDate) ? "TUITION_REFERENCE" : "SEQUENCE_INFERENCE" };
    });
  }

  normalizeFullDate(raw: unknown, display: string): string | null {
    const parts = partsFromValue(raw, display);
    return parts?.year == null ? null : iso(parts.year, parts.month, parts.day);
  }
}
