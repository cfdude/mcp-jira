/**
 * Normalize incoming date strings to ISO-8601 format (UTC).
 * Accepts full ISO strings or date-only values (YYYY-MM-DD)
 * and returns a standardized string suitable for Jira APIs.
 */
export function normalizeIsoDate(value?: string): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const candidate = isDateOnly ? `${trimmed}T00:00:00.000Z` : trimmed;

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date.toISOString();
}

export function assertStartBeforeEnd(startDate?: string, endDate?: string, context?: string) {
  if (!startDate || !endDate) return;

  const startTime = Date.parse(startDate);
  const endTime = Date.parse(endDate);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return;
  }

  if (startTime > endTime) {
    throw new Error(
      `${context ?? 'start/end dates'} invalid: start (${startDate}) must be before end (${endDate})`
    );
  }
}
