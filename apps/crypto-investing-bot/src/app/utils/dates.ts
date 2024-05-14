export function subtractMonths(currentDate= new Date(), monthCount = 1) {
  currentDate.setMonth(currentDate.getMonth() - monthCount);
  return currentDate;
}

export function subtractDays(currentDate= new Date(), dayCount = 1) {
  currentDate.setDate(currentDate.getDate() - dayCount);
  return currentDate;
}
