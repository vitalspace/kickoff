import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    walletAddress: v.string(),
    playerName: v.optional(v.string()),
    bio: v.optional(v.string()),
    teamName: v.optional(v.string()),
    teamColor: v.optional(v.string()),
    teamAccent: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),

  nfts: defineTable({
    walletAddress: v.string(),
    tokenId: v.number(),
    team: v.string(),
    position: v.string(),
    jerseyNumber: v.number(),
    rating: v.number(),
    speed: v.number(),
    shooting: v.number(),
    passing: v.number(),
    defense: v.number(),
    ability: v.optional(v.string()),
    mintedAt: v.number(),
    txHash: v.optional(v.string()),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_wallet_tokenId", ["walletAddress", "tokenId"]),

  leaderboards: defineTable({
    userId: v.optional(v.id("users")),
    playerName: v.optional(v.string()),
    teamId: v.string(),
    gameMode: v.optional(v.string()),
    won: v.boolean(),
    draw: v.optional(v.boolean()),
    score: v.object({ home: v.number(), away: v.number() }),
    timestamp: v.number(),
  }),

  bets: defineTable({
    walletAddress: v.string(),
    betId: v.number(),
    difficulty: v.string(),
    stakeWei: v.string(),
    status: v.string(), // "live" | "reported" | "settled" | "cancelled"
    playerWon: v.optional(v.boolean()),
    isDraw: v.optional(v.boolean()),
    payoutWei: v.optional(v.string()),
    feeWei: v.optional(v.string()),
    txHash: v.optional(v.string()),
    claimTxHash: v.optional(v.string()),
    createdAt: v.number(),
    reportedAt: v.optional(v.number()),
    settledAt: v.optional(v.number()),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_betId", ["betId"])
    .index("by_wallet_status", ["walletAddress", "status"]),

  listings: defineTable({
    walletAddress: v.string(),
    tokenId: v.number(),
    price: v.string(),
    sellerName: v.optional(v.string()),
    listedAt: v.number(),
    active: v.boolean(),
    attributes: v.optional(
      v.object({
        team: v.string(),
        position: v.string(),
        jerseyNumber: v.number(),
        rating: v.number(),
        speed: v.number(),
        shooting: v.number(),
        passing: v.number(),
        defense: v.number(),
        ability: v.optional(v.string()),
      }),
    ),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_active", ["active"])
    .index("by_wallet_tokenId", ["walletAddress", "tokenId"]),
});