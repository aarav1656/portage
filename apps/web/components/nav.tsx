"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES = [
  { href: "/", label: "Manifest" },
  { href: "/vaults", label: "Vaults" },
  { href: "/market", label: "Market" },
  { href: "/launch", label: "Launch" },
];

export function Nav(): React.ReactNode {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-[1320px] items-end justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex items-end gap-4">
          <Link href="/" className="py-4 font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
            Portage
          </Link>
          <span className="mono hidden pb-[1.1rem] text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)] sm:inline">
            Bonded manifest for wtKALSHI
          </span>
        </div>
        <div className="flex items-end gap-4">
          <span className="mono hidden items-center gap-1.5 pb-[1.1rem] text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)] md:inline-flex">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Mainnet-beta
          </span>
          <nav aria-label="Primary" className="flex">
            {ROUTES.map((route) => {
              const active = pathname === route.href;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`mono border-t border-l border-r border-[var(--line)] px-3 py-2 text-xs uppercase tracking-widest transition-colors sm:px-4 ${
                    active
                      ? "border-b-2 border-b-[var(--accent)] bg-[var(--paper-2)] text-[var(--ink)]"
                      : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
