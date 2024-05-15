export function subtractMonths(currentDate= new Date(), monthCount = 1) {
  currentDate.setMonth(currentDate.getMonth() - monthCount);
  return currentDate;
}

export function subtractDays(currentDate= new Date(), dayCount = 1) {
  currentDate.setDate(currentDate.getDate() - dayCount);
  return currentDate;
}

export function daysDiff(date1: Date, date2: Date) {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
}
