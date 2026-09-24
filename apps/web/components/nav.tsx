"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES = [
  { href: "/", label: "Manifest" },
  { href: "/vaults", label: "Vaults" },
  { href: "/launch", label: "Launch" },
];

export function Nav(): React.ReactNode {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-4xl items-end justify-between px-4 sm:px-6">
        <Link href="/" className="py-4 font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
          Portage
        </Link>
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
    </header>
  );
}
