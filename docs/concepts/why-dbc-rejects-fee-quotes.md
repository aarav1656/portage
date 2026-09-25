> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Why DBC rejects fee-bearing quote mints

All DBC source references below are to [MeteoraAg/dynamic-bonding-curve at `f552f20`](https://github.com/MeteoraAg/dynamic-bonding-curve/tree/f552f20aa3c1c7631427c3827aeea7c58b902813) (committed 2026-09-09, cloned 2026-09-25). Line numbers are for that commit. Error numbers were computed from the order of the `PoolError` enum in error.rs, which Anchor numbers from 6000.

## The check

[utils/token.rs L216-L244](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/utils/token.rs#L216-L244), `is_supported_quote_mint`, in order:

1. If the mint's owner is the legacy Token program, return `true`. Nothing else is inspected.
2. If the mint is the Token-2022 native mint, error `UnsupportNativeMintToken2022` (6028).
3. `require!(is_transfer_fee_zero(...), QuoteMintHasNonZeroTransferFee)`: error 6081 if the fee is not zero.
4. If any extension other than `MetadataPointer` or `TokenMetadata` is present, return `false`.
5. Otherwise return `true`.

`is_transfer_fee_zero` ([L172-L199](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/utils/token.rs#L172-L199)) reads both fee slots of `TransferFeeConfig`. If the newer fee is scheduled for a future epoch, both the older and the newer fee must be zero. Otherwise the newer fee must be zero. A mint that is fee-free today but has a nonzero fee scheduled also fails.

A second helper, `validate_transfer_fee_is_zero` ([L201-L214](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/utils/token.rs#L201-L214)), returns `Ok` for a legacy Token mint and otherwise requires `is_transfer_fee_zero`, failing with 6081.

## Where it runs

Pool and config creation, through `validate_quote_mint_with_token_badge` (calls `is_supported_quote_mint`):

| Instruction handler | Call site |
|---|---|
| create config | [process_create_config.rs:378](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/partner/create_config/process_create_config.rs#L378) |
| initialize virtual pool, SPL base | [ix_initialize_virtual_pool_with_spl_token.rs:149](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/initialize_pool/ix_initialize_virtual_pool_with_spl_token.rs#L149) |
| initialize virtual pool, Token-2022 base | [ix_initialize_virtual_pool_with_token2022.rs:116](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/initialize_pool/ix_initialize_virtual_pool_with_token2022.rs#L116) |
| initialize virtual pool, Token-2022 base with transfer hook | [ix_initialize_virtual_pool_with_token2022_transfer_hook.rs:115](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/initialize_pool/ix_initialize_virtual_pool_with_token2022_transfer_hook.rs#L115) |

Every later movement of quote tokens, through `validate_transfer_fee_is_zero`:

| Operation | Call site |
|---|---|
| swap | [process_swap.rs:288](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/swap/process_swap.rs#L288) |
| claim partner trading fee | [ix_claim_partner_trading_fee.rs:131](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/partner/ix_claim_partner_trading_fee.rs#L131) |
| claim creator trading fee | [ix_claim_creator_trading_fee.rs:115](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/creator/ix_claim_creator_trading_fee.rs#L115) |
| claim protocol fee | [ix_claim_protocol_fee2.rs:142](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/operator/ix_claim_protocol_fee2.rs#L142) |
| withdraw partner surplus | [ix_withdraw_partner_surplus.rs:79](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/partner/ix_withdraw_partner_surplus.rs#L79) |
| withdraw creator surplus | [ix_withdraw_creator_surplus.rs:79](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/creator/ix_withdraw_creator_surplus.rs#L79) |
| withdraw migration fee | [ix_withdraw_migration_fee.rs:130](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/migration/ix_withdraw_migration_fee.rs#L130) |
| migrate to DAMM v2 | [migrate_damm_v2_initialize_pool.rs:553](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs#L553) |

The per-operation checks matter for the design: getting a fee-bearing mint past pool creation would not be enough, because swap, every fee claim, and migration check the fee again at execution time. If Tessera ever lowered the fee to zero long enough to create a pool, a later increase would make every swap, claim, and the migration of that pool fail with 6081.

## Why a token badge does not help

A token badge is Meteora's allowlist for quote mints that `is_supported_quote_mint` does not accept. `validate_quote_mint_with_token_badge` ([L246-L258](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/utils/token.rs#L246-L258)) only consults the badge when `is_supported_quote_mint` returns `false`. For a mint with a nonzero fee, `is_supported_quote_mint` does not return `false`; it returns an error at step 3, so the badge branch is never reached.

A badge cannot be created for such a mint either: `handle_create_token_badge` ([ix_create_token_badge.rs:40-44](https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/instructions/operator/ix_create_token_badge.rs#L40-L44)) calls `is_supported_quote_mint` first, which errors with 6081 on the same line. And the swap, claim, and migration checks do not consult badges at all.

## Why the Portage wrapped mint passes

The wrapped mint is created by `init_vault` under the legacy Token program (`wrapped_mint: Account<'info, Mint>` with `mint::token_program = token_program`, `programs/portage/src/lib.rs` L175-L179). Both helpers return success at their first check for a legacy-owned mint, so no fee or extension is read. Devnet confirms the owner: the wrapped mint `NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi` is owned by `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (read 2026-09-25, devnet slot 503856988).

## Live evidence

Mainnet, `packages/dbc/src/sim.ts`, run 2026-09-25, simulation only (`sigVerify: false`, nothing sent):

```
mode red quote TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ tKalshi mark $413.8
slot 450271514 err {"InstructionError":[0,{"Custom":6081}]} CU 9816 ixs 2 bytes 1097
  Program log: AnchorError thrown in programs/dynamic-bonding-curve/src/utils/token.rs:232. Error Code: QuoteMintHasNonZeroTransferFee. Error Number: 6081. Error Message: Quote mint has a non zero transfer fee.
```

```
mode green quote J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn tKalshi mark $413.8
slot 450271521 err null CU 166550 ixs 2 bytes 1065
```

The green run uses JitoSOL, an existing legacy SPL mint with 9 decimals, as a stand-in for a wrapped mint, because no wrapped mint exists on mainnet. The deployed site returned the same `{"Custom":6081}` from `https://portage-sol.vercel.app/api/simulate?quote=raw` on 2026-09-25.

The tKalshi fee that trips the check, read from mainnet on 2026-09-25 (slot 450271291, epoch 1042): `transferFeeBasisPoints` 20 in both fee slots, `maximumFee` 18446744073709551615 (no effective cap). tOpenAI: the same 20 bps and the same `maximumFee` (slot 450271293).

## Devnet returned 6080, not 6081

On devnet, `DEVNET.md` step 3 (slot 503805273) recorded DBC failing with `InvalidTokenBadge` (6080), not 6081, for a replica mint carrying a 20 bps fee and a metadata pointer. With the `f552f20` source above, that mint would fail at step 3 with 6081 before any badge logic runs. The two sources conflict:

- Mainnet: the simulation log names token.rs:232 and 6081, which matches the `f552f20` source line for line. Better evidenced for mainnet behaviour.
- Devnet: the on-chain log shows 6080, so the DBC binary deployed on devnet orders its checks differently from `f552f20`. The devnet DBC binary version was not checked.

Both outcomes are a rejection. The quote mint is refused either way, and a badge cannot be obtained for it on the current source.
