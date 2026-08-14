const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatAdminDateTime(value: Date | null | undefined): string {
  if (!value) return "never";
  return dateTimeFormatter.format(value);
}

export function formatAdminDate(value: Date | null | undefined): string {
  if (!value) return "–";
  return dateFormatter.format(value);
}
