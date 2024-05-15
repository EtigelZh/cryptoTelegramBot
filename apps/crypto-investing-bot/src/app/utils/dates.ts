export function subtractMonths(currentDate= new Date(), monthCount = 1) {
  const currentDateCopy = new Date(currentDate);
  currentDateCopy.setMonth(currentDate.getMonth() - monthCount);
  return currentDateCopy;
}

export function subtractDays(currentDate= new Date(), dayCount = 1) {
  const currentDateCopy = new Date(currentDate);
  currentDateCopy.setDate(currentDate.getDate() - dayCount);
  return currentDateCopy;
}

export function daysDiff(date1: Date, date2: Date) {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
}
