import { ProofPanels } from "@/components/proof-panels";
import { AddressLink } from "@/components/address-link";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const RAW_MINT = "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ";
const PLAIN_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

export default function ProofPage() {
  return (
    <div className="space-y-10 py-10">
      <PageHeader
        no="02"
        eyebrow="Live simulation"
        title="The border, simulated live"
        lede={
          <>
            Both panels below build the same Meteora DBC createConfig plus createPool transaction and run it through
            simulateTransaction on mainnet. Only the quote mint differs. The raw run is rejected. The plain run clears.
          </>
        }
        meta={[{ label: "DBC program", value: <AddressLink value={DBC_PROGRAM} /> }]}
      />

      <ProofPanels />

      <section aria-label="Why wrapping fixes it" className="panel fade-in grid gap-6 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-lg">Why wrapping fixes it</h2>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-[var(--ink-2)]">
            The DBC program reads the quote mint before it creates anything and rejects any mint that charges a transfer
            fee. Raw tKalshi is Token-2022 with a live fee, so the check stops at QuoteMintHasNonZeroTransferFee. The
            wrapped receipt is a plain legacy SPL mint with no extensions, so the fee read is zero and the same
            transaction clears. The vault keeps 1:1 backing, which is what makes the plain quote a bonded good instead
            of a copy.
          </p>
        </div>
        <dl>
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
