import { addDays, format } from "date-fns";

export function addDaysToIsoDate(value: string | Date, days: number): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return addDays(date, days).toISOString();
}

export function isDatePastOrNow(value?: string): boolean {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() <= Date.now();
}

export function formatLetterArrival(value?: string): string {
  if (!value) {
    return "Soon";
  }

  return format(new Date(value), "MMMM d, yyyy");
}

export function nowIso(): string {
  return new Date().toISOString();
}

