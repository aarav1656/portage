"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES = [
  { href: "/", label: "Manifest" },
  { href: "/vaults", label: "Vaults" },
  { href: "/market", label: "Market" },
  { href: "/launch", label: "Launch" },
  { href: "/devnet", label: "Devnet" },
  { href: "/pitch", label: "Pitch" },
];

export function Nav(): React.ReactNode {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-x-4 px-4 sm:px-6 lg:px-10">
        <div className="flex items-end gap-4">
          <Link href="/" className="py-4 font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
            Portage
          </Link>
          <span className="mono hidden pb-[1.1rem] text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)] sm:inline">
            Bonded manifest for wtKALSHI
          </span>
        </div>
        <div className="flex min-w-0 max-w-full items-end gap-4">
          <span className="mono hidden items-center gap-1.5 pb-[1.1rem] text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)] md:inline-flex">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {pathname === "/devnet" ? "Devnet" : "Mainnet-beta"}
          </span>
          <nav aria-label="Primary" className="flex min-w-0 overflow-x-auto">
            {ROUTES.map((route) => {
              const active = pathname === route.href;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`mono border-t border-l border-r border-[var(--line)] px-2 py-2 text-xs uppercase tracking-wider transition-colors sm:px-4 sm:tracking-widest ${
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
