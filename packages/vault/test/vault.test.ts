import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Clock, FailedTransactionMetadata, LiteSVM } from "litesvm";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ExtensionType,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  calculateEpochFee,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferFeeConfigInstruction,
  createMintToInstruction,
  getMintLen,
  getTransferFeeConfig,
  unpackMint,
} from "@solana/spl-token";
import {
  PORTAGE_PROGRAM_ID,
  initVaultIx,
  unwrapIx,
  userAccounts,
  vaultAddresses,
  wrapIx,
} from "../src/index.js";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const fixture = JSON.parse(readFileSync(here("./fixtures/tkalshi-mint.json"), "utf8"));
const TKALSHI = new PublicKey(fixture.pubkey);
const MAINNET_EPOCH = 1041n; // getEpochInfo at fixture slot 449987467
const PROGRAM_SO = process.env.PORTAGE_SO ?? here("../../../target/deploy/portage.so");

let svm: LiteSVM;
const payer = Keypair.generate();

function send(ixs: TransactionInstruction[], signers: Keypair[] = [payer]) {
  svm.expireBlockhash();
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signers[0]!.publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(...signers);
  return svm.sendTransaction(tx);
}

function ok(res: ReturnType<typeof send>) {
  if (res instanceof FailedTransactionMetadata) {
    throw new Error(`tx failed: ${res.toString()}\n${res.meta().logs().join("\n")}`);
  }
  return res;
}

function fails(res: ReturnType<typeof send>, needle: string) {
  expect(res).toBeInstanceOf(FailedTransactionMetadata);
  const logs = (res as FailedTransactionMetadata).meta().logs().join("\n");
  expect(logs).toContain(needle);
  return logs;
}

const amountOf = (acct: PublicKey) => Buffer.from(svm.getAccount(acct)!.data).readBigUInt64LE(64);
const supplyOf = (mint: PublicKey) => Buffer.from(svm.getAccount(mint)!.data).readBigUInt64LE(36);

function mintInfo(address: PublicKey) {
  const a = svm.getAccount(address)!;
  return unpackMint(address, { ...a, data: Buffer.from(a.data) }, TOKEN_2022_PROGRAM_ID);
}
const fee = (amount: bigint) =>
  calculateEpochFee(getTransferFeeConfig(mintInfo(TKALSHI))!, MAINNET_EPOCH, amount);

/** Creates a user with a funded tKalshi ATA. The balance is written directly since the mint authority is Tessera's. */
function newUser(tkalshi: bigint) {
  const kp = Keypair.generate();
  svm.airdrop(kp.publicKey, 10_000_000_000n);
  const { userUnderlying, userWrapped } = userAccounts(kp.publicKey, TKALSHI);
  const { wrappedMint } = vaultAddresses(TKALSHI);
  ok(
    send(
      [
        createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, userUnderlying, kp.publicKey, TKALSHI, TOKEN_2022_PROGRAM_ID),
        createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, userWrapped, kp.publicKey, wrappedMint, TOKEN_PROGRAM_ID),
      ],
      [kp],
    ),
  );
  const acct = svm.getAccount(userUnderlying)!;
  const data = Buffer.from(acct.data);
  data.writeBigUInt64LE(tkalshi, 64);
  svm.setAccount(userUnderlying, { ...acct, data });
  return { kp, userUnderlying, userWrapped };
}

function state() {
  const v = vaultAddresses(TKALSHI);
  return { vault: amountOf(v.vaultToken), supply: supplyOf(v.wrappedMint) };
}

function assertInvariant() {
  const s = state();
  expect(s.supply <= s.vault).toBe(true);
}

beforeAll(() => {
  svm = new LiteSVM();
  svm.addProgramFromFile(PORTAGE_PROGRAM_ID, PROGRAM_SO);
  svm.setAccount(TKALSHI, {
    lamports: fixture.lamports,
    data: Buffer.from(fixture.data, "base64"),
    owner: new PublicKey(fixture.owner),
    executable: false,
  });
  const c = svm.getClock();
  svm.setClock(new Clock(c.slot, c.epochStartTimestamp, MAINNET_EPOCH, MAINNET_EPOCH, c.unixTimestamp));
  svm.airdrop(payer.publicKey, 100_000_000_000n);
  ok(send([initVaultIx(payer.publicKey, TKALSHI)]));
});

describe("portage vault on the real tKalshi mint", () => {
  it("fixture is the live mainnet config: Token-2022, 9 decimals, 20 bps fee", () => {
    const m = mintInfo(TKALSHI);
    const cfg = getTransferFeeConfig(m)!;
    expect(m.decimals).toBe(9);
    expect(cfg.newerTransferFee.transferFeeBasisPoints).toBe(20);
    expect(fee(1_000_000_000n)).toBe(2_000_000n);
    const v = vaultAddresses(TKALSHI);
    const wrapped = svm.getAccount(v.wrappedMint)!;
    expect(wrapped.owner.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(wrapped.data.length).toBe(MINT_SIZE); // legacy mint, zero extensions
    expect(Buffer.from(wrapped.data)[44]).toBe(9); // decimals
    expect(new PublicKey(Buffer.from(wrapped.data).subarray(4, 36)).equals(v.vault)).toBe(true); // mint authority
    expect(Buffer.from(wrapped.data).readUInt32LE(46)).toBe(0); // no freeze authority
  });

  it("wrap then unwrap round trip, fee exact to the base unit", () => {
    const start = 1_234_567_891n;
    const u = newUser(start);
    const before = state();

    const sent = 1_234_567_891n;
    const wrapFee = fee(sent);
    expect(wrapFee).toBe(2_469_136n); // ceil(1_234_567_891 * 20 / 10_000)
    ok(send([wrapIx(u.kp.publicKey, TKALSHI, sent)], [u.kp]));
    const minted = sent - wrapFee;
    expect(amountOf(u.userWrapped)).toBe(minted);
    expect(amountOf(u.userUnderlying)).toBe(start - sent);
    expect(state()).toEqual({ vault: before.vault + minted, supply: before.supply + minted });
    assertInvariant();

    const back = minted;
    const unwrapFee = fee(back);
    ok(send([unwrapIx(u.kp.publicKey, TKALSHI, back)], [u.kp]));
    expect(amountOf(u.userWrapped)).toBe(0n);
    expect(amountOf(u.userUnderlying)).toBe(back - unwrapFee);
    expect(state()).toEqual(before);
    assertInvariant();
    console.log(
      `round trip: sent ${sent}, wrap fee ${wrapFee}, minted ${minted}, unwrap fee ${unwrapFee}, user got back ${back - unwrapFee} (lost ${sent - (back - unwrapFee)} base units)`,
    );
  });

  it("invariant holds across many wrap/unwrap cycles with odd amounts", () => {
    const users = [newUser(10n ** 15n), newUser(10n ** 15n), newUser(10n ** 15n)];
    let x = 987_654_321n;
    for (let i = 0; i < 30; i++) {
      x = (x * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      const u = users[i % users.length]!;
      const held = amountOf(u.userWrapped);
      if (i % 3 === 2 && held > 0n) {
        const amt = (x % held) + 1n;
        const pre = amountOf(u.userUnderlying);
        ok(send([unwrapIx(u.kp.publicKey, TKALSHI, amt)], [u.kp]));
        expect(amountOf(u.userUnderlying) - pre).toBe(amt - fee(amt));
      } else {
        const amt = (x % 5_000_000_000_000n) + 600n;
        const preW = amountOf(u.userWrapped);
        ok(send([wrapIx(u.kp.publicKey, TKALSHI, amt)], [u.kp]));
        expect(amountOf(u.userWrapped) - preW).toBe(amt - fee(amt));
      }
      assertInvariant();
    }
    const s = state();
    console.log(`after 30 cycles: vault ${s.vault}, wrapped supply ${s.supply}`);
  });

  it("unwrap more than owned fails", () => {
    const u = newUser(5_000_000_000n);
    ok(send([wrapIx(u.kp.publicKey, TKALSHI, 5_000_000_000n)], [u.kp]));
    const held = amountOf(u.userWrapped);
    const before = state();
    fails(send([unwrapIx(u.kp.publicKey, TKALSHI, held + 1n)], [u.kp]), "insufficient funds");
    expect(state()).toEqual(before);
  });

  it("cannot unwrap someone else's wrapped tokens", () => {
    const victim = newUser(5_000_000_000n);
    ok(send([wrapIx(victim.kp.publicKey, TKALSHI, 5_000_000_000n)], [victim.kp]));
    const thief = newUser(0n);
    fails(
      send([unwrapIx(thief.kp.publicKey, TKALSHI, 1_000n, { user_wrapped: victim.userWrapped })], [thief.kp]),
      "ConstraintTokenOwner",
    );
  });

  it("substituted vault token account, wrapped mint, or vault is rejected", () => {
    const u = newUser(5_000_000_000n);
    const attacker = Keypair.generate();
    svm.airdrop(attacker.publicKey, 10_000_000_000n);

    // Attacker-owned tKalshi account posing as the vault: deposit would stay with the attacker.
    const fakeVaultToken = userAccounts(attacker.publicKey, TKALSHI).userUnderlying;
    ok(send([createAssociatedTokenAccountIdempotentInstruction(attacker.publicKey, fakeVaultToken, attacker.publicKey, TKALSHI, TOKEN_2022_PROGRAM_ID)], [attacker]));
    fails(send([wrapIx(u.kp.publicKey, TKALSHI, 1_000_000n, { vault_token: fakeVaultToken })], [u.kp]), "ConstraintHasOne");
    fails(send([unwrapIx(u.kp.publicKey, TKALSHI, 1_000n, { vault_token: fakeVaultToken })], [u.kp]), "ConstraintHasOne");

    // Attacker-controlled legacy mint posing as the wrapped mint.
    const fakeMint = Keypair.generate();
    const rent = Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE)));
    ok(
      send(
        [
          SystemProgram.createAccount({ fromPubkey: attacker.publicKey, newAccountPubkey: fakeMint.publicKey, lamports: rent, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
          createInitializeMint2Instruction(fakeMint.publicKey, 9, attacker.publicKey, null, TOKEN_PROGRAM_ID),
        ],
        [attacker, fakeMint],
      ),
    );
    fails(send([wrapIx(u.kp.publicKey, TKALSHI, 1_000_000n, { wrapped_mint: fakeMint.publicKey })], [u.kp]), "ConstraintHasOne");

    // A genuine vault for a different fee-bearing mint, passed alongside tKalshi accounts.
    const other = feeMint(attacker, 9, 20);
    ok(send([initVaultIx(attacker.publicKey, other)], [attacker]));
    fails(
      send([unwrapIx(u.kp.publicKey, TKALSHI, 1_000n, { vault: vaultAddresses(other).vault })], [u.kp]),
      "ConstraintSeeds",
    );
  });

  it("minting without a deposit is impossible", () => {
    const u = newUser(10n);
    const { wrappedMint } = vaultAddresses(TKALSHI);
    const before = state();
    // 1 base unit pays a 1 unit fee: vault receives 0, so nothing may be minted.
    expect(fee(1n)).toBe(1n);
    fails(send([wrapIx(u.kp.publicKey, TKALSHI, 1n)], [u.kp]), "NothingReceived");
    // Wrap with an empty source account.
    const broke = newUser(0n);
    fails(send([wrapIx(broke.kp.publicKey, TKALSHI, 1_000n)], [broke.kp]), "insufficient funds");
    // Direct MintTo signed by anyone but the vault PDA.
    fails(send([createMintToInstruction(wrappedMint, u.userWrapped, u.kp.publicKey, 1_000n)], [u.kp]), "owner does not match");
    expect(state()).toEqual(before);
    expect(amountOf(u.userWrapped)).toBe(0n);
  });

  it("init_vault refuses an underlying with a permanent delegate", () => {
    const attacker = Keypair.generate();
    svm.airdrop(attacker.publicKey, 10_000_000_000n);
    const mint = Keypair.generate();
    const len = getMintLen([ExtensionType.PermanentDelegate]);
    ok(
      send(
        [
          SystemProgram.createAccount({ fromPubkey: attacker.publicKey, newAccountPubkey: mint.publicKey, lamports: Number(svm.minimumBalanceForRentExemption(BigInt(len))), space: len, programId: TOKEN_2022_PROGRAM_ID }),
          createInitializePermanentDelegateInstruction(mint.publicKey, attacker.publicKey, TOKEN_2022_PROGRAM_ID),
          createInitializeMint2Instruction(mint.publicKey, 6, attacker.publicKey, null, TOKEN_2022_PROGRAM_ID),
        ],
        [attacker, mint],
      ),
    );
    fails(send([initVaultIx(attacker.publicKey, mint.publicKey)], [attacker]), "UnsupportedUnderlying");
  });
});

function feeMint(authority: Keypair, decimals: number, bps: number) {
  const mint = Keypair.generate();
  const len = getMintLen([ExtensionType.TransferFeeConfig]);
  ok(
    send(
      [
        SystemProgram.createAccount({ fromPubkey: authority.publicKey, newAccountPubkey: mint.publicKey, lamports: Number(svm.minimumBalanceForRentExemption(BigInt(len))), space: len, programId: TOKEN_2022_PROGRAM_ID }),
        createInitializeTransferFeeConfigInstruction(mint.publicKey, authority.publicKey, authority.publicKey, bps, 2n ** 64n - 1n, TOKEN_2022_PROGRAM_ID),
        createInitializeMint2Instruction(mint.publicKey, decimals, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
      ],
      [authority, mint],
    ),
  );
  return mint.publicKey;
}
