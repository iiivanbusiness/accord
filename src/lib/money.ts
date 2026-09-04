// Parses a free-typed fee string (AI-extracted or hand-edited) into a number.
// Handles both US grouping ("$2,500.00") and European grouping ("€2.500,00")
// — a plain `replace(/,/g, "")` treats "150.000,00" (150k, European) as
// "150.000" -> 150, silently understating the fee by 1000x. That number
// feeds straight into ApprovalChain.minDealValue gating and the HubSpot
// sync, so misreading the format doesn't just show a wrong label — it can
// skip a required approval step entirely.
export function parseFee(feeDisplay: string): number {
  const match = feeDisplay.match(/[\d.,]+/);
  if (!match) return 0;
  let numStr = match[0];

  const lastComma = numStr.lastIndexOf(",");
  const lastDot = numStr.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators present — whichever comes last is the decimal one.
    numStr = lastComma > lastDot
      ? numStr.replace(/\./g, "").replace(",", ".")
      : numStr.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Only commas: a single comma followed by exactly 2 digits is a decimal
    // separator (e.g. "12,50"); anything else is thousands grouping.
    const isDecimal = numStr.indexOf(",") === lastComma && numStr.length - lastComma - 1 === 2;
    numStr = isDecimal ? numStr.replace(",", ".") : numStr.replace(/,/g, "");
  } else if (lastDot !== -1) {
    // Only dots: more than one, or exactly 3 digits after the last one
    // (e.g. "2.500"), means thousands grouping rather than a real decimal.
    const dotCount = (numStr.match(/\./g) ?? []).length;
    const isGrouping = dotCount > 1 || numStr.length - lastDot - 1 === 3;
    numStr = isGrouping ? numStr.replace(/\./g, "") : numStr;
  }

  const parsed = parseFloat(numStr);
  return Number.isFinite(parsed) ? parsed : 0;
}
