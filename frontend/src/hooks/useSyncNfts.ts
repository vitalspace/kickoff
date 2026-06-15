"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useMarketStore, PlayerAttributes } from "@/stores/useMarketStore";
import { useWalletStore } from "@/stores/useWalletStore";

/**
 * Syncs NFTs from Convex into the Zustand market store.
 * Must be mounted once near the top of the component tree.
 */
export function useSyncNfts() {
  const address = useWalletStore((s) => s.address);
  const isConnected = useWalletStore((s) => s.isConnected);
  const setMyNfts = useMarketStore((s) => s.setMyNfts);

  const convexNfts = useQuery(
    api.nfts.getByWallet,
    isConnected && address ? { walletAddress: address } : "skip"
  );

  useEffect(() => {
    if (!convexNfts) return;
    const mapped: PlayerAttributes[] = convexNfts.map((n) => ({
      tokenId: n.tokenId,
      team: n.team as PlayerAttributes["team"],
      position: n.position as PlayerAttributes["position"],
      jerseyNumber: n.jerseyNumber,
      rating: n.rating,
      speed: n.speed,
      shooting: n.shooting,
      passing: n.passing,
      defense: n.defense,
      ability: n.ability as PlayerAttributes["ability"] | undefined,
      mintedAt: n.mintedAt,
    }));
    setMyNfts(mapped);
  }, [convexNfts, setMyNfts]);
}
