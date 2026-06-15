import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Backfill missing `attributes` on the fly by joining against the
    // seller's `nfts` row. Keeps old listings (created before the
    // denormalised attrs landed) visible in the marketplace UI.
    return await Promise.all(
      rows.map(async (l) => {
        if (l.attributes) return l;
        const nft = await ctx.db
          .query("nfts")
          .withIndex("by_wallet_tokenId", (q) =>
            q.eq("walletAddress", l.walletAddress).eq("tokenId", l.tokenId)
          )
          .unique();
        if (!nft) return l;
        return {
          ...l,
          attributes: {
            team: nft.team,
            position: nft.position,
            jerseyNumber: nft.jerseyNumber,
            rating: nft.rating,
            speed: nft.speed,
            shooting: nft.shooting,
            passing: nft.passing,
            defense: nft.defense,
            ability: nft.ability,
          },
        };
      })
    );
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .collect();
  },
});

export const create = mutation({
  args: {
    walletAddress: v.string(),
    tokenId: v.number(),
    price: v.string(),
    sellerName: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_wallet_tokenId", (q) =>
        q.eq("walletAddress", args.walletAddress).eq("tokenId", args.tokenId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        price: args.price,
        sellerName: args.sellerName,
        attributes: args.attributes,
        active: true,
        listedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("listings", {
      walletAddress: args.walletAddress,
      tokenId: args.tokenId,
      price: args.price,
      sellerName: args.sellerName,
      attributes: args.attributes,
      listedAt: Date.now(),
      active: true,
    });
  },
});

export const cancel = mutation({
  args: {
    walletAddress: v.string(),
    tokenId: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_wallet_tokenId", (q) =>
        q.eq("walletAddress", args.walletAddress).eq("tokenId", args.tokenId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { active: false });
      return true;
    }
    return false;
  },
});

export const remove = mutation({
  args: {
    walletAddress: v.string(),
    tokenId: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("listings")
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
    const all = await ctx.db.query("listings").collect();
    for (const l of all) await ctx.db.delete(l._id);
    return { cleared: all.length };
  },
});
