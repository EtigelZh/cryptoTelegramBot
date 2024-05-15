export function avg(items:number[]): number {
  if (!items.length) return 0;
  return items.reduce((acc, item) => acc + item, 0) / items.length;
}

export function median(items:number[]): number {
  if (!items.length) return 0;
  const sorted = items.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}
