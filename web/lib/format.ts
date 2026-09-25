export function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatAmount(raw: bigint, decimals: number, maxFractionDigits = 6): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fracStr.length > 0 ? `${sign}${whole}.${fracStr}` : `${sign}${whole}`;
}

/** Parses a decimal-string user amount into raw base units. Throws on malformed input. */
export function parseAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error("enter a valid amount");
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > decimals) {
    throw new Error(`this token supports at most ${decimals} decimal places`);
  }
  const paddedFrac = fracPart.padEnd(decimals, "0");
  const raw = BigInt((wholePart || "0") + paddedFrac);
  return raw;
}

export function formatUsd(value: number): string {
  if (value > 0 && value < 1) {
    // Sub-cent bonding-curve prices need more than 2dp or they all read as $0.00.
    const digits = Math.min(10, Math.max(2, Math.ceil(-Math.log10(value)) + 2));
    return `$${value.toFixed(digits)}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
