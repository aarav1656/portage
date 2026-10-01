> Live and immutable on devnet: program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`, upgrade authority none. Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Trust model

A holder of a Portage wrapped token trusts, in order: the Portage program as deployed, the issuer of the underlying T-Token (Tessera), and, for anything traded on a bonding curve, Meteora's programs. This page states what each party can do, from the code and from live reads.

## Custody by PDA

- The underlying sits in `vault_token`, a Token-2022 account whose owner is the `vault` PDA. Only the program can sign for that PDA.
- The program moves underlying out of `vault_token` in exactly one place, `unwrap`, and only after burning the same `amount` of wrapped tokens from an account the signer owns (`token::authority = user`).
- The program mints wrapped tokens in exactly one place, `wrap`, and only the measured increase of `vault_token.amount`.
- Every `wrap` and `unwrap` ends by requiring `wrapped_mint.supply <= vault_token.amount` (`InvariantViolated`, 6002).
- Account substitution is rejected by `has_one` on the `vault` record and by the `vault` PDA seeds, and `SelfTransfer` (6004) rejects using `vault_token` as the user account. Each of these has a failing-case test, and `packages/vault/test/vault.test.ts` runs 10 tests against the real tKalshi mint account.

## No admin

The program has no admin key, no configuration account, no pause, no fee, no withdraw, and no close instruction. The `Vault` account is written once by `init_vault` and never modified. `init_vault` is permissionless, and its result depends only on the underlying mint, so there is nothing to front-run: whoever calls it first creates the same accounts anyone else would.

Consequence for users: anyone can create a wrapped mint for any Token-2022 mint that passes the extension allowlist. Check that a wrapped mint equals `vaultAddresses(<expected underlying>).wrappedMint` for this program id before trusting it.

## Immutability

| Network | Upgrade authority | Evidence |
|---|---|---|
| devnet | none | programdata `8YhNcVevdXmZmc9D44Ym6zmWxhc2qiaBRPe3fhPP5ia` `"authority": null`, devnet slot 503856806, 2026-09-25 |

On devnet nobody can change the code: the binary at this address is the binary in this repository, final. What the source says is what runs, and it is set with `solana program set-upgrade-authority --final` (`DEVNET.md` step 7).

## The underlying issuer (Tessera)

Read from mainnet on 2026-09-25 (tKalshi slot 450271291, tOpenAI slot 450271293). Both mints share these authorities except the withheld-fee key.

| Power | Key | What it means for wrapped holders |
|---|---|---|
| Freeze authority | `7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o` | A freeze of `vault_token` pauses `wrap` and `unwrap` for that mint until it is thawed, because Token-2022 refuses transfers into or out of a frozen account. Wrapped tokens stay transferable and tradable meanwhile (the wrapped mint has no freeze authority). A freeze of one holder's underlying account affects only that holder, who can still `unwrap` to a different, unfrozen account via `user_underlying` |
| Transfer fee config authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | Can change the fee rate and cap. `wrap` and `unwrap` measure what actually moved, so the invariant holds at any fee. `min_minted` and `min_out` fix the least a user accepts on every transaction. Current fee 20 bps, cap 18446744073709551615 (none) |
| Mint authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | Can issue more underlying. Does not affect the 1:1 backing; affects the underlying's price |
| Withdraw withheld authority | tKalshi `5P6aL1imw2Vi7GptqoRHPu8fowJvXM8eVrs8nWnxVx5h`, tOpenAI `DjMKLEZe8d1nfCWQjoeoihqCU1owkxM8j2WqgFcCbzft` | Can collect fees withheld inside `vault_token`. Those are not part of `amount` and not counted as backing |

The code states the freeze assumption directly (`programs/portage/src/lib.rs` L17-L21): wrapped holders trust the underlying issuer exactly as much as underlying holders do.

The extension allowlist in `init_vault` is the program's guard against issuer-controlled extensions. It accepts only `TransferFeeConfig`, `MetadataPointer` and `TokenMetadata`. `PermanentDelegate`, which would let a third party move the vault's tokens directly, is rejected at `init_vault`, with a test.

## Meteora DBC and DAMM v2

Pools quoted in a wrapped mint are ordinary Meteora DBC and DAMM v2 pools, with the behaviour those programs define.

- DBC on mainnet: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`, programdata `HUfnSSiJxgspQm6C1rkqv6L3XgVtn7AESApgCQpCXCYh`, authority `JADaUV8kvDpDbJr55wxXJHVaBS3VCj8thZZHjfeuCVLd` (read mainnet slot 450273931, 2026-09-25).
- On devnet the same rejection arrives as 6080 at the badge gate; on mainnet it arrives as 6081 at the fee check. See [Why DBC rejects fee-bearing quote mints](../concepts/why-dbc-rejects-fee-quotes.md).
- `portageCurve` migrates to DAMM v2 with all LP permanently locked (50 % partner, 50 % creator, 0 % unlocked) and compounding fees, so the liquidity of a graduated pool stays in the pool for partner and creator alike.

## Off-chain components

- `/api/wrap` and `/api/unwrap` return unsigned transactions and the server holds no key; the wallet's transaction preview shows exactly what will be signed.
- Tessera's mark price (`https://rest-api.tessera.pe/v1/public/token-details`) only feeds launch pricing and the UI. On failure `web/lib/market.ts` falls back to the last cached price and marks it `stale`. It never feeds `wrap` or `unwrap` amounts.
