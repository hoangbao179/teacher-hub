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

function dateDistance(left: string, right: string): number {
  return Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;
}

export class LegacyDateNormalizer {
  normalize(inputs: LegacyDateInput[], tuitionReferenceDates: string[]): NormalizedLegacyDate[] {
    const references = [...new Set(tuitionReferenceDates)].sort();
    const years = [...new Set(references.map((value) => Number(value.slice(0, 4))))];
    const parsed = inputs.map((input) => partsFromValue(input.raw, input.display));
    const results: NormalizedLegacyDate[] = inputs.map((input, index) => {
      const value = parsed[index];
      if (!value) return { originalDate: input.display, normalizedDate: null, resolution: "UNRESOLVED" };
      if (value.year != null) {
        const normalizedDate = iso(value.year, value.month, value.day);
        return { originalDate: input.display, normalizedDate, resolution: normalizedDate ? "EXACT" : "UNRESOLVED" };
      }
      const exactReferences = references.filter((reference) =>
        Number(reference.slice(5, 7)) === value.month && Number(reference.slice(8, 10)) === value.day);
      if (exactReferences.length === 1) {
        return { originalDate: input.display, normalizedDate: exactReferences[0], resolution: "TUITION_REFERENCE" };
      }
      return { originalDate: input.display, normalizedDate: null, resolution: "UNRESOLVED" };
    });

    const resolvedIndexes = () => results.map((item, index) => item.normalizedDate ? index : -1).filter((index) => index >= 0);
    let changed = true;
    while (changed) {
      changed = false;
      for (let index = 0; index < results.length; index += 1) {
        if (results[index].normalizedDate || !parsed[index] || parsed[index]!.year != null || years.length === 0) continue;
        const indexes = resolvedIndexes();
        const nearest = indexes.sort((a, b) => Math.abs(a - index) - Math.abs(b - index))[0];
        if (nearest == null) continue;
        const part = parsed[index]!;
        const candidateYears = [...new Set(years.flatMap((year) => [year - 1, year, year + 1]))];
        const candidates = candidateYears.map((year) => iso(year, part.month, part.day)).filter((item): item is string => Boolean(item));
        if (!candidates.length) continue;
        const anchor = results[nearest].normalizedDate!;
        results[index] = {
          originalDate: inputs[index].display,
          normalizedDate: candidates.sort((a, b) => dateDistance(a, anchor) - dateDistance(b, anchor))[0],
          resolution: "SEQUENCE_INFERENCE",
        };
        changed = true;
      }
    }
    return results;
  }

  normalizeFullDate(raw: unknown, display: string): string | null {
    const parts = partsFromValue(raw, display);
    return parts?.year == null ? null : iso(parts.year, parts.month, parts.day);
  }
}
