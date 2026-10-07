// Parses a free-typed fee string (AI-extracted or hand-edited) into a number.
// Handles both US grouping ("$2,500.00") and European grouping ("€2.500,00")
// — a plain `replace(/,/g, "")` treats "150.000,00" (150k, European) as
// "150.000" -> 150, silently understating the fee by 1000x. That number
// feeds straight into ReviewChain.minDealValue gating and the HubSpot
// sync, so misreading the format doesn't just show a wrong label — it can
// skip a required review step entirely.
export function parseFee(feeDisplay: string): number {
  const match = feeDisplay.match(/[\d.,]+/);
  if (!match) return 0;
  let numStr = match[0];
  // "$8.5k", "$1.2M", "2 million": the word after the number scales it.
  const after = feeDisplay.slice((match.index ?? 0) + numStr.length);
  const scale = /^\s?(k|thousand)\b/i.test(after) ? 1_000 : /^\s?(m|mm|mil|million)\b/i.test(after) ? 1_000_000 : 1;

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

  const parsed = parseFloat(numStr) * scale;
  return Number.isFinite(parsed) ? parsed : 0;
}

const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN", "RSD", "JPY", "INR", "MXN", "BRL", "ZAR", "SGD", "AED"];

// The currency a fee is written in, as an ISO code, when the fee says so
// ("$", "€", "CA$", "EUR"...). A bare "$" is taken as US dollars; null
// when there's no sign at all.
export function feeCurrency(feeDisplay: string): string | null {
  const code = feeDisplay.toUpperCase().match(new RegExp(`\\b(${CURRENCY_CODES.join("|")})\\b`));
  if (code) return code[1];
  if (/(C|CA)\$/.test(feeDisplay)) return "CAD";
  if (/(A|AU)\$/.test(feeDisplay)) return "AUD";
  if (/NZ\$/.test(feeDisplay)) return "NZD";
  if (feeDisplay.includes("€")) return "EUR";
  if (feeDisplay.includes("£")) return "GBP";
  if (feeDisplay.includes("¥")) return "JPY";
  if (feeDisplay.includes("₹")) return "INR";
  if (feeDisplay.includes("$")) return "USD";
  return null;
}
