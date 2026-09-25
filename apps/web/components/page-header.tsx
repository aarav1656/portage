/** Manifest header block: shared across every route so the grid and vertical rhythm stay identical page to page. */
export function PageHeader({
  no,
  eyebrow,
  title,
  lede,
  meta,
}: {
  no: string;
  eyebrow: string;
  title: string;
  lede: React.ReactNode;
  meta?: { label: string; value: React.ReactNode }[];
}) {
  return (
    <header className="fade-in border-b border-[var(--line)] pb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="min-w-0">
          <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">
            Manifest No. {no} &middot; {eyebrow}
          </p>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{title}</h1>
        </div>
        {meta && meta.length > 0 && (
          <dl className="mono hidden shrink-0 grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-xs sm:grid">
            {meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-[var(--ink-3)]">{m.label}</dt>
                <dd className="min-w-0 text-right text-[var(--ink)]">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="mt-4 max-w-2xl text-base text-[var(--ink-2)]">{lede}</p>
    </header>
  );
}
