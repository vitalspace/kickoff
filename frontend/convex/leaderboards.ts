import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const recordMatch = mutation({
  args: {
    userId: v.id("users"),
    teamId: v.string(),
    gameMode: v.optional(v.string()),
    won: v.boolean(),
    draw: v.boolean(),
    score: v.object({ home: v.number(), away: v.number() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("leaderboards", {
      userId: args.userId,
      teamId: args.teamId,
      gameMode: args.gameMode,
      won: args.won,
      draw: args.draw,
      score: args.score,
      timestamp: Date.now(),
    });
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const matches = await ctx.db.query("leaderboards").collect();
    for (const m of matches) await ctx.db.delete(m._id);
    const users = await ctx.db.query("users").collect();
    for (const u of users) await ctx.db.delete(u._id);
    return { cleared: matches.length + users.length };
  },
});

export const getLeaderboard = query({
  args: { gameMode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let query = ctx.db.query("leaderboards");
    if (args.gameMode) {
      query = query.filter((q) => q.eq(q.field("gameMode"), args.gameMode));
    }
    const allMatches = await query.collect();

    const playerStats: Record<string, { wins: number; draws: number; losses: number; matches: number; displayName: string; walletAddress: string }> = {};

    for (const match of allMatches) {
      let displayName = "Unknown";
      let walletAddress = "";

      if (match.userId) {
        const user = await ctx.db.get(match.userId);
        if (user) {
          displayName = user.playerName || user.walletAddress;
          walletAddress = user.walletAddress;
        }
      } else if (match.playerName) {
        displayName = match.playerName;
      }

      const key = displayName;
      if (!playerStats[key]) {
        playerStats[key] = { wins: 0, draws: 0, losses: 0, matches: 0, displayName, walletAddress };
      }
      playerStats[key].matches++;
      if (match.won) {
        playerStats[key].wins++;
      } else if (match.draw) {
        playerStats[key].draws++;
      } else {
        playerStats[key].losses++;
      }
    }

    return Object.values(playerStats)
      .sort((a, b) => b.wins - a.wins || b.draws - a.draws || a.losses - b.losses)
      .slice(0, 10);
  },
});
