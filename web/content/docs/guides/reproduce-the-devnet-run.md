> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Reproduce the devnet run

`DEVNET.md` records one complete run: deploy, a raw-quote DBC launch that fails, `init_vault`, `wrap`, a DBC launch quoted in the wrapped mint, a buy, `unwrap`, and making the program immutable. This page gives the commands to replay it and what each step shows.

The driver is `packages/dbc/src/devnet.ts`. It connects to `https://api.devnet.solana.com` and throws unless the genesis hash is `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` (devnet), so it cannot touch mainnet.

## What you can and cannot replay as-is

- The program does not need to be deployed again. The devnet program is immutable and its bytes match `target/deploy/portage.so` (SHA-256 `de7286a8d068ceba8fd18d314e337ec23588e551c950c0490a9dc86e8bc63e02`, both measured 2026-09-25). Steps 2 to 6 can run against it.
- The original replica `EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2` already has a vault, and only its mint authority (the original deployer) can mint more of it. To replay `init-vault` and fund your own wallet you need your own replica mint.
- Steps 1 and 7 (deploy, then remove the upgrade authority) apply only to a fresh program id, which means changing `declare_id!`, the `Anchor.toml` entry, and the IDL.

## Prerequisites

- Solana CLI and `spl-token` CLI (this page was checked against `solana-cli` 2.3.13 and `spl-token-cli` 5.3.0), Anchor 0.32.1, Node with pnpm.
- `pnpm install` at the repository root.
- A devnet keypair with SOL, for example `~/.config/solana/portage-devnet.json` (the path used in the header comment of `devnet.ts`).

Environment for every `devnet.ts` step:

```bash
export KEYPAIR=~/.config/solana/portage-devnet.json
export STATE=~/.config/solana/portage-devnet-state.json   # created if missing; records signatures and addresses
```

Steps 0, 1, and 7 run from the repository root; steps 3 to 6 run from `packages/dbc`.

## Step 0: confirm the program

```bash
solana program show AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V -u devnet
solana program dump -u devnet AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V /tmp/portage-devnet.so
anchor build && shasum -a 256 /tmp/portage-devnet.so target/deploy/portage.so
```

Proves: the program exists, has no upgrade authority, and (if the hashes match) runs this source. A hash mismatch after your own `anchor build` can come from a different toolchain rather than different source; the match reported here is with the `target/deploy/portage.so` present in this working tree.

## Step 2: a replica of tKalshi

The repository does not record the commands used to create the original replica. The replica's observable shape, read 2026-09-25 at devnet slot 503857874: Token-2022, 9 decimals, `transferFeeConfig` 20 bps with `maximumFee` 18446744073709551615, `metadataPointer` to itself, `tokenMetadata` name "tKalshi (devnet replica)" symbol "tKALSHI", no freeze authority. The following `spl-token` sequence targets that shape. It has not been run for this page:

```bash
solana config set --url devnet --keypair $KEYPAIR      # spl-token uses the CLI config for payer and authorities
spl-token create-token --program-2022 --decimals 9 \
  --transfer-fee-basis-points 20 --transfer-fee-maximum-fee 18446744073.709551615 --enable-metadata
spl-token initialize-metadata <MINT> "tKalshi (devnet replica)" tKALSHI ""
spl-token create-account <MINT>
spl-token mint <MINT> 1000
echo '{"replica":"<MINT>"}' > $STATE
```

`--transfer-fee-maximum-fee` takes a UI amount in `spl-token-cli` 5.3.0; the value above is `u64::MAX` base units at 9 decimals. `devnet.ts` reads the replica address from `state.replica` and falls back to `EsnR4vxz...` when it is absent.

The real tKalshi differs in one way that matters for [the trust model](../security/trust-model.md): it has a freeze authority. The replica does not.

## Steps 3 to 6

From `packages/dbc`:

| # | Command | Expected result | What it proves |
|---|---|---|---|
| 3 | `npx tsx src/devnet.ts raw-launch` | Transaction lands and fails. Original run: `Custom 6080 InvalidTokenBadge` | DBC refuses the raw fee-bearing mint as a quote. Sent with preflight skipped so the failure is recorded on chain. See [why the code differs from mainnet's 6081](../concepts/why-dbc-rejects-fee-quotes.md#devnet-returned-6080-not-6081) |
| 4a | `npx tsx src/devnet.ts init-vault` | ok | `init_vault` accepts a mint with `TransferFeeConfig`, `MetadataPointer`, `TokenMetadata`; creates the vault, `vault_token`, and wrapped mint |
| 4b | `npx tsx src/devnet.ts wrap` | 100 sent, `min_minted` 99.8, 99.800000000 minted, vault 99.800000000 | Minting is net of the fee, and an exact minimum passes |
| 5a | `npx tsx src/devnet.ts launch` | Config and pool created | DBC accepts the wrapped mint as a quote. Uses the live tKalshi mark unless `QUOTE_USD` is set; start $10,000, graduation $100,000 |
| 5b | `npx tsx src/devnet.ts buy` | 1 wrapped in, base tokens out. Original run: 31,186,470.580672 PTGD | A swap with the wrapped quote passes DBC's per-swap fee check |
| 6 | `npx tsx src/devnet.ts unwrap` | 10 burned, `min_out` 9.98, 9.980000000 received, vault 89.800000000 | The vault is debited the full amount, the fee is taken at the recipient, the minimum holds |

Each step prints its signature and writes it to `$STATE`. The `wrap`, `buy`, and `unwrap` steps also record measured balances there.

## Invariant after the run

```bash
spl-token -u devnet supply <WRAPPED_MINT>
spl-token -u devnet balance --address <VAULT_TOKEN>
```

`<WRAPPED_MINT>` and `<VAULT_TOKEN>` are `vaultAddresses(replica)` from `@portage/vault`; for the original replica they are `NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi` and `3e75VsbsS1dgoL7Xz3Bz2X77GJzDJ2u91pGfSCSVFKKR`. Both read 89.8 on 2026-09-25 (devnet slot 503856988): 88.8 held by the deployer and 1.0 in the DBC pool, per `DEVNET.md`.

## Steps 1 and 7, fresh program id only

```bash
solana-keygen new -o target/deploy/portage-keypair.json --force   # new program id
anchor keys sync                                                    # rewrites declare_id! to the new key; check Anchor.toml too
anchor build
cp target/idl/portage.json packages/vault/src/idl.json              # packages/vault reads the id from the IDL
solana program deploy -u devnet --keypair $KEYPAIR --program-id target/deploy/portage-keypair.json target/deploy/portage.so
# ... steps 2 to 6 ...
solana program set-upgrade-authority -u devnet --keypair $KEYPAIR <PROGRAM_ID> --final
solana program show -u devnet <PROGRAM_ID>                            # Authority: none
```

`--final` is irreversible. Overwriting `target/deploy/portage-keypair.json` discards the key for the existing id; keep a copy if you need it. Original run: deploy slot 503782830, authority removed at slot 503813651 (`DEVNET.md`).
