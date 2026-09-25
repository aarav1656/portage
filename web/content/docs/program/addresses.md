> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Addresses

"Read" means a live RPC call on the date and slot given. "Derived" means computed from seeds with `PublicKey.findProgramAddressSync`, with no account on chain.

## Portage program

| Network | Address | State | Source |
|---|---|---|---|
| devnet | `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V` | Deployed at slot 503782830. Programdata `8YhNcVevdXmZmc9D44Ym6zmWxhc2qiaBRPe3fhPP5ia`, 332,933 bytes (45-byte header plus 332,888-byte program). Upgrade authority null | Read, devnet slot 503856806 |
| mainnet-beta | `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V` | No account | Read, mainnet slot 450271154 |
| localnet | `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V` | Whatever the local validator has | `Anchor.toml`, `declare_id!` in `programs/portage/src/lib.rs` |

Devnet deployer (from `DEVNET.md`): `97UHtes4coouNx5xAhYu6Ci6d75hgbyfaLuU9LDYBBHv`.

## Underlying mints (Tessera T-Tokens, mainnet)

Mint addresses are in `web/lib/tessera.ts`. All fields below read from mainnet on 2026-09-25, epoch 1042.

| Field | tKalshi | tOpenAI |
|---|---|---|
| Mint | `TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ` | `oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ` |
| Slot read | 450271291 | 450271293 |
| Owner | Token-2022 | Token-2022 |
| Decimals | 9 | 9 |
| Extensions | `transferFeeConfig`, `metadataPointer`, `tokenMetadata` | `transferFeeConfig`, `metadataPointer`, `tokenMetadata` |
| Transfer fee (older and newer) | 20 bps, `maximumFee` 18446744073709551615, since epoch 922 | 20 bps, `maximumFee` 18446744073709551615, since epoch 987 |
| Mint authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` |
| Freeze authority | `7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o` | `7n2PNcDXVDMK2m8dyV9cVPNY7p4jM4ZMHv7TzfibEt8o` |
| Transfer fee config authority | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` | `EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW` |
| Withdraw withheld authority | `5P6aL1imw2Vi7GptqoRHPu8fowJvXM8eVrs8nWnxVx5h` | `DjMKLEZe8d1nfCWQjoeoihqCU1owkxM8j2WqgFcCbzft` |

### Derived vault PDAs for the mainnet mints

Not initialised, since the program is not on mainnet. The same addresses would be used on any cluster where this program id is deployed.

| | tKalshi | tOpenAI |
|---|---|---|
| `vault` (bump) | `HXC9szVp21Zz3Y8ByuEw7Y3eQTVXp8tkXscKnzFM4GdA` (255) | `9aijsT3sBEzh1yCJTvJZLqeudMZAJnuFRR2uxPPgWM9c` (254) |
| `vault_token` | `8z8g2Tf9KAq2P5rEwWiDKuq8LoryUWmfFKmU2Qa8PufW` | `2HKPkuPURuREoJ2AH8hiWDQQPDrrXwtgVF3y1Wrdcb6k` |
| `wrapped_mint` | `3Q2YyQwqYyxLKb5yacCkjz7jYvop9YHA12AYh2ajjaah` | `ArUH4Ks2tZDFNRS9KrJskNCGFbP6h8NEHDD9au13XAEy` |

## Devnet run accounts

From `DEVNET.md`, confirmed where noted.

| Role | Address | Notes |
|---|---|---|
| Replica underlying (Token-2022) | `EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2` | Read devnet slot 503857874: 9 decimals, 20 bps fee, metadata "tKalshi (devnet replica)", freeze authority none, mint authority the deployer |
| `vault` | `81eLRVP1xQX1pNrvzn6rcLwdveL998G7h6jwGz2NeyWZ` | Read devnet slot 503856988 |
| `vault_token` | `3e75VsbsS1dgoL7Xz3Bz2X77GJzDJ2u91pGfSCSVFKKR` | Read, balance 89.8 |
| Wrapped mint | `NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi` | Read, supply 89.8 |
| DBC pool on the wrapped mint | `8GN2C1Ryn5hjLzAs9ncpYbNyXd63rynhv4E1KZRHpQ1Q` | From `DEVNET.md`, not re-read |

## External programs and mints

| Name | Address | Networks | Source |
|---|---|---|---|
| Meteora Dynamic Bonding Curve | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` | mainnet (simulated against 2026-09-25), devnet (executable, read slot 503856988) | `DEVNET.md`, `ARCHITECTURE.md`, sim logs |
| Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | all | IDL |
| Token (legacy SPL) | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | all | IDL |
| System | `11111111111111111111111111111111` | all | IDL |
| Associated Token Account | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | all | `packages/dbc/src/devnet.ts` |
| JitoSOL (mainnet stand-in quote for simulations) | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | mainnet | `packages/dbc/src/sim.ts`, `web/app/api/simulate/route.ts` |
| Simulation fee payer (never signs) | `5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9` | mainnet | same files |

## Off-chain endpoints

| Name | URL | Used by |
|---|---|---|
| Tessera token details (mark price) | `https://rest-api.tessera.pe/v1/public/token-details` | `TESSERA_API` in `packages/dbc/src/index.ts` |
| Default RPC, web app | `https://api.mainnet-beta.solana.com`, override with `SOLANA_RPC_URL` | `web/lib/rpc.ts` |
| Default RPC, `sim.ts` | `https://api.mainnet-beta.solana.com`, override with `RPC_URL` | `packages/dbc/src/sim.ts` |
| RPC, `devnet.ts` | `https://api.devnet.solana.com`, refuses any other genesis hash | `packages/dbc/src/devnet.ts` |
