"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { IdentifierString, Wallet, WalletAccount } from "@wallet-standard/base";

export interface DetectedWallet {
  name: string;
  icon: string;
  readonly handle: unknown;
}

export interface WalletState {
  wallets: DetectedWallet[];
  connected: { name: string; address: string } | null;
  connecting: boolean;
  error: string | null;
  connect(w: DetectedWallet): Promise<void>;
  disconnect(): Promise<void>;
  signAndSend(transactionBase64: string, chain?: IdentifierString): Promise<string>;
}

interface StandardConnectInput {
  readonly silent?: boolean;
}

interface StandardConnectOutput {
  readonly accounts: readonly WalletAccount[];
}

interface StandardConnectFeature {
  readonly version: "1.0.0";
  readonly connect: (input?: StandardConnectInput) => Promise<StandardConnectOutput>;
}

interface StandardDisconnectFeature {
  readonly version: "1.0.0";
  readonly disconnect: () => Promise<void>;
}

interface SolanaSignAndSendInput {
  readonly account: WalletAccount;
  readonly chain: IdentifierString;
  readonly transaction: Uint8Array;
}

interface SolanaSignAndSendOutput {
  readonly signature: Uint8Array;
}

interface SolanaSignAndSendFeature {
  readonly version: "1.0.0";
  readonly signAndSendTransaction: (
    ...inputs: readonly SolanaSignAndSendInput[]
  ) => Promise<readonly SolanaSignAndSendOutput[]>;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeroCount = 0;
  while (zeroCount < bytes.length && bytes[zeroCount] === 0) zeroCount += 1;
  if (zeroCount === bytes.length) return "1".repeat(zeroCount);
  const digits: number[] = [0];
  for (let i = zeroCount; i < bytes.length; i += 1) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j += 1) {
      const current = digits[j] as number;
      carry += current * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let encoded = "";
  for (let k = 0; k < zeroCount; k += 1) encoded += "1";
  for (let i = digits.length - 1; i >= 0; i -= 1) encoded += BASE58_ALPHABET[digits[i] as number] as string;
  return encoded;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isSolanaChain(chain: IdentifierString): boolean {
  return chain.startsWith("solana:");
}

function qualifies(wallet: Wallet): boolean {
  const features: Readonly<Record<IdentifierString, unknown>> = wallet.features;
  if (!("standard:connect" in features)) return false;
  if (!("solana:signAndSendTransaction" in features)) return false;
  return wallet.chains.some(isSolanaChain);
}

function toDetected(wallet: Wallet): DetectedWallet {
  return { name: wallet.name, icon: wallet.icon, handle: wallet };
}

/** Wallet-standard connect + sign-and-send. Mainnet unless the caller passes another chain. */
export function useWallet(): WalletState {
  const [detected, setDetected] = useState<DetectedWallet[]>([]);
  const [connected, setConnected] = useState<{ name: string; address: string } | null>(null);
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [activeAccount, setActiveAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect((): (() => void) => {
    const api = getWallets();
    const refresh = (): void => {
      setDetected(api.get().filter(qualifies).map(toDetected));
    };
    refresh();
    const offRegister = api.on("register", refresh);
    const offUnregister = api.on("unregister", refresh);
    return (): void => {
      offRegister();
      offUnregister();
    };
  }, []);

  const connect = useCallback(async (w: DetectedWallet): Promise<void> => {
    const wallet = w.handle as Wallet;
    setConnecting(true);
    setError(null);
    try {
      const feature = wallet.features["standard:connect"] as unknown as StandardConnectFeature | undefined;
      if (!feature) throw new Error("Wallet does not support standard:connect");
      const output = await feature.connect();
      const account = output.accounts.find((candidate) => candidate.chains.some(isSolanaChain));
      if (!account) throw new Error("No Solana account found in this wallet");
      setActiveWallet(wallet);
      setActiveAccount(account);
      setConnected({ name: wallet.name, address: account.address });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setActiveWallet(null);
      setActiveAccount(null);
      setConnected(null);
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    if (activeWallet !== null) {
      const feature = activeWallet.features["standard:disconnect"] as unknown as StandardDisconnectFeature | undefined;
      if (feature) {
        try {
          await feature.disconnect();
        } catch {
          // best-effort; still clear local state below
        }
      }
    }
    setActiveWallet(null);
    setActiveAccount(null);
    setConnected(null);
  }, [activeWallet]);

  const signAndSend = useCallback(
    async (transactionBase64: string, chain: IdentifierString = "solana:mainnet"): Promise<string> => {
      if (activeWallet === null || activeAccount === null || connected === null) {
        throw new Error("Connect a wallet first");
      }
      const feature = activeWallet.features["solana:signAndSendTransaction"] as unknown as
        | SolanaSignAndSendFeature
        | undefined;
      if (!feature) throw new Error("Wallet does not support solana:signAndSendTransaction");
      const transaction = base64ToBytes(transactionBase64);
      const outputs = await feature.signAndSendTransaction({
        account: activeAccount,
        chain,
        transaction,
      });
      const first = outputs[0];
      if (!first) throw new Error("Wallet returned no signature");
      return base58Encode(first.signature);
    },
    [activeWallet, activeAccount, connected],
  );

  return useMemo(
    (): WalletState => ({ wallets: detected, connected, connecting, error, connect, disconnect, signAndSend }),
    [detected, connected, connecting, error, connect, disconnect, signAndSend],
  );
}
