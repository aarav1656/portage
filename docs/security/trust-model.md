> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Trust model

A holder of a Portage wrapped token trusts, in order: the Portage program as deployed, the issuer of the underlying T-Token (Tessera), and, for anything traded on a bonding curve, Meteora's programs. This page states what each party can do, from the code and from live reads.

## Not audited

There is no audit report in the repository. `programs/portage/src/lib.rs` carries a comment labelled "audit H1" (L17-L21, the freeze-authority assumption below), but no audit report, reviewer, or scope is recorded anywhere in the repository. Test coverage is the 10 LiteSVM tests in `packages/vault/test/vault.test.ts` (listed in [Instructions](../program/instructions.md#tests-covering-these-paths)); CI does not run them.

## Custody by PDA

- The underlying sits in `vault_token`, a Token-2022 account whose owner is the `vault` PDA. Only the program can sign for that PDA.
- The program moves underlying out of `vault_token` in exactly one place, `unwrap`, and only after burning the same `amount` of wrapped tokens from an account the signer owns (`token::authority = user`).
- The program mints wrapped tokens in exactly one place, `wrap`, and only the measured increase of `vault_token.amount`.
- Every `wrap` and `unwrap` ends by requiring `wrapped_mint.supply <= vault_token.amount` (`InvariantViolated`, 6002).
- Account substitution is blocked by `has_one` on the `vault` record and by the `vault` PDA seeds; `SelfTransfer` (6004) blocks using `vault_token` as the user account. Each of these has a failing-case test.

## No admin

The program has no admin key, no configuration account, no pause, no fee, no withdraw, and no close instruction. The `Vault` account is written once by `init_vault` and never modified. `init_vault` is permissionless, and its result depends only on the underlying mint, so there is nothing to front-run: whoever calls it first creates the same accounts anyone else would.

Consequence for users: anyone can create a wrapped mint for any Token-2022 mint that passes the extension allowlist. Check that a wrapped mint equals `vaultAddresses(<expected underlying>).wrappedMint` for this program id before trusting it. The wrapped mint also has no metadata (`init_vault` creates none), so wallets will not show a name or symbol for it.

## Immutability

| Network | Upgrade authority | Evidence |
|---|---|---|
| devnet | none | programdata `8YhNcVevdXmZmc9D44Ym6zmWxhc2qiaBRPe3fhPP5ia` `"authority": null`, devnet slot 503856806, 2026-09-25 |
| mainnet | not deployed | `getAccountInfo` returned null, mainnet slot 450271154, 2026-09-25 |

On devnet nobody can change the code. The same property cuts the other way: a bug cannot be patched. A fix would need a new program id, and holders would have to unwrap from the old vault and wrap into the new one.

On mainnet no decision exists yet. A deploy leaves the upgrade authority with the deploying key until it is transferred or removed with `solana program set-upgrade-authority --final`, which is what the devnet run did (`DEVNET.md` step 7).

## The underlying issuer (Tessera)

Read from mainnet on 2026-09-25 (tKalshi slot 450271291, tOpenAI slot 450271293). Both mints share these authorities except the withheld-fee key.

| Power | Key | What it means for wrapped holders |
|---|---|---|
| Freeze authority | `7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o` | Can freeze `vault_token`. Every `wrap` and `unwrap` for that mint then fails, because Token-2022 refuses transfers into or out of a frozen account. Wrapped tokens stay transferable and tradable (the wrapped mint has no freeze authority), but none can be redeemed until the account is thawed. Portage has no path around a freeze. The issuer can also freeze an individual holder's underlying account, which blocks that holder's `wrap`; that holder can still `unwrap` to a different, unfrozen account via `user_underlying` |
| Transfer fee config authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | Can change the fee rate and cap. `wrap` and `unwrap` measure what actually moved, so the invariant holds at any fee; users receive less. `min_minted` and `min_out` bound the loss per transaction. Current fee 20 bps, cap 18446744073709551615 (none) |
| Mint authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | Can issue more underlying. Does not affect the 1:1 backing; affects the underlying's price |
| Withdraw withheld authority | tKalshi `5P6aL1imw2Vi7GptqoRHPu8fowJvXM8eVrs8nWnxVx5h`, tOpenAI `DjMKLEZe8d1nfCWQjoeoihqCU1owkxM8j2WqgFcCbzft` | Can collect fees withheld inside `vault_token`. Those are not part of `amount` and not counted as backing |

The code states the freeze assumption directly (`programs/portage/src/lib.rs` L17-L21): wrapped holders trust the underlying issuer exactly as much as underlying holders do.

The extension allowlist in `init_vault` is the program's only defence against issuer-controlled extensions. It rejects any extension other than `TransferFeeConfig`, `MetadataPointer`, `TokenMetadata`. `PermanentDelegate`, which would let a third party move the vault's tokens directly, is rejected, with a test. The check runs once, at `init_vault`.

## Meteora DBC and DAMM v2

Portage does not control either program. Pools quoted in a wrapped mint carry their risks unchanged.

- DBC on mainnet is upgradeable: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` programdata `HUfnSSiJxgspQm6C1rkqv6L3XgVtn7AESApgCQpCXCYh`, authority `JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd` (read mainnet slot 450273931, 2026-09-25). Meteora can change the quote-mint checks or any pool behaviour.
- The devnet DBC build rejected the raw replica with a different error (6080) than the mainnet build (6081); see [Why DBC rejects fee-bearing quote mints](../concepts/why-dbc-rejects-fee-quotes.md). The two deployments are not the same code.
- `portageCurve` migrates to DAMM v2 with all LP permanently locked (50 % partner, 50 % creator, 0 % unlocked) and compounding fees. The LP is configured to be permanently locked after graduation, for partner and creator alike. The DAMM v2 program was not inspected for this page.
- A DBC pool holds wrapped tokens, not the underlying. If `vault_token` is frozen, the pool keeps trading a token that cannot be redeemed until the thaw.

## Off-chain components

- `/api/wrap` and `/api/unwrap` return unsigned transactions; the server holds no key. A compromised server could return a different transaction, so a wallet's transaction preview is the check.
- Tessera's mark price (`https://rest-api.tessera.pe/v1/public/token-details`) only feeds launch pricing and the UI. On failure `web/lib/market.ts` falls back to the last cached price and marks it `stale`. It never feeds `wrap` or `unwrap` amounts.
- On-chain IDL: none published on devnet. Anyone can create the Anchor IDL account for this program first and control it (see [IDL](../program/accounts-and-pdas.md#on-chain-idl)). Use the IDL in this repository.
