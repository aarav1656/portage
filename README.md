# Portage

Portage wraps Tessera's fee-bearing pre-IPO tokens 1:1 into a plain SPL mint held by an on-chain
vault, so a token that Meteora's Dynamic Bonding Curve program refuses to touch can finally be
used to quote a bonding-curve launch. The wrap and unwrap accounting, the DBC launch configurator,
and the live proof of the rejection all run against mainnet state, not a mock.

Live site: https://portage-sol.vercel.app

## The problem

Meteora's Dynamic Bonding Curve program checks every quote mint for a Token-2022 transfer fee
before it does anything else. In `dynamic-bonding-curve/src/utils/token.rs`, `is_supported_quote_mint`
throws `QuoteMintHasNonZeroTransferFee` (error code 6081) the moment it finds a non-zero fee, and
it runs that check before the token-badge exemption, so a badge cannot rescue a fee-bearing mint.
The same check runs again on swap, on fee claim, and on migration.

Tessera's tKalshi (`TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ`) is a Token-2022 mint with a live
transfer fee. Reading it straight from mainnet right now:

```json
{"decimals":9,"transferFeeConfig":{"transferFeeBasisPoints":20},"freezeAuthority":"7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o"}
```

That fee alone is enough to fail the DBC check, badge or no badge. Portage's own `/api/market`
confirms the same number from the live epoch fee schedule: tKalshi and tOpenAI both carry 20 bps
right now (`transferFeeBasisPoints: 20` on both mints, read fresh on every request).

The result today is that every memecoin quoted in tKalshi lives on Raydium, never on Meteora DBC.
Internal research notes pulled DexScreener pair data on 2026-09-24 for four tKalshi-quoted pairs,
all on Raydium: WASH/tKalshi at $4,234 liquidity with
zero buys and zero sells in six hours, YES/tKalshi at $40,268 liquidity on 3 buys and 7 sells in a
day, BET/tKalshi at $27,184 liquidity and down almost 16% in 24h, and DOGINU/tKalshi at $30,776
liquidity, the most active of the four but still thin enough for one large exit to clear the book.
None of those pools carry any recourse if the launch never graduates. That pair data is a snapshot
from that date, not re-pulled for this document, since DexScreener liquidity moves by the minute.

## What Portage does

An Anchor program (`programs/portage`) holds three PDAs per underlying mint: `vault`, `vault_token`
(a Token-2022 account that holds the real tKalshi or tOpenAI), and `wrapped_mint` (a plain SPL
mint with zero extensions). `wrap` moves the underlying token into `vault_token` with
`transfer_checked`, reads back exactly how much arrived net of Tessera's own fee, and mints that
same amount of the wrapped token to the user. `unwrap` burns the wrapped token and transfers the
underlying back out. Every call ends by asserting `wrapped_mint.supply <= vault_token.amount`, so
the wrapped supply can never exceed what the vault actually holds.

Because the wrapped mint is a legacy SPL token with no extensions, its transfer fee reads as zero,
which is all Meteora's DBC program checks for. `packages/dbc` builds the `createConfig` and
`createPool` transaction quoted in that wrapped mint, priced off Tessera's live mark price, with an
exponential anti-snipe fee schedule (2,500 bps decaying to 100 bps over 300 seconds), a dynamic
fee, and migration to a DAMM v2 pool with all LP permanently locked and fees compounding in the
quote token after graduation.

The web app (`apps/web`) is the ledger for all of this: the home page shows the live rejection and
a wrap/unwrap panel, `/launch` configures a DBC pool against the live curve code and can run that
configuration through a real mainnet simulation before anything is deployed, `/vaults` reads vault
and mint state straight from RPC, `/market` compares Tessera's mark price against the live DEX
price for each wrapped token, and `/proof` runs the same `createConfig` call live against both a
raw tKalshi quote mint and a plain stand-in mint, side by side.

`/launch`'s simulate step calls `/api/launch-sim`, which builds the same `createConfig` plus
`initializeVirtualPoolWithSplToken` transaction that a real launch would submit, anchored to the
live Tessera mark price for tKalshi, and runs it through `simulateTransaction` on mainnet. It
returns the real program logs, the compute units consumed, and the actual starting price implied
by the requested market cap, so a launch can be checked before a single lamport moves.

`/market` answers a narrower question: is the wrapped token worth launching against right now. For
each of tKalshi and tOpenAI it reads the Tessera mark price (the same live number `/api/market`
already serves, including the stale-cache fallback), the live Jupiter price v3 quote for the same
mint, and the largest-liquidity pool for that mint from DexScreener. `premiumPct` is
`(dexPrice / markPrice - 1) * 100`: positive means the DEX is paying more than the Tessera desk, a
gap a wrap-and-launch can arbitrage. Each panel links its pool to Solscan and offers "Wrap for a
DBC launch" (`/` with the token preselected) and "Launch on DBC" (`/launch`).

## Live links

- Site: https://portage-sol.vercel.app
- Live proof (red/green simulation): https://portage-sol.vercel.app/proof
- Launch configurator: https://portage-sol.vercel.app/launch
- Vault ledger: https://portage-sol.vercel.app/vaults
- Market (mark vs DEX): https://portage-sol.vercel.app/market

## Evidence

| Check | Result |
|---|---|
| `packages/vault` test suite | 8/8 passing, run with `litesvm` against a fixture of the real mainnet tKalshi mint account, not a synthetic one |
| Wrap/unwrap round trip | Sending 1,234,567,891 base units mints 1,232,098,755 wrapped tokens (20 bps fee taken by Tessera), unwrapping all of it back returns 1,229,634,557, a total round-trip cost of 4,933,334 base units, about 40 bps, matching the 20 bps fee charged on each leg |
| Invariant under load | 30 wrap/unwrap cycles with pseudo-random odd amounts across three users, `wrapped_mint.supply <= vault_token.amount` checked and held after every single instruction |
| Live raw-quote simulation | `curl https://portage-sol.vercel.app/api/simulate?quote=raw` returns `"err":{"InstructionError":[0,{"Custom":6081}]}` with the real program log: `AnchorError thrown in programs/dynamic-bonding-curve/src/utils/token.rs:232... QuoteMintHasNonZeroTransferFee` |
| Live wrapped-quote simulation | `curl https://portage-sol.vercel.app/api/simulate?quote=plain` returns `"err":null` with a full `createConfig` + `initializeVirtualPoolWithSplToken` log, 174,050 compute units consumed |
| Live transfer fee | `curl https://portage-sol.vercel.app/api/market` returns `transferFeeBps: 20` for both tKalshi and tOpenAI, read from each mint's current epoch fee schedule, not cached |
| Live launch simulation | `node apps/web/check-launch.mjs` (2026-09-25) called `/api/launch-sim?name=Test&symbol=TST&supply=1000000000&startMcapUsd=50000`, got `err: null` back from mainnet `simulateTransaction`, more than 3 real program log lines, a starting price anchored to the live tKalshi mark (413.8 at that run), and an implied start market cap within 5% of the requested $50,000 |
| Live mark vs DEX premium | `node apps/web/check-market.mjs` (2026-09-25) read `/api/tmarket` and found tKalshi trading at a 7.82% premium to the Tessera mark and tOpenAI at a 28.02% premium, both computed as `(dexPrice / markPrice - 1) * 100` from the live Jupiter price v3 quote against the same live Tessera mark `/api/market` serves |

Both simulation checks above were re-run against the live deployment while writing this document
and matched the numbers shown.

## Honest status

The Portage program (`AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`) is not deployed to mainnet.
Checking it live: `getAccountInfo` for that address on `api.mainnet-beta.solana.com` returns
`"value":null`. Everything the web app shows against real mainnet state, the transfer fee reads,
the Tessera mark price, the two DBC simulations, works without the program because none of it calls
Portage's instructions. What is blocked without a deploy: `wrap`, `unwrap`, and `/vaults` showing a
real vault, and a DBC launch actually quoted in a real `wrapped_mint` rather than the JitoSOL
stand-in `/api/simulate` uses today for the passing case.

Deploying costs rent, not a service fee. The compiled program is 329,912 bytes
(`target/deploy/portage.so`). Asking `api.mainnet-beta.solana.com` for the rent-exempt minimum on
that program's data account (329,957 bytes with loader overhead) plus its 36-byte program account
returns 1,676,831,800 and 833,120 lamports, 1.6777 SOL total, live, not estimated.

## Run locally

Requires Node with pnpm, Rust 1.84+, and Anchor 0.32.1 (see `Anchor.toml` and
`programs/portage/Cargo.toml`).

```bash
pnpm install
anchor build                                   # produces target/deploy/portage.so, needed by the vault tests
(cd packages/vault && npx vitest run)          # 8 tests against the real tKalshi mint fixture
(cd packages/dbc && pnpm sim green)            # dry-run a DBC launch quoted in a plain stand-in mint
(cd packages/dbc && pnpm sim red)              # same call quoted in raw tKalshi, watch it fail with 6081
(cd apps/web && pnpm dev)                      # web app on localhost:3000
```

`apps/web` talks to `api.mainnet-beta.solana.com` by default; set `SOLANA_RPC_URL` to use your own
RPC. Tessera's mark price falls back to a bundled snapshot plus an OS-tmp-dir cache if
`rest-api.tessera.pe` is unreachable, so the UI still renders during a Tessera outage, marked
stale with the timestamp of the last good read. `fetchMarketSnapshot` in `apps/web/lib/market.ts`
is the single place this fallback lives; the home page, `/launch`, and `/market` all read through
it, so a Tessera outage surfaces the same "(stale)" label and last-good timestamp everywhere the
mark price is shown instead of failing silently or freezing on a wrong number. Only the DEX side of
`/market` (Jupiter price v3, DexScreener) has no fallback: if either is unreachable, `/market` shows
the real error inline rather than a guessed price.

## Security model and limits

- **Tessera controls the underlying mint.** `freezeAuthority` on tKalshi
  (`7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o`) can freeze any holder's account, including the
  vault's. `transferFeeConfigAuthority`, the same key as the mint authority, can raise the transfer
  fee or its cap at any time; Portage reads the actual amount received rather than assuming a fixed
  fee, so a fee change cannot break the invariant, only change how much a user gets back.
- **`init_vault` whitelists extensions.** It only accepts an underlying mint with
  `TransferFeeConfig`, `MetadataPointer`, or `TokenMetadata`. A mint with a `PermanentDelegate`
  extension, which would let a third party move vault funds directly, is rejected; this is covered
  by a test that constructs exactly that mint and confirms the rejection.
- **Wrap and unwrap are permissionless.** Anyone can deposit into the vault or redeem their own
  wrapped tokens; only the vault PDA can mint or move funds inside the vault's own accounts, and
  every account passed to an instruction is checked against the vault's stored addresses
  (`has_one` constraints), which is what stops a substituted vault token account or a forged
  wrapped mint from passing.
- **Program upgrade authority is undecided**, because the program has not been deployed yet. On
  deploy it will default to the deploying wallet unless explicitly set otherwise or renounced;
  whoever holds that key can push a new program binary to this address until it is renounced.
- **Portage does not control Tessera's API or Meteora's program.** A Tessera outage degrades to a
  cached mark price; a change to Meteora's DBC program is outside Portage's control entirely.

## Sponsor tracks

- **Tessera.** Portage exists to make tKalshi and tOpenAI usable as bonding-curve collateral, which
  is the token-utility case the Tessera bounty asks for, and it routes real fee flow back into the
  wrapped token's DAMM v2 pool after graduation rather than only rendering a price dashboard.
- **Meteora DBC.** The quote-mint design here is not a parameter tweak on an existing config; it is
  the first way to make a Token-2022 mint with a live transfer fee usable as DBC collateral at all,
  a class the DBC program's own quote-mint check otherwise rules out unconditionally.

## Architecture

See `ARCHITECTURE.md` for components, data flow, and the wrap/unwrap and DBC launch sequences.

![Portage architecture diagram](docs/architecture/portage-architecture.png)

[Interactive version](docs/architecture/portage-architecture.html)
