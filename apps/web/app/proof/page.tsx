import { ProofPanels } from "@/components/proof-panels";
import { AddressLink } from "@/components/address-link";

export const dynamic = "force-dynamic";

const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const RAW_MINT = "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ";
const PLAIN_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

export default function ProofPage() {
  return (
    <div className="space-y-10 py-10">
      <section className="fade-in">
        <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Customs proof · live simulation</p>
        <h1 className="mt-2 text-balance text-4xl leading-tight sm:text-5xl">The border, simulated live</h1>
        <p className="mt-4 max-w-2xl text-pretty text-base text-[var(--ink-2)]">
          Both panels below build the same Meteora DBC createConfig plus createPool transaction and run it through
          simulateTransaction on mainnet. Only the quote mint differs. The raw run is rejected. The plain run clears.
        </p>
      </section>

      <ProofPanels />

      <section aria-label="Why wrapping fixes it" className="panel fade-in p-4 sm:p-5">
        <h2 className="text-lg">Why wrapping fixes it</h2>
        <p className="mt-3 max-w-2xl text-pretty text-sm text-[var(--ink-2)]">
          The DBC program reads the quote mint before it creates anything and rejects any mint that charges a transfer
          fee. Raw tKalshi is Token-2022 with a live fee, so the check stops at QuoteMintHasNonZeroTransferFee. The
          wrapped receipt is a plain legacy SPL mint with no extensions, so the fee read is zero and the same
          transaction clears. The vault keeps 1:1 backing, which is what makes the plain quote a bonded good instead
          of a copy.
        </p>
        <dl className="mt-3">
          <div className="ledger-row">
            <dt className="text-sm text-[var(--ink-2)]">Raw tKalshi mint</dt>
            <dd className="text-sm">
              <AddressLink value={RAW_MINT} />
            </dd>
          </div>
          <div className="ledger-row">
            <dt className="text-sm text-[var(--ink-2)]">Plain stand in mint (JitoSOL)</dt>
            <dd className="text-sm">
              <AddressLink value={PLAIN_MINT} />
            </dd>
          </div>
          <div className="ledger-row">
            <dt className="text-sm text-[var(--ink-2)]">Meteora DBC program</dt>
            <dd className="text-sm">
              <AddressLink value={DBC_PROGRAM} />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
