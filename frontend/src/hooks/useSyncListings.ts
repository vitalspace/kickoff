"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  useMarketStore,
  Listing,
  PlayerAttributes,
} from "@/stores/useMarketStore";

/**
 * Syncs marketplace listings from Convex into the Zustand market store.
 * Must be mounted once near the top of the component tree.
 */
export function useSyncListings() {
  const setListings = useMarketStore((s) => s.setListings);

  const convexListings = useQuery(api.listings.getActive, {});

  useEffect(() => {
    if (!convexListings) return;
    const mapped: Listing[] = convexListings.map((l) => ({
      tokenId: l.tokenId,
      seller: l.walletAddress,
      price: l.price,
      listedAt: l.listedAt,
      sellerName: l.sellerName,
      ...(l.attributes
        ? {
            attributes: {
              team: l.attributes.team as PlayerAttributes["team"],
              position: l.attributes.position as PlayerAttributes["position"],
              jerseyNumber: l.attributes.jerseyNumber,
              rating: l.attributes.rating,
              speed: l.attributes.speed,
              shooting: l.attributes.shooting,
              passing: l.attributes.passing,
              defense: l.attributes.defense,
              ...(l.attributes.ability
                ? {
                    ability: l.attributes
                      .ability as PlayerAttributes["ability"],
                  }
                : {}),
            },
          }
        : {}),
    }));
    setListings(mapped);
  }, [convexListings, setListings]);
}
