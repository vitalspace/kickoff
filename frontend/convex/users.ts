import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      walletAddress: args.walletAddress,
      createdAt: Date.now(),
    });
  },
});

export const updateTeamSettings = mutation({
  args: {
    userId: v.id("users"),
    playerName: v.optional(v.string()),
    bio: v.optional(v.string()),
    teamName: v.optional(v.string()),
    teamColor: v.optional(v.string()),
    teamAccent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      ...(args.playerName !== undefined && { playerName: args.playerName }),
      ...(args.bio !== undefined && { bio: args.bio }),
      ...(args.teamName !== undefined && { teamName: args.teamName }),
      ...(args.teamColor !== undefined && { teamColor: args.teamColor }),
      ...(args.teamAccent !== undefined && { teamAccent: args.teamAccent }),
    });
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .unique();
  },
});