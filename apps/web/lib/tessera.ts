import { PublicKey } from "@solana/web3.js";

/**
 * The two Tessera pre-IPO tokens Portage wraps. Mint addresses are public,
 * live mainnet addresses (from https://rest-api.tessera.pe/v1/public/token-details),
 * not secrets.
 */
export const TESSERA_TOKENS = {
  Kalshi: {
    code: "tKalshi",
    label: "T-Kalshi",
    mint: new PublicKey("TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ"),
  },
  OpenAI: {
    code: "tOpenAI",
    label: "T-OpenAI",
    mint: new PublicKey("oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ"),
  },
} as const;

export type TesseraKey = keyof typeof TESSERA_TOKENS;

export function isTesseraKey(value: string): value is TesseraKey {
  return value === "Kalshi" || value === "OpenAI";
}
