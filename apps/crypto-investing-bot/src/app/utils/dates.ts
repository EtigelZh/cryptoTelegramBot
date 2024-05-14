export function subtractMonths(currentDate= new Date(), monthCount = 1) {
  currentDate.setMonth(currentDate.getMonth() - monthCount);
  return currentDate;
}
