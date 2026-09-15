// Helpers to group records into weekly buckets (Monday-start) with
// friendly, non-technical headers like "This Week" / "Last Week".

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function weekKey(dateStr: string): string {
  return startOfWeek(new Date(dateStr)).toISOString().split("T")[0];
}

export function weekLabel(weekStartISO: string): string {
  const start = new Date(weekStartISO);
  const thisWeek = startOfWeek(new Date());
  const diffWeeks = Math.round((thisWeek.getTime() - start.getTime()) / (7 * 86400000));
  if (diffWeeks === 0) return "This Week";
  if (diffWeeks === 1) return "Last Week";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}

// Group items by their date field, returning ordered week buckets (newest first).
export function groupByWeek<T>(items: T[], getDate: (item: T) => string) {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = weekKey(getDate(item));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({ key, label: weekLabel(key), items: list }));
}
