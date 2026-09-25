> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Accounts, PDAs, events, and IDL

## PDAs

All three are derived from the program id and the underlying mint. Seed constants: `VAULT`, `VAULT_TOKEN`, `WRAPPED` in `programs/portage/src/lib.rs` L13-L15.

| Account | Seeds | Owner program | Type | Authority |
|---|---|---|---|---|
| `vault` | `[b"vault", underlying_mint]` | Portage | `Vault` (below) | not applicable |
| `vault_token` | `[b"vault_token", underlying_mint]` | Token-2022 | token account for `underlying_mint` | `vault` PDA |
| `wrapped_mint` | `[b"wrapped", underlying_mint]` | Token (legacy SPL) | mint, decimals copied from the underlying, no extensions | mint authority `vault` PDA, freeze authority none |

`vault_token` is a PDA token account, not an associated token account. The `vault` bump is stored in the account; the other two bumps are not stored and are only used by `init_vault`.

TypeScript derivation: `vaultAddresses(underlyingMint)` in `packages/vault/src/index.ts`.

Live devnet read, 2026-09-25, slot 503856988, for the replica mint `EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2`:

| Account | Address | Observed |
|---|---|---|
| `vault` | `81eLRVP1xQX1pNrvzn6rcLwdveL998G7h6jwGz2NeyWZ` | owner Portage, 105 bytes of data, bump 255 |
| `vault_token` | `3e75VsbsS1dgoL7Xz3Bz2X77GJzDJ2u91pGfSCSVFKKR` | owner Token-2022, balance 89800000000 |
| `wrapped_mint` | `NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi` | owner Token, decimals 9, mint authority `81eLRVP1...`, freeze authority null, supply 89800000000 |

Derived (not on chain) PDAs for the mainnet mints are listed in [Addresses](addresses.md).

## `Vault`

`programs/portage/src/lib.rs` L152-L159. Anchor account, discriminator `[211, 8, 232, 43, 2, 152, 117, 119]`.

| Offset | Field | Type | Set by | Meaning |
|---|---|---|---|---|
| 0 | discriminator | `[u8; 8]` | Anchor | |
| 8 | `underlying_mint` | `Pubkey` | `init_vault` | The Token-2022 mint held in custody |
| 40 | `wrapped_mint` | `Pubkey` | `init_vault` | The legacy SPL mint issued against it |
| 72 | `vault_token` | `Pubkey` | `init_vault` | The Token-2022 account that holds the underlying |
| 104 | `bump` | `u8` | `init_vault` | Bump of the `vault` PDA |

Total 105 bytes (`8 + Vault::INIT_SPACE`). The account is never written after `init_vault` and has no close instruction. `wrap` and `unwrap` read it only to check `has_one` and `seeds` constraints and to sign as the PDA.

## Token programs

| Role | Program | Why |
|---|---|---|
| Underlying (tKalshi, tOpenAI) | Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | The T-Tokens are Token-2022 mints with `TransferFeeConfig` |
| Wrapped mint | Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | DBC accepts any legacy Token mint as a quote without reading its fee or extensions |

Both are fixed in the account structs as `Program<Token2022>` and `Program<Token>`, so a caller cannot substitute another program.

User accounts follow the same split: `userAccounts` in `packages/vault/src/index.ts` derives the underlying ATA under Token-2022 and the wrapped ATA under Token, both with `allowOwnerOffCurve = true`.

## Events

Emitted with `emit!`, which writes a `Program data:` log line (base64 of discriminator plus Borsh fields).

| Event | Discriminator | Fields | Emitted by |
|---|---|---|---|
| `Wrapped` | `[11, 127, 145, 31, 206, 134, 73, 130]` | `user: Pubkey`, `sent: u64` (amount requested), `minted: u64` (amount received by the vault and minted) | `wrap` |
| `Unwrapped` | `[25, 86, 93, 80, 145, 113, 86, 93]` | `user: Pubkey`, `burned: u64` | `unwrap` |

`sent - minted` in `Wrapped` is the transfer fee paid on the way in. `Unwrapped` does not record the amount received after the fee; read the recipient's balance change for that.

## IDL

| Location | What |
|---|---|
| `target/idl/portage.json` | Written by `anchor build` (the `idl-build` feature in `programs/portage/Cargo.toml`) |
| `packages/vault/src/idl.json` | Checked-in copy imported by `packages/vault/src/index.ts`. Identical to `target/idl/portage.json` after JSON normalization, compared 2026-09-25 |

IDL metadata: `name` `portage`, `version` `0.1.0`, `spec` `0.1.0`, `address` `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`.

Regenerate and refresh the copy (no script in the repo does the copy):

```bash
anchor build
cp target/idl/portage.json packages/vault/src/idl.json
(cd packages/vault && npx vitest run)
```

`packages/vault` builds instructions from the IDL's `discriminator` and `accounts` arrays, so a changed account list flows into the builders without code changes, but a new argument type other than `u64` would not (see [`@portage/vault`](../sdk/vault.md)).

### On-chain IDL

Not published. `anchor idl fetch AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V --provider.cluster devnet` on 2026-09-25 returned `AccountNotFound: pubkey=Gr3T1gad3caZ2RjEeoMHPKAg8XyRVPyLFgNJTk5EeUUd`, the Anchor IDL account address for this program. Mainnet has no program, so no IDL either.

The deployed binary includes Anchor's IDL instructions (the strings `Instruction: IdlCreateAccount` and `Instruction: IdlSetAuthority` are present in the dumped devnet program). In `anchor-syn` 0.32.1 (`src/codegen/program/idl.rs` L187), `IdlCreateAccount` sets the IDL authority to whichever signer creates the account first; it does not require the program's upgrade authority. So anyone can publish an IDL at `Gr3T1gad...` on devnet, and no key tied to the program decides who does. Treat any on-chain IDL for this program as unverified and use the one in this repository.
