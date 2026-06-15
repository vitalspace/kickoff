import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("nfts")
      .withIndex("by_wallet_tokenId", (q) =>
        q.eq("walletAddress", args.walletAddress).eq("tokenId", args.tokenId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        team: args.team,
        position: args.position,
        jerseyNumber: args.jerseyNumber,
        rating: args.rating,
        speed: args.speed,
        shooting: args.shooting,
        passing: args.passing,
        defense: args.defense,
        ability: args.ability,
        txHash: args.txHash,
      });
      return existing._id;
    }

    return await ctx.db.insert("nfts", args);
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nfts")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .collect();
  },
});

export const getByTokenId = query({
  args: {
    walletAddress: v.string(),
    tokenId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nfts")
      .withIndex("by_wallet_tokenId", (q) =>
        q.eq("walletAddress", args.walletAddress).eq("tokenId", args.tokenId)
      )
      .unique();
  },
});

export const remove = mutation({
  args: {
    walletAddress: v.string(),
    tokenId: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("nfts")
      .withIndex("by_wallet_tokenId", (q) =>
        q.eq("walletAddress", args.walletAddress).eq("tokenId", args.tokenId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("nfts").collect();
    for (const nft of all) await ctx.db.delete(nft._id);
    return { cleared: all.length };
  },
});
