import type { FeeSchedulePoint } from "@/lib/curve";
import { formatBps } from "@/lib/format";

/** Fee-vs-time table, computed from the real fee scheduler config, not a static description. */
export function FeeSchedule({ fees }: { fees: FeeSchedulePoint[] }) {
  if (fees.length === 0) return null;
  const shown = fees.filter((_, i) => i === 0 || i === fees.length - 1 || i % Math.max(1, Math.floor(fees.length / 6)) === 0);
  return (
    <div>
      <dl>
        {shown.map((f) => (
          <div key={f.seconds} className="ledger-row">
            <dt className="mono text-sm text-[var(--ink-2)]">t + {f.seconds}s</dt>
            <dd className="mono text-sm text-[var(--ink)]">{formatBps(f.bps)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
