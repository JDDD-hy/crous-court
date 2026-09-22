export function todayInParis(now = new Date()) {
  return todayInTimezone("Europe/Paris", now);
}

export function todayInTimezone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const venueTimezones = ["Europe/Paris", "America/Guadeloupe", "America/Martinique", "America/Cayenne", "Indian/Reunion", "Indian/Mayotte"] as const;
export function courtDateRanges(now = new Date()) {
  return venueTimezones.map(zone => {
    const today = todayInTimezone(zone, now);
    const previous = new Date(`${today}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return { zone, today, yesterday: previous.toISOString().slice(0, 10) };
  });
}

export function todayAndYesterdayInParis(now = new Date()) {
  const today = todayInParis(now);
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return [today, yesterday.toISOString().slice(0, 10)];
}
