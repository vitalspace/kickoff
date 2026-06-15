"use client";

import { create } from "zustand";

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type TeamSide = "HOME" | "AWAY";
export type Ability =
  | "SWIFT"
  | "POWER_SHOT"
  | "WALL"
  | "MAESTRO"
  | "CLUTCH"
  | "RUSH";
export type StatKey = "speed" | "shooting" | "passing" | "defense";

export type StatBonuses = Partial<Record<StatKey, number>>;

export interface AbilityConfig {
  id: Ability;
  label: string;
  description: string;
  bonuses: StatBonuses;
  color: string;
}

export const ABILITIES: Record<Ability, AbilityConfig> = {
  SWIFT: {
    id: "SWIFT",
    label: "SWIFT",
    description: "Run 0.5× faster",
    bonuses: { speed: 5 },
    color: "#3B82F6",
  },
  POWER_SHOT: {
    id: "POWER_SHOT",
    label: "POWER SHOT",
    description: "Shots hit 5% harder",
    bonuses: { shooting: 5 },
    color: "#EF4444",
  },
  WALL: {
    id: "WALL",
    label: "WALL",
    description: "Stand tall at the back",
    bonuses: { defense: 8 },
    color: "#F59E0B",
  },
  MAESTRO: {
    id: "MAESTRO",
    label: "MAESTRO",
    description: "Always finds the open man",
    bonuses: { passing: 10 },
    color: "#A855F7",
  },
  CLUTCH: {
    id: "CLUTCH",
    label: "CLUTCH",
    description: "Raises every stat under pressure",
    bonuses: { speed: 3, shooting: 3, passing: 3, defense: 3 },
    color: "#06B6D4",
  },
  RUSH: {
    id: "RUSH",
    label: "RUSH",
    description: "Speed and shooting in one package",
    bonuses: { speed: 3, shooting: 3 },
    color: "#10B981",
  },
};

const ABILITY_KEYS: Ability[] = [
  "SWIFT",
  "POWER_SHOT",
  "WALL",
  "MAESTRO",
  "CLUTCH",
  "RUSH",
];
const ABILITY_CHANCE = 0.06; // 6% per ability, mutually exclusive (~36% total)

export function rollAbility(): Ability | null {
  const r = Math.random();
  for (let i = 0; i < ABILITY_KEYS.length; i++) {
    if (r < ABILITY_CHANCE * (i + 1)) return ABILITY_KEYS[i];
  }
  return null;
}

export interface PlayerAttributes {
  tokenId: number;
  team: TeamSide;
  position: Position;
  jerseyNumber: number;
  rating: number;
  speed: number;
  shooting: number;
  passing: number;
  defense: number;
  ability?: Ability;
  mintedAt: number;
}

export interface Listing {
  tokenId: number;
  seller: string;
  price: string;
  listedAt: number;
  sellerName?: string;
  attributes?: Omit<PlayerAttributes, "tokenId" | "mintedAt">;
}

interface MarketState {
  myNfts: PlayerAttributes[];
  listings: Listing[];
  mintCard: (card: Omit<PlayerAttributes, "tokenId" | "mintedAt">) => number;
  addMintedCard: (card: PlayerAttributes) => void;
  setMyNfts: (nfts: PlayerAttributes[]) => void;
  setListings: (listings: Listing[]) => void;
  listNft: (tokenId: number, price: string) => void;
  updateListing: (tokenId: number, price: string) => void;
  cancelListing: (tokenId: number) => void;
  buyListing: (tokenId: number, buyer: string) => void;
  reset: () => void;
}

const POSITION_DISTRIBUTION: Position[] = [
  "GK",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "FWD",
  "FWD",
  "FWD",
];

function rollInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPosition(): Position {
  const idx = Math.floor(Math.random() * POSITION_DISTRIBUTION.length);
  return POSITION_DISTRIBUTION[idx];
}

function generateAttributes(
  seed: number,
  position: Position,
): Omit<PlayerAttributes, "tokenId" | "mintedAt"> {
  const rating = rollInt(80, 85);
  const variance = () => rollInt(-5, 10);
  const cap = (v: number) => Math.max(75, Math.min(85, v));
  const base = position === "GK" ? 75 : position === "DEF" ? 77 : position === "MID" ? 79 : 80;
  const speed =
    position === "GK" ? cap(base + variance()) : cap(base + rollInt(2, 15) + variance());
  const shooting =
    position === "FWD" ? cap(base + 3 + rollInt(2, 12) + variance()) : cap(base - 2 + variance());
  const passing =
    position === "MID" || position === "FWD"
      ? cap(base + rollInt(2, 12) + variance())
      : cap(base - 2 + variance());
  const defense =
    position === "DEF" || position === "GK"
      ? cap(base + rollInt(2, 12) + variance())
      : cap(base - 3 + variance());

  return {
    team: seed % 2 === 0 ? "HOME" : "AWAY",
    position,
    jerseyNumber: rollInt(1, 11),
    rating,
    speed,
    shooting,
    passing,
    defense,
    ability: rollAbility() ?? undefined,
  };
}

const SEED_LISTING_ATTRS: Record<number, Omit<PlayerAttributes, "tokenId" | "mintedAt">> = {
  9001: { team: "HOME", position: "FWD", jerseyNumber: 9, rating: 85, speed: 83, shooting: 85, passing: 80, defense: 75, ability: "SWIFT" },
  9002: { team: "AWAY", position: "MID", jerseyNumber: 10, rating: 85, speed: 80, shooting: 78, passing: 85, defense: 76, ability: "POWER_SHOT" },
  9003: { team: "HOME", position: "DEF", jerseyNumber: 4, rating: 82, speed: 78, shooting: 75, passing: 77, defense: 85 },
  9004: { team: "AWAY", position: "GK", jerseyNumber: 1, rating: 85, speed: 76, shooting: 75, passing: 76, defense: 85, ability: "WALL" },
};

let nextTokenId = 9100;

export const useMarketStore = create<MarketState>()(
  (set, get) => ({
    myNfts: [],
    listings: [],

    mintCard: (card) => {
      const existingIds = new Set(get().myNfts.map((n) => n.tokenId));
      while (existingIds.has(nextTokenId)) nextTokenId++;
      const tokenId = nextTokenId++;
      const mintedAt = Date.now();
      set((s) => ({
        myNfts: [...s.myNfts, { ...card, tokenId, mintedAt }],
      }));
      return tokenId;
    },

    /**
     * Replaces the entire myNfts array (used by Convex sync).
     */
    setMyNfts: (nfts) => set({ myNfts: nfts }),

    setListings: (listings) => set({ listings }),

    /**
     * Inserts a card that was minted on-chain (so the tokenId comes
     * from the contract, not the local counter). Skips if the card is
     * already present locally.
     */
    addMintedCard: (card) => {
      set((s) => {
        if (s.myNfts.some((n) => n.tokenId === card.tokenId)) return s;
        return { myNfts: [...s.myNfts, card] };
      });
    },

    listNft: (tokenId, price) => {
      const nft = get().myNfts.find((n) => n.tokenId === tokenId);
      if (!nft) return;
      set((s) => ({
        listings: [
          ...s.listings,
          {
            tokenId,
            seller: "you",
            price,
            listedAt: Date.now(),
          },
        ],
      }));
    },

    updateListing: (tokenId, price) => {
      set((s) => ({
        listings: s.listings.map((l) =>
          l.tokenId === tokenId ? { ...l, price } : l,
        ),
      }));
    },

    cancelListing: (tokenId) => {
      set((s) => ({
        listings: s.listings.filter((l) => l.tokenId !== tokenId),
      }));
    },

    buyListing: (tokenId, buyer) => {
      const listing = get().listings.find((l) => l.tokenId === tokenId);
      if (!listing) return;
      const attrs = SEED_LISTING_ATTRS[tokenId];
      if (!attrs) return;
      set((s) => ({
        myNfts: [
          ...s.myNfts,
          { ...attrs, tokenId, mintedAt: Date.now() },
        ],
        listings: s.listings.filter((l) => l.tokenId !== tokenId),
      }));
      void buyer;
    },

    reset: () =>
      set({
        myNfts: [],
        listings: [],
      }),
  }),
);

export function rollMintCard(): Omit<PlayerAttributes, "tokenId" | "mintedAt"> {
  return generateAttributes(Date.now(), randomPosition());
}

export function getListingAttributes(tokenId: number): Omit<PlayerAttributes, "tokenId" | "mintedAt"> | null {
  return SEED_LISTING_ATTRS[tokenId] ?? null;
}
