> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Portage documentation

Portage is an Anchor program that holds Tessera's fee-bearing Token-2022 T-Tokens (tKalshi, tOpenAI) in a vault PDA and mints a plain SPL token 1:1 against what the vault actually received. The plain token has no transfer fee, so Meteora's Dynamic Bonding Curve (DBC) accepts it as a quote mint. DBC rejects the raw T-Token with `QuoteMintHasNonZeroTransferFee` (6081).

The repository has four parts:

| Part | Path | What it is |
|---|---|---|
| Program | `programs/portage/src/lib.rs` | Anchor 0.32.1 program, instructions `init_vault`, `wrap`, `unwrap` |
| Vault SDK | `packages/vault/src/index.ts` | PDA derivation and instruction builders driven by the checked-in IDL |
| DBC SDK | `packages/dbc/src/index.ts` | Curve and fee schedule for a launch quoted in a wrapped mint, and `buildLaunchTx` |
| Web app | `web/` | Next.js app: wrap panel, launch configurator, vault ledger, proof page |

The web app lives at `web/`. Commit `ae25a85` moved it there from apps/web without changing the files these docs cite, and `pnpm-workspace.yaml` lists `web` as a workspace package.

## Deployment status

| Network | Program account | Upgrade authority | Evidence |
|---|---|---|---|
| devnet | Exists, executable, owner `BPFLoaderUpgradeab1e11111111111111111111111`, programdata `8YhNcVevdXmZmc9D44Ym6zmWxhc2qiaBRPe3fhPP5ia` | none | `getAccountInfo` (jsonParsed) on the programdata account returned `"authority": null`, `"slot": 503782830`, devnet slot 503856806, 2026-09-25 |
| mainnet-beta | Does not exist | not applicable | `getAccountInfo` on the program id returned `"value": null`, mainnet slot 450271154, 2026-09-25 |
| localnet | `Anchor.toml` maps `portage` to the same id | set by whoever deploys locally | `Anchor.toml` |

The devnet binary is the one built from this source. `solana program dump -u devnet` on 2026-09-25 wrote 332,888 bytes with SHA-256 `de7286a8d068ceba8fd18d314e337ec23588e551c950c0490a9dc86e8bc63e02`, identical to the local `target/deploy/portage.so`. `programs/` and `packages/` are identical between `6b3db36` (the devnet run) and `ae25a85`, and have no uncommitted changes.

What follows from the table:

- The full wrap, DBC launch, buy, and unwrap loop has run on devnet against a Token-2022 replica of tKalshi (see `DEVNET.md` and [Reproduce the devnet run](guides/reproduce-the-devnet-run.md)).
- The web app talks to mainnet only (`web/lib/rpc.ts`, wallet chain `solana:mainnet` in `web/lib/use-wallet.ts`). Until the program exists on mainnet, `/vaults` shows "Not initialised" and a wrap or unwrap built by `/api/wrap` or `/api/unwrap` cannot succeed on chain.
- The program has not been audited. No audit report exists in the repository.

## Pages

Concepts

- [Why DBC rejects fee-bearing quote mints](concepts/why-dbc-rejects-fee-quotes.md): the exact check, every DBC instruction that runs it, and why a token badge does not help.
- [The wrap model](concepts/wrap-model.md): 1:1 backing, the supply invariant, who pays the transfer fee, slippage minimums.

Guides

- [Wrap and unwrap](guides/wrap-and-unwrap.md): from the web app and from TypeScript.
- [Launch a DBC pool](guides/launch-a-dbc-pool.md): the configurator, curve and fee parameters, `buildLaunchTx`.
- [Reproduce the devnet run](guides/reproduce-the-devnet-run.md): commands and what each step proves.

Program reference

- [Instructions](program/instructions.md): args, accounts, constraints, errors, effects.
- [Accounts, PDAs, events, IDL](program/accounts-and-pdas.md)
- [Errors](program/errors.md)
- [Addresses](program/addresses.md)

SDK reference

- [`@portage/vault`](sdk/vault.md)
- [`@portage/dbc`](sdk/dbc.md)

Security

- [Trust model](security/trust-model.md)

Architecture diagram: [static](architecture/portage-architecture.png), [interactive](architecture/portage-architecture.html). Narrative: `ARCHITECTURE.md`.
