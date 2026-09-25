const TONE_CLASS: Record<"default" | "accent" | "rejected", string> = {
  default: "text-[var(--ink)]",
  accent: "text-[var(--accent)]",
  rejected: "text-[var(--rejected)]",
};

/** One ledger tile for a stat strip: label, live mono figure, optional sub-line. */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "accent" | "rejected";
}) {
  return (
    <div className="panel min-w-0 p-4">
      <p className="mono truncate text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">{label}</p>
      <p className={`mono mt-2 truncate text-2xl ${TONE_CLASS[tone]}`}>{value}</p>
      {sub !== undefined && <p className="mt-1 text-xs leading-snug text-[var(--ink-3)]">{sub}</p>}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="panel min-w-0 p-4" aria-label="Loading stat">
      <div className="h-3 w-2/3 skeleton" />
      <div className="mt-3 h-6 w-1/2 skeleton" />
      <div className="mt-2 h-3 w-3/4 skeleton" />
    </div>
  );
}
