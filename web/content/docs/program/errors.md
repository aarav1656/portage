> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Errors

Portage defines five custom errors in `PortageError` (`programs/portage/src/lib.rs` L238-L250). Anchor numbers them from 6000 in declaration order; the codes below match the `errors` array in `packages/vault/src/idl.json`.

| Code | Hex | Name | Message | Fires in | When |
|---|---|---|---|---|---|
| 6000 | 0x1770 | `UnsupportedUnderlying` | Underlying mint has an extension the vault cannot hold safely | `init_vault` | The underlying mint has any extension other than `TransferFeeConfig`, `MetadataPointer`, `TokenMetadata` |
| 6001 | 0x1771 | `NothingReceived` | Vault received nothing | `wrap`, `unwrap` | `wrap`: the vault's balance did not increase (the whole amount went to the fee). `unwrap`: `amount` is 0 |
| 6002 | 0x1772 | `InvariantViolated` | Wrapped supply would exceed vault balance | `wrap`, `unwrap` | After the CPIs, `wrapped_mint.supply > vault_token.amount`; or a measured balance moved backwards (`checked_sub` underflow on `vault_token` in `wrap`, on `user_underlying` in `unwrap`) |
| 6003 | 0x1773 | `BelowMinimum` | Amount after the transfer fee is below the caller's minimum | `wrap`, `unwrap` | `wrap`: amount received by the vault `< min_minted`. `unwrap`: amount received by `user_underlying` `< min_out` |
| 6004 | 0x1774 | `SelfTransfer` | User underlying account cannot be the vault token account | `wrap`, `unwrap` | `user_underlying` is the vault's own `vault_token` account |

Every error aborts the whole transaction, so no partial state (a burn without a payout, a deposit without a mint) persists.

## Framework errors callers will see

These come from Anchor account validation or from the token programs, not from `PortageError`. Numbers from `anchor-lang` 0.32.1 `src/error.rs`.

| Code | Name | Typical cause in Portage |
|---|---|---|
| 2001 | `ConstraintHasOne` | A `vault_token` or `wrapped_mint` that is not the one recorded in `vault` |
| 2006 | `ConstraintSeeds` | A `vault` that is not the PDA for the given `underlying_mint` |
| 2014 | `ConstraintTokenMint` | A user token account for a different mint |
| 2015 | `ConstraintTokenOwner` | `unwrap` with a `user_wrapped` not owned by `user` |
| 2022 | `ConstraintMintTokenProgram` | `init_vault` with an underlying mint not owned by Token-2022 |
| 3008 | `InvalidProgramId` | Wrong program passed as `underlying_program`, `token_program`, or `system_program` |

## Decoding in TypeScript

`PORTAGE_ERRORS` in `packages/vault/src/index.ts` maps all five names to their codes from the IDL, typed, so `PORTAGE_ERRORS.SelfTransfer` is `6004`. See [`@portage/vault`](../sdk/vault.md).
