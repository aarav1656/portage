> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# The wrap model

## One vault per underlying mint

For each underlying Token-2022 mint there is exactly one set of three PDAs, all seeded by that mint (`programs/portage/src/lib.rs` L13-L15, L167-L179):

| PDA | Seeds | What it holds |
|---|---|---|
| `vault` | `["vault", underlying_mint]` | The `Vault` record, and the authority over the other two |
| `vault_token` | `["vault_token", underlying_mint]` | Token-2022 account holding the real underlying |
| `wrapped_mint` | `["wrapped", underlying_mint]` | Legacy SPL mint, same decimals as the underlying, mint authority `vault`, no freeze authority |

Because the addresses depend only on the mint and the program id, there is no choice to make at `init_vault` time and no way to create a second vault for the same mint. Details: [Accounts and PDAs](../program/accounts-and-pdas.md).

## What 1:1 means here

`wrap` mints exactly what the vault received, not what the user sent. It records `vault_token.amount` before the transfer, reloads it after, and mints the difference (`programs/portage/src/lib.rs` L56-L92). `unwrap` burns `amount` wrapped tokens and sends `amount` underlying out of the vault (L106-L132).

So one wrapped base unit always corresponds to one underlying base unit sitting in `vault_token`. The fee is paid in underlying, before minting on the way in and at the destination on the way out.

## The invariant

After every `wrap` and every `unwrap`, the program reloads both accounts and requires

```
wrapped_mint.supply <= vault_token.amount
```

failing with `InvariantViolated` (6002) otherwise (`programs/portage/src/lib.rs` L93-L97 and L141-L146).

The enforced condition is `<=`, not equality. Under normal use the two are equal, because `wrap` adds `received` to both and `unwrap` subtracts `amount` from both. They can diverge in one direction only: anyone can transfer underlying straight into `vault_token` with a plain Token-2022 transfer. That raises `vault_token.amount` above the supply. No instruction can withdraw that surplus, since `unwrap` only releases what it burns.

Transfer fees withheld inside `vault_token` are not part of `amount` in Token-2022, so they do not count toward backing. The mint's withdraw-withheld authority (Tessera's key, see [Addresses](../program/addresses.md)) can harvest them without affecting the invariant.

Live read, devnet, 2026-09-25, slot 503856988: `vault_token` `3e75VsbsS1dgoL7Xz3Bz2X77GJzDJ2u91pGfSCSVFKKR` balance 89800000000, wrapped mint `NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi` supply 89800000000 (89.8 each at 9 decimals).

## Who pays the transfer fee

The user pays both legs, in the underlying token. The wrapped token itself carries no fee.

| Leg | Token moved | Fee charged by | Where the fee sits after | Effect on the user |
|---|---|---|---|---|
| `wrap` | underlying, user to `vault_token` | Token-2022 transfer fee of the underlying | withheld in `vault_token` | Sends `amount`, receives `amount - fee` wrapped |
| wrapped transfers, DBC swaps | wrapped (legacy SPL) | none | not applicable | none |
| `unwrap` | underlying, `vault_token` to user | Token-2022 transfer fee of the underlying | withheld in the user's underlying account | Burns `amount` wrapped, receives `amount - fee` underlying |

Token-2022 computes the fee as `amount * bps / 10000` rounded up, capped at `maximumFee`. For tKalshi and tOpenAI on 2026-09-25 that is 20 bps with `maximumFee` 18446744073709551615, so no cap applies in practice (mainnet reads at slots 450271291 and 450271293). Rounding up is exercised by the test "minting without a deposit is impossible" in `packages/vault/test/vault.test.ts`: wrapping 1 base unit pays a 1-unit fee, the vault receives 0, and the call fails with `NothingReceived`.

### Worked numbers, devnet run

From `DEVNET.md`, replica mint with a 20 bps fee and 9 decimals:

| Step | Input | Fee | Result | Vault after |
|---|---|---|---|---|
| 4b `wrap` | 100.000000000 sent, `min_minted` 99.8 | 0.2 | 99.800000000 wrapped minted | 99.800000000 |
| 5b DBC buy | 1.000000000 wrapped in | none on the wrapped leg | 31,186,470.580672 PTGD out | 99.800000000 |
| 6 `unwrap` | 10.000000000 burned, `min_out` 9.98 | 0.02 | 9.980000000 underlying received | 89.800000000 |

The vault went from 99.8 to 89.8 on the unwrap: it is debited the full 10, and the 0.02 fee is withheld at the user's side.

### Worked numbers, mainnet mint fixture

`packages/vault/test/vault.test.ts` runs the compiled program in LiteSVM against a copy of the real tKalshi mint account (`packages/vault/test/fixtures/tkalshi-mint.json`). Output of the round-trip test, run 2026-09-25:

```
round trip: sent 1234567891, wrap fee 2469136, minted 1232098755, unwrap fee 2464198, user got back 1229634557 (lost 4933334 base units)
```

A full round trip costs about 40 bps: 20 bps on each leg, the second applied to the already reduced amount.

## Slippage minimums

Both value-moving instructions take a minimum so that a fee change between building and landing a transaction cannot silently cost the user more.

| Instruction | Arg | Compared against | Error |
|---|---|---|---|
| `wrap` | `min_minted` | `received`, the measured increase of `vault_token.amount`, which is also the amount minted | `BelowMinimum` (6003) |
| `unwrap` | `min_out` | the measured increase of `user_underlying.amount` | `BelowMinimum` (6003) |

Both are measured balance deltas, not a fee computed from the mint config (`programs/portage/src/lib.rs` L70-L77, L134-L140). Passing `0` disables the check.

How the callers in this repo pick the minimum:

- `web/lib/fee.ts` `quoteMinimum`: reads the fee in force for the current epoch, computes `received = amount - fee`, then subtracts a tolerance of `MIN_TOLERANCE_BPS = 10` bps of the amount. For a 100-token wrap at 20 bps: fee 0.2, received 99.8, tolerance 0.1, minimum 99.7. `/api/wrap` and `/api/unwrap` use this when the request omits `minRaw` (`web/lib/vault-tx.ts`).
- `packages/dbc/src/devnet.ts`: `amount * 9980 / 10000`, the exact post-fee amount at 20 bps with no tolerance.
