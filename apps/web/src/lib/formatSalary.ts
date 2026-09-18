const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

function formatAmount(amount: number): string {
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(amount);
}

const PERIOD_SUFFIX: Record<string, string> = {
  YEARLY: "/yr",
  MONTHLY: "/mo",
  DAILY: "/day",
  HOURLY: "/hr",
};

export function formatSalary(input: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = input;
  if (salaryMin == null && salaryMax == null) return null;

  const symbol = salaryCurrency ? (CURRENCY_SYMBOLS[salaryCurrency] ?? `${salaryCurrency} `) : "";
  const suffix = salaryPeriod ? (PERIOD_SUFFIX[salaryPeriod] ?? "") : "";

  if (salaryMin != null && salaryMax != null && salaryMin !== salaryMax) {
    return `${symbol}${formatAmount(salaryMin)} - ${symbol}${formatAmount(salaryMax)}${suffix}`;
  }
  const value = salaryMax ?? salaryMin;
  return value != null ? `${symbol}${formatAmount(value)}${suffix}` : null;
}
