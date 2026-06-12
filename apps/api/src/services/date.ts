export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function differenceInCalendarDays(later: Date, earlier: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const utcLater = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate())
  const utcEarlier = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  return Math.floor((utcLater - utcEarlier) / msPerDay)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function calendarDayRangeFromToday(daysAhead: number): { gte: Date; lte: Date } {
  const target = addDays(startOfDay(new Date()), daysAhead)
  return { gte: target, lte: endOfDay(target) }
}
