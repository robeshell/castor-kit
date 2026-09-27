/** Calendar heatmap point: [YYYY-MM-DD, activity] */
export type CalendarPoint = [date: string, value: number]

/** YYYY-MM-DD of a date in local time (toISOString would give the UTC day, off by one around midnight) */
export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Simulated activity for the past year up to `now` (one point per local day), lower on weekends */
export function generateCalendarData(now: Date = new Date(), random: () => number = Math.random): CalendarPoint[] {
  const data: CalendarPoint[] = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    // Label and weekday both come from the local date
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const base = isWeekend ? 2 : 8
    const value = random() < 0.25 ? 0 : Math.floor(random() * base + random() * 10)
    data.push([localDateKey(d), value])
  }
  return data
}
