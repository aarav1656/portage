import type { CurvePoint } from "@/lib/curve";
import { formatUsd } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 56;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;
const PAD_RIGHT = 12;

/** Price-vs-supply bonding curve, drawn from real portageCurve() segments. Log-scale on price. */
export function CurveChart({ points, graduateUsd }: { points: CurvePoint[]; graduateUsd: number }) {
  if (points.length < 2) {
    return <p className="text-sm text-[var(--ink-3)]">Not enough curve segments to plot.</p>;
  }
  const maxSupply = points[points.length - 1]!.supply;
  const prices = points.map((p) => Math.log10(Math.max(p.priceUsd, 1e-9)));
  const minLogPrice = Math.min(...prices);
  const maxLogPrice = Math.max(...prices);
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (supply: number) => PAD_LEFT + (maxSupply === 0 ? 0 : (supply / maxSupply) * plotW);
  const y = (priceUsd: number) => {
    const logPrice = Math.log10(Math.max(priceUsd, 1e-9));
    const t = maxLogPrice === minLogPrice ? 0 : (logPrice - minLogPrice) / (maxLogPrice - minLogPrice);
    return PAD_TOP + (1 - t) * plotH;
  };

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.supply).toFixed(2)},${y(p.priceUsd).toFixed(2)}`).join(" ");
  const areaPath = `${path} L${x(maxSupply).toFixed(2)},${PAD_TOP + plotH} L${x(0).toFixed(2)},${PAD_TOP + plotH} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Bonding curve: price versus base tokens sold" className="w-full">
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + plotH} stroke="var(--line)" strokeWidth={1} />
        <line x1={PAD_LEFT} y1={PAD_TOP + plotH} x2={WIDTH - PAD_RIGHT} y2={PAD_TOP + plotH} stroke="var(--line)" strokeWidth={1} />
        <path d={areaPath} fill="var(--accent)" fillOpacity={0.12} stroke="none" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <text x={PAD_LEFT} y={PAD_TOP - 2} className="mono" fontSize={10} fill="var(--ink-2)">
          {formatUsd(last.priceUsd)}
        </text>
        <text x={PAD_LEFT} y={HEIGHT - 4} className="mono" fontSize={10} fill="var(--ink-2)">
          {formatUsd(first.priceUsd)}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 4} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-2)">
          {maxSupply.toLocaleString("en-US", { maximumFractionDigits: 0 })} tokens sold
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-[var(--ink-3)]">
        Price (log scale) against base tokens sold, from start to the {formatUsd(graduateUsd)} graduation threshold.
      </figcaption>
    </figure>
  );
}
