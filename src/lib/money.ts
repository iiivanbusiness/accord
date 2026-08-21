export function parseFee(feeDisplay: string): number {
  const match = feeDisplay.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}
