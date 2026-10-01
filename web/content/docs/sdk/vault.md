> Live and immutable on devnet: program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`, upgrade authority none. Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# `@portage/vault`

Source: `packages/vault/src/index.ts`. Private workspace package (`"private": true` in `packages/vault/package.json`), consumed as TypeScript source; not published to npm. Dependencies: `@solana/web3.js` ^1.98.4, `@solana/spl-token` ^0.4.13. No network calls: every function is pure address derivation or instruction encoding.

Import from inside the workspace:

```ts
import { wrapIx, unwrapIx, initVaultIx, vaultAddresses, userAccounts } from "@portage/vault";
```

## Exports

| Export | Signature | Returns |
|---|---|---|
| `idl` | IDL JSON | The contents of `packages/vault/src/idl.json` |
| `PORTAGE_PROGRAM_ID` | `PublicKey` | `idl.address`, `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V` |
| `vaultAddresses` | `(underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID)` | `{ vault, vaultToken, wrappedMint }` PDAs |
| `userAccounts` | `(user: PublicKey, underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID)` | `{ userUnderlying, userWrapped }`: the user's ATA for the underlying under Token-2022 and for the wrapped mint under Token, `allowOwnerOffCurve = true` |
| `initVaultIx` | `(payer: PublicKey, underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID)` | `TransactionInstruction` for `init_vault` |
| `wrapIx` | `(user, underlyingMint, amount: bigint, minMinted: bigint, overrides = {}, programId = PORTAGE_PROGRAM_ID)` | `TransactionInstruction` for `wrap` |
| `unwrapIx` | `(user, underlyingMint, amount: bigint, minOut: bigint, overrides = {}, programId = PORTAGE_PROGRAM_ID)` | `TransactionInstruction` for `unwrap` |
| `PORTAGE_ERRORS` | `Record<name, number>` | Error name to code, built from `idl.errors` |

### How instructions are encoded

The internal `build` function looks up the instruction in the IDL by name, writes its 8-byte `discriminator`, then each argument as a little-endian `u64`. Account metas are produced in IDL order with the IDL's `signer` and `writable` flags. A missing account name throws `portage <ix>: missing account <name>`.

### `overrides`

`wrapIx` and `unwrapIx` fill every account from `vaultAddresses` and `userAccounts`. `overrides` replaces any of them by IDL account name (`vault`, `vault_token`, `wrapped_mint`, `user_underlying`, `user_wrapped`, ...). Uses:

- Redeem to a token account other than the signer's ATA: `unwrapIx(user, mint, amount, minOut, { user_underlying: otherAccount })`. The program allows this (see [Instructions](../program/instructions.md)).
- Negative tests: `packages/vault/test/vault.test.ts` passes substituted accounts this way to assert `ConstraintHasOne`, `ConstraintSeeds`, `ConstraintTokenOwner`, and `SelfTransfer`.

### What the builders do not do
### Composition

The builders return plain instructions, so the caller composes the transaction around them:

- ATAs: `wrap` takes `user_wrapped` and `unwrap` takes `user_underlying`. Prepend `createAssociatedTokenAccountIdempotentInstruction` from `@solana/spl-token`, as `web/lib/vault-tx.ts` does.
- Minimums: compute `minMinted` or `minOut` from the live fee (see [The wrap model](../concepts/wrap-model.md#slippage-minimums)).
- Blockhash, signing and sending stay with the caller's wallet or keypair.

## Typed error codes

`PORTAGE_ERRORS` holds all five errors, built from `idl.errors`, and its type is `Record<"UnsupportedUnderlying" | "NothingReceived" | "InvariantViolated" | "BelowMinimum" | "SelfTransfer", number>`, so `PORTAGE_ERRORS.SelfTransfer` (6004) type-checks.

## Tests

`packages/vault/test/vault.test.ts`: 10 tests, run with `npx vitest run` in `packages/vault`. The tests load the program built by `anchor build` (`target/deploy/portage.so`, or the build at `PORTAGE_SO`) into LiteSVM (`litesvm` 0.8.0) together with a snapshot of the mainnet tKalshi mint account (`packages/vault/test/fixtures/tkalshi-mint.json`, taken at mainnet slot 449987467 per the test file). All 10 pass (2026-09-25, and again 2026-10-01).
