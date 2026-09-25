const VARIANT_CLASS: Record<"cleared" | "rejected" | "pending", string> = {
  cleared: "stamp-cleared",
  rejected: "stamp-rejected",
  pending: "stamp-pending",
};

export function Stamp({ variant, children }: { variant: "cleared" | "rejected" | "pending"; children: React.ReactNode }) {
  return <span className={`stamp ${VARIANT_CLASS[variant]}`}>{children}</span>;
}
