"use client";

import { create } from "zustand";
import { NETWORK } from "@/lib/config/network";

interface WalletState {
  address: string;
  chainId: number | null;
  balance: string;
  isConnected: boolean;
  isConnecting: boolean;
  wrongChain: boolean;
  error: string | null;
  setWallet: (data: Partial<WalletState>) => void;
  reset: () => void;
}

const INITIAL: Pick<WalletState, "address" | "chainId" | "balance" | "isConnected" | "isConnecting" | "wrongChain" | "error"> = {
  address: "",
  chainId: null,
  balance: "0",
  isConnected: false,
  isConnecting: false,
  wrongChain: false,
  error: null,
};

export const useWalletStore = create<WalletState>((set) => ({
  ...INITIAL,

  setWallet: (data) =>
    set((s) => {
      const next = { ...s, ...data };
      if (data.chainId !== undefined && data.chainId !== null) {
        next.wrongChain = data.chainId !== NETWORK.chainId;
      }
      return next;
    }),

  reset: () => set(INITIAL),
}));
