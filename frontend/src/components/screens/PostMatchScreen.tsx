"use client";

import { motion } from "framer-motion";
import { Home, Wallet, CheckCircle, XCircle } from "lucide-react";
import { useGameStore } from "@/stores/useGameStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

const STATS = [
  { label: "BALL POSSESSION", key: "possession", homeVal: "58%", awayVal: "42%", homePct: 58 },
  { label: "SHOTS ON TARGET", key: "shots", homeVal: "16 ATTEMPTS", awayVal: "11 ATTEMPTS", homePct: 63 },
  { label: "PASS COMPLETION %", key: "passes", homeVal: "89% ACCURATE", awayVal: "74% ACCURATE", homePct: 79 },
];

interface PostMatchProps {
  onHome: () => void;
  onRematch: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PostMatchScreen({ onHome, onRematch }: PostMatchProps) {
  const { score, myTeam, gameMode, homeTeam, awayTeam, currentBetId, currentMatchBetId, difficulty } = useGameStore();
  const { address } = useWalletStore();
  const recordMatch = useMutation(api.leaderboards.recordMatch);
  const upsertUser = useMutation(api.users.upsert);
  const createBet = useMutation(api.bets.create);
  const reportBetResult = useMutation(api.bets.reportResult);
  const settleBet = useMutation(api.bets.settle);
  const hasRecorded = useRef(false);
  const hasReportedBet = useRef(false);
  const hasReportedMatchBet = useRef(false);
  const [betStatus, setBetStatus] = useState<"idle" | "reporting" | "claiming" | "claimed" | "lost" | "draw" | "error">("idle");
  const [payoutWei, setPayoutWei] = useState<string | null>(null);
  const [matchBetStatus, setMatchBetStatus] = useState<"idle" | "settling" | "won" | "lost" | "draw" | "error">("idle");

  const isHome = myTeam === "home";
  const homeWon = score.home > score.away;
  const draw = score.home === score.away;

  const myScore = isHome ? score.home : score.away;
  const oppScore = isHome ? score.away : score.home;

  const leftName = isHome ? homeTeam.name : (awayTeam?.name || "YOUR TEAM");
  const leftColor = isHome ? homeTeam.color : (awayTeam?.kitColor || "#F3F7F4");
  const rightName = isHome ? (awayTeam?.name || "AWAY") : homeTeam.name;
  const rightColor = isHome ? (awayTeam?.kitColor || "#F3F7F4") : homeTeam.color;

  const playerWon = !draw && ((myTeam === "home" && homeWon) || (myTeam === "away" && !homeWon));

  const winnerIsMe = !draw && playerWon;
  const winnerName = draw
    ? "MATCH DRAWN!"
    : winnerIsMe
      ? leftName
      : rightName;

  /**
   * Multiplayer (online) bet settlement. Calls the oracle endpoint which
   * reports + claims on the KickOffMatchBet contract. Idempotent — if the
   * opponent already triggered it, the second call short-circuits.
   */
  const handleMatchBetResult = useCallback(async () => {
    if (!currentMatchBetId || hasReportedMatchBet.current) return;
    hasReportedMatchBet.current = true;

    setMatchBetStatus("settling");
    try {
      const winnerStr = draw ? null : homeWon ? "home" : "away";
      const res = await fetch("/api/match-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: currentMatchBetId, winner: winnerStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match-bet oracle failed");

      if (draw) {
        setMatchBetStatus("draw");
        toast.error("Match drawn — house kept the entire 0.002 ETH pot");
      } else if (playerWon) {
        setMatchBetStatus("won");
        toast.success("Match won!", { description: "Pot transferred to your wallet." });
      } else {
        setMatchBetStatus("lost");
        toast.error("Match lost", { description: "Your stake went to the winner." });
      }
    } catch (err) {
      console.error("[MatchBet] Settle failed:", err);
      setMatchBetStatus("error");
      hasReportedMatchBet.current = false;
      toast.error("Match-bet settlement failed");
    }
  }, [currentMatchBetId, draw, homeWon, playerWon]);

  const handleBetResult = useCallback(async () => {
    if (!currentBetId || !address || hasReportedBet.current) return;
    hasReportedBet.current = true;

    setBetStatus("reporting");
    try {
      await createBet({
        walletAddress: address,
        betId: currentBetId,
        difficulty,
        stakeWei: "1000000000000000",
        txHash: currentBetId.toString(),
      });

      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betId: currentBetId, playerWon, isDraw: draw }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Oracle failed");

      await reportBetResult({
        betId: currentBetId,
        playerWon,
        isDraw: draw,
      });

      if (draw || !playerWon) {
        setBetStatus(draw ? "draw" : "lost");
        return;
      }

      if (data.claimTxHash) {
        await settleBet({
          betId: currentBetId,
          payoutWei: "1000000000000000",
          feeWei: "0",
          txHash: data.claimTxHash,
        });
      }

      setPayoutWei("0.001");
      setBetStatus("claimed");
      toast.success("Bet won!", { description: "0.001 ETH returned to your wallet." });
    } catch (err) {
      console.error("[Bet] Result/claim failed:", err);
      setBetStatus("error");
      hasReportedBet.current = false;
      toast.error("Bet settlement failed", { description: "Could not process bet result." });
    }
  }, [currentBetId, address, playerWon, draw, difficulty, createBet, reportBetResult, settleBet]);

  useEffect(() => {
    if (!address || hasRecorded.current) return;
    hasRecorded.current = true;

    upsertUser({ walletAddress: address })
      .then((userId) => recordMatch({ userId, teamId: myTeam || "home", gameMode: gameMode || "ai", won: playerWon, draw, score: { home: score.home, away: score.away } }))
      .then(() => {
        const modeLabel = gameMode === "online" ? "Online" : "vs CPU";
        toast.success("Match recorded", { description: `Your ${modeLabel} result has been saved to the leaderboard.` });
      })
      .catch((err) => {
        console.error("[Convex] Failed:", err);
        toast.error("Failed to record match", { description: "Could not save your result." });
        hasRecorded.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentBetId && gameMode !== "online") {
      queueMicrotask(() => handleBetResult());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentMatchBetId && gameMode === "online") {
      queueMicrotask(() => handleMatchBetResult());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-svh bg-[#040F08] flex flex-col items-center justify-start overflow-hidden">
      {/* Backdrop gradient */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: "radial-gradient(circle at top, #0F2A1D 0%, transparent 60%)" }} />

      {/* Confetti particles */}
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm pointer-events-none"
          style={{
            background: i % 3 === 0 ? "#D4AF37" : i % 3 === 1 ? "#10B981" : "#F3F7F4",
            left: `${5 + i * 5.2}%`,
            top: "-10px",
          }}
          animate={{
            y: ["0vh", "110vh"],
            rotate: [0, 360 + i * 30],
            x: [0, (i % 2 === 0 ? 30 : -30)],
          }}
          transition={{
            duration: 3 + i * 0.2,
            delay: i * 0.15,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ))}

      <div className="relative z-10 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-5 min-h-svh">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)] rounded-full mb-2">
            <svg className="text-[#D4AF37]" fill="none" height="12" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="12">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
            <span className="text-[9px] uppercase text-[#C59E30] font-broadcast tracking-widest font-bold">
              TELEVISION SPORTS RECORD DECLASSIFIED
            </span>
          </div>
          <h1 className="font-broadcast font-black text-4xl md:text-5xl text-[#F3F7F4] leading-none tracking-tighter">
            {draw ? "MATCH DRAWN!" : `${winnerName}`}
          </h1>
          {!draw && (
            <p className="font-broadcast text-xl mt-1" style={{ color: playerWon ? "#10B981" : "#EF4444" }}>
              {playerWon ? "CHAMPIONS CUP VICTORY!" : "DEFEAT"}
            </p>
          )}
          <p className="text-[#7D9B8C] text-[10px] font-mono tracking-widest uppercase mt-1">
            OFFICIAL TELECAST SCOREBOARD SYSTEM
          </p>
        </motion.div>

        {/* Scoreboard */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="glass-panel-gold rounded-xl p-5 shadow-2xl flex-1"
        >
          {/* Big score */}
          <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.3)] pb-4 mb-4">
            <div className="text-right flex-1">
              <div className="font-broadcast font-black text-lg" style={{ color: leftColor }}>{leftName}</div>
              <span className="text-[10px] text-[#C59E30] font-mono">CHAMPIONSHIP SQUAD</span>
            </div>
            <div className="px-5 py-2.5 bg-[#040F08] rounded-lg border border-[#D4AF37] flex items-center gap-3 mx-4">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                className="text-3xl font-black font-broadcast"
                style={{ color: myScore > oppScore ? "#10B981" : "#F3F7F4" }}
              >
                {myScore}
              </motion.span>
              <span className="text-[#7D9B8C] font-bold font-broadcast">-</span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                className="text-3xl font-black font-broadcast"
                style={{ color: oppScore > myScore ? "#EF4444" : "#F3F7F4" }}
              >
                {oppScore}
              </motion.span>
            </div>
            <div className="text-left flex-1">
              <div className="font-broadcast font-black text-lg" style={{ color: rightColor }}>{rightName}</div>
              <span className="text-[10px] text-[#7D9B8C] font-mono">MATCH CONTENDER</span>
            </div>
          </div>

          {/* Stats */}
          <h4 className="text-center font-broadcast text-[11px] text-[#C59E30] font-bold tracking-widest mb-3 uppercase">
            MATCH STATISTICAL RECORD
          </h4>
          <div className="space-y-2.5">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.12 }}
                className={`flex flex-col gap-1 py-1 ${i > 0 ? "border-t border-[rgba(212,175,55,0.1)]" : ""}`}
              >
                <div className="flex justify-between font-broadcast font-bold text-[11px] tracking-wider text-[#7D9B8C]">
                  <span className="text-[#10B981]">{stat.homeVal}</span>
                  <span>{stat.label}</span>
                  <span className="text-[#D4AF37]">{stat.awayVal}</span>
                </div>
                <div className="w-full bg-[#040F08] h-1.5 rounded-full overflow-hidden flex">
                  <motion.div
                    className="h-full bg-[#10B981]"
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.homePct}%` }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                  />
                  <motion.div
                    className="h-full bg-[#D4AF37]"
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - stat.homePct}%` }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Multiplayer Bet Result */}
        {currentMatchBetId && gameMode === "online" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-panel rounded-xl p-4 border border-[rgba(59,130,246,0.25)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={14} className="text-[#3B82F6]" />
              <span className="font-broadcast font-bold text-[11px] text-[#3B82F6] tracking-widest uppercase">
                MULTIPLAYER POT — MATCH #{currentMatchBetId}
              </span>
            </div>
            {matchBetStatus === "settling" && (
              <div className="flex items-center gap-2 text-[#7D9B8C] text-xs font-mono">
                <div className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                Settling pot on-chain (report + claim)...
              </div>
            )}
            {matchBetStatus === "won" && (
              <div className="flex items-center gap-2 text-[#10B981] text-xs font-mono">
                <CheckCircle size={14} />
                <span>Won! Pot transferred to your wallet (minus 5% fee)</span>
              </div>
            )}
            {matchBetStatus === "lost" && (
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-mono">
                <XCircle size={14} />
                <span>Lost — 0.001 ETH paid to your opponent</span>
              </div>
            )}
            {matchBetStatus === "draw" && (
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-mono">
                <XCircle size={14} />
                <span>Draw — house kept the entire 0.002 ETH pot</span>
              </div>
            )}
            {matchBetStatus === "error" && (
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-mono">
                <XCircle size={14} />
                <span>Failed to settle match pot — try again later</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Bet Result */}
        {currentBetId && gameMode !== "online" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-panel rounded-xl p-4 border border-[rgba(212,175,55,0.2)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={14} className="text-[#D4AF37]" />
              <span className="font-broadcast font-bold text-[11px] text-[#D4AF37] tracking-widest uppercase">
                BET RESULT — #{currentBetId}
              </span>
            </div>
            {betStatus === "reporting" && (
              <div className="flex items-center gap-2 text-[#7D9B8C] text-xs font-mono">
                <div className="w-3 h-3 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                Processing bet result on-chain...
              </div>
            )}
            {betStatus === "claiming" && (
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-mono">
                <div className="w-3 h-3 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                Claiming payout...
              </div>
            )}
            {betStatus === "claimed" && (
              <div className="flex items-center gap-2 text-[#10B981] text-xs font-mono">
                <CheckCircle size={14} />
                <span>Won! +{payoutWei} ETH returned to your wallet</span>
              </div>
            )}
            {betStatus === "lost" && (
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-mono">
                <XCircle size={14} />
                <span>Lost — 0.001 ETH kept by house</span>
              </div>
            )}
            {betStatus === "draw" && (
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-mono">
                <XCircle size={14} />
                <span>Draw — 0.001 ETH kept by house</span>
              </div>
            )}
            {betStatus === "error" && (
              <div className="flex items-center gap-2 text-[#EF4444] text-xs font-mono">
                <XCircle size={14} />
                <span>Failed to settle bet — try again later</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={onHome}
            className="flex-1 py-3 glass-panel hover:bg-[#0D1F16] border border-[rgba(212,175,55,0.3)] text-[#F3F7F4] rounded font-broadcast font-bold text-sm tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Home size={16} />
            RETURN TO STADIUM LOBBY
          </motion.button>
          {/* Rematch button - feature coming later
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={onRematch}
            className="flex-1 py-3 rounded font-broadcast font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:brightness-110 transition-all text-[#040F08]"
            style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
          >
            <RotateCcw size={16} />
            PLAY REMATCH FEED
          </motion.button>
          */}
        </motion.div>
      </div>
    </div>
  );
}
