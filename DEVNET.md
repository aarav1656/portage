# Portage on devnet

**This is devnet, run against a replica mint.** tKalshi does not exist on devnet, so step 2 creates a Token-2022 replica with the same shape: 9 decimals, a 20 bps transfer fee, and a metadata pointer. The mainnet path is proven separately by live simulation against the real tKalshi mint (`packages/dbc/src/sim.ts`). Nothing in this run touched mainnet.

- Program: [`AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`](https://explorer.solana.com/address/AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V?cluster=devnet), 332,888 bytes, deployed in slot **503782830**. The upgrade authority is now **none** (final).
- Deployer: `97UHtes4coouNx5xAhYu6Ci6d75hgbyfaLuU9LDYBBHv`
- Replica mint (Token-2022): [`EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2`](https://explorer.solana.com/address/EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2?cluster=devnet), named "tKalshi (devnet replica)"
- Wrapped mint (legacy SPL, vault PDA): [`NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi`](https://explorer.solana.com/address/NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi?cluster=devnet)
- Meteora DBC: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
- Script: `packages/dbc/src/devnet.ts` (it refuses to run unless the genesis hash is devnet's)

| Step | What | Slot | Signature | Result |
|---|---|---|---|---|
| 1 | Deploy program | 503782830 | [`2jbxWRNXxA5J...`](https://explorer.solana.com/tx/2jbxWRNXxA5JLstSp7goeRwvq3NxX5SGJzgDhA53DqFKn8ipTSmYbQzCfDtdqQD6TobU8YbwXy8i1DgT1saRfy88?cluster=devnet) | 332,888 bytes |
| 2a | Create replica mint (metadata pointer, 20 bps fee, 9 decimals) | 503782911 | [`5Lm9Z985R9bn...`](https://explorer.solana.com/tx/5Lm9Z985R9bnAQTbXRpemEmSMCUuehYP4QbZNMABWMcZ989nC4B3U1Dj6mHVnf5juW5WhHkvVtQxtEkhkV3FMd6K?cluster=devnet) | ok |
| 2b | Initialize token metadata | 503782945 | [`HmxZJj1CuaJE...`](https://explorer.solana.com/tx/HmxZJj1CuaJEYP5y33Lr7nmi2pg3uAfrSK9rRco6nMCJ6hWWZQH8iFGfjf6YCDEeT2KJQTq6QXqH4zuKKdeGGAz?cluster=devnet) | ok |
| 2c | Create deployer ATA | 503782988 | [`e7yR3mtSZNj5...`](https://explorer.solana.com/tx/e7yR3mtSZNj57VzEFnA9Kcy3FwGAwr1Dp7j76gGggacMarycbooSysdxdLHmyGhfoKi36uak9SE8aUB82QrJUwp?cluster=devnet) | ok |
| 2d | Mint 1000 replica to deployer | 503783213 | [`2xSG28mCD3uV...`](https://explorer.solana.com/tx/2xSG28mCD3uVJaD4ekb4yT1NmEKHGtze2cxFg2ignRPFaJxZnPDKzVFCfpBTGD5odSbpVoF8WoTuEYZjiUQamFCA?cluster=devnet) | 1000.000000000 |
| 3 | DBC config + pool quoted in the **raw replica** | 503805273 | [`5ayYNhV7MSi5...`](https://explorer.solana.com/tx/5ayYNhV7MSi5vqP5tcyLunnhYZoP1irMRNVq4Lf1nCGnMcA1wH1yAWpc4KtXTPnmLbe6hiAsZokJNpYv3PSzoiQk?cluster=devnet) | **Failed on chain: Custom 6080 `InvalidTokenBadge`** (see below) |
| 4a | `init_vault` | 503805338 | [`4Loijq4HadAc...`](https://explorer.solana.com/tx/4Loijq4HadAcmLYiQ33hmDkTioQnuNEExxMkfncwGXX2mQdvh86dGtuPaeFR9rrPpWnzSuRYzuaNgzZo5tKXKLWQ?cluster=devnet) | ok |
| 4b | `wrap` 100, min_minted 99.8 | 503805367 | [`55NGuYcs2iyN...`](https://explorer.solana.com/tx/55NGuYcs2iyNdMUKVLcEKYdb446CdYgQBS7ifVZmAfytUk2boo934nZQFGb9iMwLUyGWpv9q1WnccawSxtPjCD5K?cluster=devnet) | Spent 100. Minted **99.800000000**. Vault **99.800000000** |
| 5a | DBC config + pool quoted in the **wrapped mint** | 503813433 | [`3Ekh79t4kNMW...`](https://explorer.solana.com/tx/3Ekh79t4kNMWrQNst2cYiyhGTGcqXQdb9n6w45Cw5ugjXK6ovZMPMbo2hWLKvSoGkS4xSL4xF5Jt1pQrLj7zwLRt?cluster=devnet) | Pool [`8GN2C1Ry...`](https://explorer.solana.com/address/8GN2C1Ryn5hjLzAs9ncpYbNyXd63rynhv4E1KZRHpQ1Q?cluster=devnet), config `2aK9Cuwn...` |
| 5b | Buy: 1 wrapped in | 503813501 | [`4aw5qtUvAUvy...`](https://explorer.solana.com/tx/4aw5qtUvAUvy1xCkHnN9C1rwdF47chafnZRURPjFAfNwKe1TnjCa1tY6TVcEzM9xbFfEhXkCXbFtAffdtQceriAZ?cluster=devnet) | 1.000000000 in. **31,186,470.580672** PTGD out |
| 6 | `unwrap` 10, min_out 9.98 | 503813564 | [`5eFhd7F9mqQT...`](https://explorer.solana.com/tx/5eFhd7F9mqQTqnhAT1Nt7AdwAmoEtGbcnZeX7ScusMNg4MsKWdKw1fJkLasP4J4jDK9qURUQD8S9hwEmxQCv2bfH?cluster=devnet) | Received **9.980000000**. Vault is now 89.800000000 |
| 7 | Upgrade authority set to final | 503813651 | [`3xxKiV2Gs5UX...`](https://explorer.solana.com/tx/3xxKiV2Gs5UXxb9nztEXRMDGkQSXWC3fsUx79HiEbzY479piYAdVotn65RZKQD6wGCAZqwpkiD24nFy8t9TcopKz?cluster=devnet) | `solana program show` reports Authority: none |

## Step 3: the error devnet actually returned

We expected `6081 QuoteMintHasNonZeroTransferFee`. Devnet returned a different error:

```
Program log: AnchorError occurred. Error Code: InvalidTokenBadge. Error Number: 6080. Error Message: Invalid token badge.
Program dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN failed: custom program error: 0x17c0
```

DBC checks for a token badge before it checks the transfer fee. A Token-2022 quote mint with extensions and no Meteora-issued badge is rejected at that first gate. Either way the result is the same: a raw fee-bearing Token-2022 mint cannot be a DBC quote. This transaction was sent with preflight skipped so that the failure is recorded on chain.

## Invariant after the run

The wrapped supply is 89.8 (`spl-token supply NrZEkPZm...`), which equals the vault's 89.8 replica. That 89.8 is split into 88.8 held by the deployer and 1.0 in the DBC pool. Each leg paid the 20 bps fee: 100 became 99.8 on the way in, and 10 became 9.98 on the way out.
