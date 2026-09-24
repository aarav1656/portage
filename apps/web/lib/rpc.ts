import { Connection } from "@solana/web3.js";

export function rpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export function connection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}
