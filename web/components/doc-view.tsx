import Link from "next/link";
import { Stamp } from "@/components/stamp";
import { PAGES, groups, hrefOf, render, type DocPage } from "@/lib/docs";

function Sidebar({ current }: { current: DocPage }) {
  return (
    <nav aria-label="Documentation" className="mono text-[0.8125rem]">
      {groups().map((g) => (
        <div key={g.name} className="mb-5">
          <p className="mb-1.5 text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">{g.name}</p>
          <ul className="border-l border-[var(--line)]">
            {g.pages.map((p) => {
              const active = p.slug === current.slug;
              return (
                <li key={p.file}>
                  <Link
                    href={hrefOf(p.slug)}
                    aria-current={active ? "page" : undefined}
                    className={`-ml-px block border-l-2 py-1 pl-3 leading-snug transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--paper-2)] text-[var(--ink)]"
                        : "border-transparent text-[var(--ink-2)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocView({ page }: { page: DocPage }) {
  const { html, titleHtml, toc } = render(page);
  const i = PAGES.indexOf(page);
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  const sections = toc.filter((t) => t.depth === 2).length;

  return (
    <div className="grid gap-x-10 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
      <details className="panel mb-6 lg:hidden">
        <summary className="mono cursor-pointer px-4 py-3 text-xs uppercase tracking-widest text-[var(--ink-2)]">
          Contents &middot; {page.group} / {page.title}
        </summary>
        <div className="border-t border-[var(--line)] px-4 pt-4">
          <Sidebar current={page} />
        </div>
      </details>
      <aside className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pb-6">
          <Sidebar current={page} />
        </div>
      </aside>

      <article className="min-w-0 fade-in">
        <header className="border-b border-[var(--line)] pb-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">
              Docs No. {String(i + 1).padStart(2, "0")} &middot; {page.group}
            </p>
            <Stamp variant="pending"><span className="[overflow-wrap:anywhere]">{page.file}</span></Stamp>
          </div>
          <h1 className="doc-title mt-3 text-3xl leading-tight sm:text-5xl" dangerouslySetInnerHTML={{ __html: titleHtml }} />
          <p className="mono mt-3 text-xs text-[var(--ink-3)]">
            {sections} section{sections === 1 ? "" : "s"} &middot; page {i + 1} of {PAGES.length}
          </p>
        </header>
        <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />

        <nav aria-label="Previous and next page" className="mt-12 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={hrefOf(prev.slug)} className="panel block px-4 py-3 transition-colors hover:bg-[var(--paper-3)]">
              <span className="mono block text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">&larr; Previous</span>
              <span className="mt-1 block font-[family-name:var(--font-display)] text-lg">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={hrefOf(next.slug)} className="panel block px-4 py-3 text-right transition-colors hover:bg-[var(--paper-3)]">
              <span className="mono block text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">Next &rarr;</span>
              <span className="mt-1 block font-[family-name:var(--font-display)] text-lg">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden xl:block">
        {toc.length > 0 && (
          <nav aria-label="On this page" className="sticky top-6 mono text-xs">
            <p className="mb-2 text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">On this page</p>
            <ul className="space-y-1.5 border-l border-[var(--line)]">
              {toc.map((t) => (
                <li key={t.id} className={t.depth === 3 ? "pl-6" : "pl-3"}>
                  <a href={`#${t.id}`} className="block leading-snug text-[var(--ink-2)] hover:text-[var(--accent)]">
                    {t.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </aside>
    </div>
  );
}
