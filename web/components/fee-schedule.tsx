import type { FeeSchedulePoint } from "@/lib/curve";
import { formatBps } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 48;
const PAD_BOTTOM = 28;
const PAD_TOP = 16;
const PAD_RIGHT = 12;

/** Fee-vs-time bar chart, drawn from the real fee-scheduler config, not a static description. */
export function FeeSchedule({ fees }: { fees: FeeSchedulePoint[] }) {
  if (fees.length === 0) return null;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxSeconds = fees[fees.length - 1]!.seconds || 1;
  const maxBps = Math.max(...fees.map((f) => f.bps)) || 1;

  const x = (seconds: number) => PAD_LEFT + (seconds / maxSeconds) * plotW;
  const y = (bps: number) => PAD_TOP + (1 - bps / maxBps) * plotH;
  const barW = Math.max(2, plotW / fees.length - 3);

  // Show every Nth tick on the time axis so labels never overlap.
  const tickEvery = Math.max(1, Math.ceil(fees.length / 6));
  const ticks = fees.filter((_, i) => i % tickEvery === 0 || i === fees.length - 1);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Base fee versus time: starts at ${formatBps(fees[0]!.bps)}, decays to ${formatBps(fees[fees.length - 1]!.bps)} by t+${maxSeconds}s`}
        className="w-full"
      >
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + plotH} stroke="var(--line)" strokeWidth={1} />
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + plotH}
          x2={WIDTH - PAD_RIGHT}
          y2={PAD_TOP + plotH}
          stroke="var(--line)"
          strokeWidth={1}
        />

        {fees.map((f) => (
          <rect
            key={f.seconds}
            x={x(f.seconds) - barW / 2}
            y={y(f.bps)}
            width={barW}
            height={PAD_TOP + plotH - y(f.bps)}
            fill="var(--accent)"
            fillOpacity={0.75}
          />
        ))}

        {/* y axis: max and zero */}
        <text x={PAD_LEFT - 6} y={PAD_TOP + 4} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-2)">
          {formatBps(maxBps)}
        </text>
        <text x={PAD_LEFT - 6} y={PAD_TOP + plotH} textAnchor="end" className="mono" fontSize={10} fill="var(--ink-2)">
          0%
        </text>

        {/* x axis ticks: seconds since launch */}
        {ticks.map((f) => (
          <text
            key={f.seconds}
            x={x(f.seconds)}
            y={HEIGHT - 6}
            textAnchor="middle"
            className="mono"
            fontSize={10}
            fill="var(--ink-2)"
          >
            {f.seconds}s
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs text-[var(--ink-3)]">
        Base fee (percent, y axis) against seconds since pool creation (x axis), from the same fee-scheduler config the
        pool deploys with.
      </figcaption>
    </figure>
  );
}
