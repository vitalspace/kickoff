"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PlayerStats, DEFAULT_PLAYER_STATS, SquadSlot } from "@/lib/game/constants";
import { useMarketStore, PlayerAttributes, Position } from "@/stores/useMarketStore";

const FORMATION_SLOTS: { index: number; position: Position }[] = [
  { index: 0, position: "GK" },
  { index: 1, position: "DEF" },
  { index: 2, position: "DEF" },
  { index: 3, position: "DEF" },
  { index: 4, position: "DEF" },
  { index: 5, position: "MID" },
  { index: 6, position: "MID" },
  { index: 7, position: "MID" },
];

const STAT_FLOOR = 75;

function nftToStats(nft: PlayerAttributes): PlayerStats {
  return {
    speed: Math.max(nft.speed, STAT_FLOOR),
    shooting: Math.max(nft.shooting, STAT_FLOOR),
    passing: Math.max(nft.passing, STAT_FLOOR),
    defense: Math.max(nft.defense, STAT_FLOOR),
    ability: nft.ability,
  };
}

function positionMatchesSlot(nftPos: Position, slotPos: Position): boolean {
  if (nftPos === slotPos) return true;
  if (nftPos === "FWD" && slotPos === "MID") return true;
  return false;
}

interface SquadState {
  slots: (number | undefined)[];
  setSlot: (index: number, tokenId: number | undefined) => void;
  autoFill: () => void;
  clearSquad: () => void;
  getStatsArray: () => (PlayerStats | undefined)[];
  getSlotDetails: () => SquadSlot[];
}

export const useSquadStore = create<SquadState>()(
  persist(
    (set, get) => ({
      slots: new Array(8).fill(undefined),

      setSlot: (index, tokenId) => {
        set((s) => {
          const newSlots = [...s.slots];
          newSlots[index] = tokenId;
          return { slots: newSlots };
        });
      },

      autoFill: () => {
        const current = [...get().slots];
        const myNfts = useMarketStore.getState().myNfts;
        const usedIds = new Set(current.filter((id): id is number => id !== undefined));

        for (const slot of FORMATION_SLOTS) {
          if (current[slot.index] !== undefined) continue;
          const match = myNfts.find(
            (nft) =>
              positionMatchesSlot(nft.position, slot.position) &&
              !usedIds.has(nft.tokenId),
          );
          if (match) {
            current[slot.index] = match.tokenId;
            usedIds.add(match.tokenId);
          }
        }

        set({ slots: current });
      },

      clearSquad: () => {
        set({ slots: new Array(8).fill(undefined) });
      },

      getStatsArray: () => {
        const { slots } = get();
        const myNfts = useMarketStore.getState().myNfts;
        return slots.map((tokenId) => {
          if (tokenId === undefined) return undefined;
          const nft = myNfts.find((n) => n.tokenId === tokenId);
          return nft ? nftToStats(nft) : undefined;
        });
      },

      getSlotDetails: (): SquadSlot[] => {
        const { slots } = get();
        const myNfts = useMarketStore.getState().myNfts;
        return FORMATION_SLOTS.map((formation) => {
          const tokenId = slots[formation.index];
          const nft = tokenId !== undefined ? myNfts.find((n) => n.tokenId === tokenId) : undefined;
          return {
            formationIndex: formation.index,
            position: formation.position,
            tokenId,
            stats: nft ? nftToStats(nft) : { ...DEFAULT_PLAYER_STATS },
          };
        });
      },
    }),
    {
      name: "kickoff3d_squad",
      version: 1,
    },
  ),
);
