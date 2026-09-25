> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Wrap and unwrap

Before either path works on a cluster, two things must exist there: the Portage program and a vault for the underlying mint (`init_vault`, once per mint, callable by anyone). Today that is true only on devnet, for the replica mint `EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2`.

## From the web app

The wrap panel is on the home page (`web/app/page.tsx`, `web/components/wrap-panel.tsx`). `/?token=OpenAI` preselects tOpenAI; the default is tKalshi.

1. Connect a wallet. Detection uses Wallet Standard and requires the `solana:signAndSendTransaction` feature (`web/lib/use-wallet.ts`).
2. Pick the token and Wrap or Unwrap, enter an amount. The panel shows the fee at the live rate and the minimum it will pass on chain, computed by `quoteMinimum` in `web/lib/fee.ts` (live fee minus a 10 bps tolerance).
3. Submit. The browser posts to `/api/wrap` or `/api/unwrap`, receives an unsigned transaction, and hands it to the wallet with chain `solana:mainnet`.

To wrap for real today, use `/devnet`: it runs the same `wrap` and `unwrap` against the deployed devnet program and the tKalshi replica, the wallet signs, and the app relays the signed transaction to devnet (`web/components/devnet-panel.tsx`, `web/app/api/devnet/send/route.ts`). `web/check-devnet.mjs` exercises a real devnet wrap.

Limitation of the mainnet flow above: it is wired to mainnet only (`web/lib/rpc.ts` defaults to `https://api.mainnet-beta.solana.com`, `SOLANA_RPC_URL` overrides it; the wallet call hardcodes `solana:mainnet`). The program does not exist on mainnet (read 2026-09-25, slot 450271154), so the home page and `/vaults` show "Not initialised", and a transaction built by the API cannot succeed when sent. Pointing `SOLANA_RPC_URL` at devnet does not help either: the mint list in `web/lib/tessera.ts` holds the mainnet tKalshi and tOpenAI addresses, which have no vault on devnet.

### `/api/wrap` and `/api/unwrap`

Files: `web/app/api/wrap/route.ts`, `web/app/api/unwrap/route.ts`, `web/lib/vault-tx.ts`. `POST`, JSON body:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `user` | base58 string | yes | Wallet public key; fee payer and signer |
| `token` | `"Kalshi"` or `"OpenAI"` | yes | Selects the mainnet mint from `web/lib/tessera.ts` |
| `amountRaw` | integer string | yes | Base units, must be positive |
| `minRaw` | non-negative integer string | no | `min_minted` or `min_out`; must not exceed `amountRaw`. If omitted, the server reads the live fee and applies `quoteMinimum` |

Response `200`: `{ "txBase64": string, "minRaw": string }`. The transaction is a serialized legacy `Transaction` with fee payer `user`, a recent `confirmed` blockhash, and no signatures. Instructions:

- wrap: idempotent create of the user's wrapped ATA (legacy Token), then `wrap`.
- unwrap: idempotent create of the user's underlying ATA (Token-2022), then `unwrap`.

Response `400`: `{ "error": string }` for invalid JSON, a missing field, an unknown token, a non-integer or non-positive amount, a malformed or too-large `minRaw`, or an invalid public key. The server never holds a key.

## From TypeScript with `@portage/vault`

This mirrors the `wrap` and `unwrap` steps of `packages/dbc/src/devnet.ts`, which ran on devnet (see `DEVNET.md` steps 4b and 6).

```ts
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { wrapIx, unwrapIx, vaultAddresses, userAccounts } from "@portage/vault";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const underlying = new PublicKey("EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2"); // devnet replica
const UNIT = 1_000_000_000n; // 9 decimals

// payer: a Keypair holding replica tokens in its Token-2022 ATA
const { wrappedMint } = vaultAddresses(underlying);
const { userWrapped } = userAccounts(payer.publicKey, underlying);

// Wrap 100, require all 99.8 to arrive (20 bps fee, no extra tolerance)
const amount = 100n * UNIT;
const minMinted = (amount * 9980n) / 10000n;
await sendAndConfirmTransaction(conn, new Transaction().add(
  createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, userWrapped, payer.publicKey, wrappedMint, TOKEN_PROGRAM_ID),
  wrapIx(payer.publicKey, underlying, amount, minMinted),
), [payer], { commitment: "confirmed" });

// Unwrap 10, require at least 9.98 underlying back
const out = 10n * UNIT;
await sendAndConfirmTransaction(conn, new Transaction().add(
  unwrapIx(payer.publicKey, underlying, out, (out * 9980n) / 10000n),
), [payer], { commitment: "confirmed" });
```

Notes:

- A minimum with zero tolerance, as above, fails with `BelowMinimum` (6003) if the fee rises before the transaction lands. `web/lib/fee.ts` reads the fee in force for the current epoch with `getEpochFee` and leaves 10 bps of slack; copy that when the fee is not fixed.
- `unwrapIx` assumes the signer's Token-2022 ATA for the underlying exists. Prepend `createAssociatedTokenAccountIdempotentInstruction(..., TOKEN_2022_PROGRAM_ID)` if it may not.
- To redeem to another account, pass `{ user_underlying: account }` as the `overrides` argument.
- To create the vault on a new cluster or for a new mint: `initVaultIx(payer.publicKey, underlying)`. It fails with `UnsupportedUnderlying` (6000) if the mint has an extension outside `TransferFeeConfig`, `MetadataPointer`, `TokenMetadata`.

## Checking the result

- The `Wrapped` event log carries `sent` and `minted`; `Unwrapped` carries `burned`. See [Accounts, PDAs, events, IDL](../program/accounts-and-pdas.md#events).
- The backing: `vault_token` balance and wrapped mint supply should be equal (the program enforces `supply <= balance`). On devnet, 2026-09-25, both were 89800000000 base units.
