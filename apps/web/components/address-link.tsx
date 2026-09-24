import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { shortAddress } from "@/lib/format";

/** Shortened address or tx signature, linking to Solscan, full value in the title. */
export function AddressLink({ value, kind = "account" }: { value: string; kind?: "account" | "tx" }) {
  const href = kind === "tx" ? `https://solscan.io/tx/${value}` : `https://solscan.io/account/${value}`;
  return (
    <a
      href={href}
      title={value}
      target="_blank"
      rel="noreferrer"
      className="mono inline-flex min-w-0 items-center gap-1 break-all text-[var(--ink)] underline decoration-[var(--line-strong)]"
    >
      {shortAddress(value)}
      <ArrowSquareOut size={13} weight="regular" aria-hidden="true" className="shrink-0" />
    </a>
  );
}
