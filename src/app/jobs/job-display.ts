export function formatRelativeTime(date: Date | string | null, now = new Date()): string {
  if (!date) return "Unknown";
  const target = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.floor((now.getTime() - target.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
    year: "numeric",
  });
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null,
): string | null {
  if (min === null && max === null) return null;
  const symbol = currency ?? "£";
  const format = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
  let range: string;
  if (min !== null && max !== null) {
    range = `${symbol}${format(min)} – ${symbol}${format(max)}`;
  } else if (min !== null) {
    range = `From ${symbol}${format(min)}`;
  } else if (max !== null) {
    range = `Up to ${symbol}${format(max)}`;
  } else {
    return null;
  }
  return period && period !== "unknown" ? `${range} per ${period}` : range;
}

export function freshSourceLabel(lastSuccessfulCheckAt: Date | string | null): string | null {
  if (!lastSuccessfulCheckAt) return null;
  const hours = (Date.now() - new Date(lastSuccessfulCheckAt).getTime()) / 3_600_000;
  if (hours < 0) return null;
  if (hours < 24) return "Verified from employer careers site today";
  if (hours < 48) return "Verified from employer careers site yesterday";
  if (hours < 24 * 7)
    return `Verified from employer careers site ${Math.floor(hours / 24)} days ago`;
  return `Last source check ${Math.floor(hours / 24)} days ago`;
}

export function isDeadlinePassed(deadline: Date | string | null, now = new Date()): boolean {
  if (!deadline) return false;
  return londonCalendarDay(new Date(deadline)) < londonCalendarDay(now);
}

function londonCalendarDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/London",
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}
