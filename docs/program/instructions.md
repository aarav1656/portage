> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Instructions

Source: `programs/portage/src/lib.rs`. Account order, signer and writable flags, and discriminators below are from the IDL (`packages/vault/src/idl.json`, identical to `target/idl/portage.json`). All three instructions are permissionless: no admin key exists in the program.

Anchor framework error numbers quoted here come from `anchor-lang` 0.32.1 `src/error.rs`. Custom errors are in [Errors](errors.md).

Program ids used in the tables:

- Token-2022: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
- Token (legacy SPL): `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- System: `11111111111111111111111111111111`

## `init_vault`

Creates the vault record, the vault's Token-2022 account, and the wrapped legacy SPL mint for one underlying mint.

Discriminator: `[77, 79, 85, 150, 33, 217, 52, 106]`. Args: none.

| # | Account | Signer | Writable | Owner / type | Constraints |
|---|---|---|---|---|---|
| 0 | `payer` | yes | yes | system account | Pays rent for the three new accounts |
| 1 | `underlying_mint` | no | no | Token-2022 mint | `mint::token_program = underlying_program` |
| 2 | `vault` | no | yes | this program, `Vault` | `init`, seeds `["vault", underlying_mint]`, space `8 + Vault::INIT_SPACE` (105 bytes) |
| 3 | `vault_token` | no | yes | Token-2022 token account | `init`, seeds `["vault_token", underlying_mint]`, `token::mint = underlying_mint`, `token::authority = vault` |
| 4 | `wrapped_mint` | no | yes | legacy Token mint | `init`, seeds `["wrapped", underlying_mint]`, `mint::decimals = underlying_mint.decimals`, `mint::authority = vault`, no freeze authority |
| 5 | `underlying_program` | no | no | fixed: Token-2022 | `Program<Token2022>` |
| 6 | `token_program` | no | no | fixed: Token | `Program<Token>` |
| 7 | `system_program` | no | no | fixed: System | `Program<System>` |

Checks in the handler (L30-L45): unpacks the underlying mint with its extensions and requires every extension to be one of `TransferFeeConfig`, `MetadataPointer`, `TokenMetadata`. A mint with no extensions passes.

Errors:

| Condition | Error |
|---|---|
| Underlying has any other extension (for example `PermanentDelegate`, `TransferHook`, `MintCloseAuthority`) | `UnsupportedUnderlying` (6000) |
| Underlying mint is owned by the legacy Token program | `ConstraintMintTokenProgram` (2022), from the constraint; not exercised by a test |
| Vault for this mint already exists | account creation fails (the PDA is already in use) |
| Wrong `underlying_program` or `token_program` | `InvalidProgramId` (3008) |

Effects: writes `Vault { underlying_mint, wrapped_mint, vault_token, bump }` where `bump` is the `vault` PDA bump. No event.

Tested: "init_vault refuses an underlying with a permanent delegate" in `packages/vault/test/vault.test.ts`. On mainnet, both tKalshi and tOpenAI carry exactly `transferFeeConfig`, `metadataPointer`, `tokenMetadata` (read 2026-09-25, slots 450271291 and 450271293), so `init_vault` would accept them.

## `wrap`

Deposits underlying into the vault and mints the net amount received as wrapped tokens.

Discriminator: `[178, 40, 10, 189, 228, 129, 186, 140]`.

| Arg | Type | Meaning |
|---|---|---|
| `amount` | `u64` | Underlying base units to send from `user_underlying` |
| `min_minted` | `u64` | Fail unless at least this many wrapped base units are minted |

| # | Account | Signer | Writable | Owner / type | Constraints |
|---|---|---|---|---|---|
| 0 | `user` | yes | no | any | Authority over `user_underlying` for the transfer |
| 1 | `underlying_mint` | no | no | Token-2022 mint | none beyond deserialization |
| 2 | `vault` | no | no | this program, `Vault` | seeds `["vault", underlying_mint]`, `bump = vault.bump`, `has_one = underlying_mint`, `has_one = wrapped_mint`, `has_one = vault_token` |
| 3 | `vault_token` | no | yes | Token-2022 token account | matched by `vault.has_one` |
| 4 | `wrapped_mint` | no | yes | legacy Token mint | matched by `vault.has_one` |
| 5 | `user_underlying` | no | yes | Token-2022 token account | `token::mint = underlying_mint`; must not equal `vault_token` |
| 6 | `user_wrapped` | no | yes | legacy Token account | `token::mint = wrapped_mint`; any owner |
| 7 | `underlying_program` | no | no | fixed: Token-2022 | |
| 8 | `token_program` | no | no | fixed: Token | |

Sequence (L54-L100):

1. Record `vault_token.amount`.
2. `transfer_checked` of `amount` from `user_underlying` to `vault_token`, authority `user`, with the underlying's decimals. Token-2022 withholds the transfer fee at `vault_token`.
3. Reload `vault_token`; `received = after - before`.
4. Require `received > 0`, then `received >= min_minted`.
5. `mint_to` `received` wrapped tokens into `user_wrapped`, signed by the `vault` PDA.
6. Reload `wrapped_mint`; require `supply <= vault_token.amount`.
7. Emit `Wrapped { user, sent: amount, minted: received }`.

Errors:

| Condition | Error |
|---|---|
| `received` is 0 (for example `amount` 1 at 20 bps: fee rounds up to 1) | `NothingReceived` (6001) |
| `received < min_minted` | `BelowMinimum` (6003) |
| Supply would exceed vault balance, or `vault_token.amount` decreased | `InvariantViolated` (6002) |
| `user_underlying` is `vault_token` | `SelfTransfer` (6004) |
| `vault_token` or `wrapped_mint` is not the one stored in `vault` | `ConstraintHasOne` (2001) |
| `vault` is not the PDA for `underlying_mint` | `ConstraintSeeds` (2006) |
| `user_underlying` or `user_wrapped` is for another mint | `ConstraintTokenMint` (2014) |
| Insufficient balance, or `user` is not the owner or delegate of `user_underlying` | Token-2022 error from the CPI |

`user_wrapped` has no owner constraint: the caller may mint to any wrapped token account. The account must exist; `packages/vault` does not create it, `web/lib/vault-tx.ts` and `packages/dbc/src/devnet.ts` prepend an idempotent ATA creation.

## `unwrap`

Burns wrapped tokens and releases the same amount of underlying from the vault.

Discriminator: `[126, 175, 198, 14, 212, 69, 50, 44]`.

| Arg | Type | Meaning |
|---|---|---|
| `amount` | `u64` | Wrapped base units to burn, and underlying base units to send out of `vault_token` |
| `min_out` | `u64` | Fail unless `user_underlying` increases by at least this much |

| # | Account | Signer | Writable | Owner / type | Constraints |
|---|---|---|---|---|---|
| 0 | `user` | yes | no | any | Burn authority over `user_wrapped` |
| 1 | `underlying_mint` | no | no | Token-2022 mint | none beyond deserialization |
| 2 | `vault` | no | no | this program, `Vault` | seeds `["vault", underlying_mint]`, `bump = vault.bump`, `has_one = underlying_mint`, `has_one = wrapped_mint`, `has_one = vault_token` |
| 3 | `vault_token` | no | yes | Token-2022 token account | matched by `vault.has_one` |
| 4 | `wrapped_mint` | no | yes | legacy Token mint | matched by `vault.has_one` |
| 5 | `user_underlying` | no | yes | Token-2022 token account | `token::mint = underlying_mint`; must not equal `vault_token`; any owner |
| 6 | `user_wrapped` | no | yes | legacy Token account | `token::mint = wrapped_mint`, `token::authority = user` |
| 7 | `underlying_program` | no | no | fixed: Token-2022 | |
| 8 | `token_program` | no | no | fixed: Token | |

Sequence (L102-L149):

1. Require `amount > 0`.
2. Record `user_underlying.amount`.
3. `burn` `amount` from `user_wrapped`, authority `user`.
4. `transfer_checked` of `amount` from `vault_token` to `user_underlying`, signed by the `vault` PDA. Token-2022 withholds the fee at `user_underlying`.
5. Reload `user_underlying`; `paid_out = after - before`; require `paid_out >= min_out`.
6. Reload `vault_token` and `wrapped_mint`; require `supply <= vault_token.amount`.
7. Emit `Unwrapped { user, burned: amount }`.

Errors:

| Condition | Error |
|---|---|
| `amount` is 0 | `NothingReceived` (6001) |
| `paid_out < min_out` | `BelowMinimum` (6003) |
| Supply would exceed vault balance, or `user_underlying.amount` decreased | `InvariantViolated` (6002) |
| `user_underlying` is `vault_token` | `SelfTransfer` (6004) |
| `user_wrapped` is not owned by `user` | `ConstraintTokenOwner` (2015) |
| `vault_token` or `wrapped_mint` is not the one stored in `vault` | `ConstraintHasOne` (2001) |
| `vault` is not the PDA for `underlying_mint` | `ConstraintSeeds` (2006) |
| Burning more than `user_wrapped` holds | Token program error from the CPI ("insufficient funds") |
| `vault_token` frozen by the underlying's freeze authority | Token-2022 error from the CPI |

`user_underlying` has no owner constraint: the caller may redeem to any underlying token account of that mint, for example a different wallet. The account must exist; `web/lib/vault-tx.ts` prepends an idempotent ATA creation.

## Tests covering these paths

`packages/vault/test/vault.test.ts`, 10 tests, all passing on 2026-09-25 (`npx vitest run` in `packages/vault`, against `target/deploy/portage.so`):

| Test | Asserts |
|---|---|
| fixture is the live mainnet config: Token-2022, 9 decimals, 20 bps fee | fixture shape |
| wrap then unwrap round trip, fee exact to the base unit | wrap and unwrap amounts to the base unit |
| invariant holds across many wrap/unwrap cycles with odd amounts | `supply <= vault` after each of 30 cycles |
| unwrap more than owned fails | burn failure, state unchanged |
| cannot unwrap someone else's wrapped tokens | `ConstraintTokenOwner` |
| substituted vault token account, wrapped mint, or vault is rejected | `ConstraintHasOne`, `ConstraintSeeds` |
| minting without a deposit is impossible | `NothingReceived`, direct `MintTo` rejected |
| unwrap fails when min_out is above what the fee allows, and wrap when min_minted is | `BelowMinimum` on both |
| unwrap into the vault token account, or wrap from it, is rejected | `SelfTransfer` on both |
| init_vault refuses an underlying with a permanent delegate | `UnsupportedUnderlying` |
