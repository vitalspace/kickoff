import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    walletAddress: v.string(),
    betId: v.number(),
    difficulty: v.string(),
    stakeWei: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bets")
      .withIndex("by_betId", (q) => q.eq("betId", args.betId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("bets", {
      walletAddress: args.walletAddress,
      betId: args.betId,
      difficulty: args.difficulty,
      stakeWei: args.stakeWei,
      status: "live",
      createdAt: Date.now(),
      txHash: args.txHash,
    });
  },
});

export const reportResult = mutation({
  args: {
    betId: v.number(),
    playerWon: v.boolean(),
    isDraw: v.boolean(),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_betId", (q) => q.eq("betId", args.betId))
      .collect();

    const bet = bets.find((b) => b.status === "live");

    if (!bet) {
      const reported = bets.find((b) => b.status === "reported" || b.status === "settled");
      if (reported) return reported._id;
      console.error(`[reportResult] Bet ${args.betId} not found`);
      throw new Error(`Bet ${args.betId} not found`);
    }

    await ctx.db.patch(bet._id, {
      status: "reported",
      playerWon: args.playerWon,
      isDraw: args.isDraw,
      reportedAt: Date.now(),
    });

    return bet._id;
  },
});

export const settle = mutation({
  args: {
    betId: v.number(),
    payoutWei: v.string(),
    feeWei: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_betId", (q) => q.eq("betId", args.betId))
      .collect();

    const bet = bets.find((b) => b.status === "reported");

    if (!bet) {
      const settled = bets.find((b) => b.status === "settled");
      if (settled) return settled._id;
      console.error(`[settle] Bet ${args.betId} not found or not in reported status`);
      throw new Error(`Bet ${args.betId} not found or not in reported status`);
    }

    await ctx.db.patch(bet._id, {
      status: "settled",
      payoutWei: args.payoutWei,
      feeWei: args.feeWei,
      settledAt: Date.now(),
      claimTxHash: args.txHash,
    });

    return bet._id;
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .order("desc")
      .collect();
  },
});

export const getByBetId = query({
  args: { betId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_betId", (q) => q.eq("betId", args.betId))
      .order("desc")
      .first();
  },
});

export const cleanDuplicates = mutation({
  args: { betId: v.number() },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_betId", (q) => q.eq("betId", args.betId))
      .collect();

    if (bets.length <= 1) return 0;

    const keep = bets.find((b) => b.status !== "cancelled") ?? bets[0];
    let deleted = 0;
    for (const b of bets) {
      if (b._id !== keep._id) {
        await ctx.db.delete(b._id);
        deleted++;
      }
    }
    return deleted;
  },
});

export const getLiveByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .filter((q) => q.eq(q.field("status"), "live"))
      .collect();
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("bets").collect();
    for (const b of all) await ctx.db.delete(b._id);
    return { cleared: all.length };
  },
});
