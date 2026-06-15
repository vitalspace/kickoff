"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Play,
  Users,
  Target,
  Trophy,
  Wallet,
  LogOut,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useGameStore } from "@/stores/useGameStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { useMarketStore, ABILITIES } from "@/stores/useMarketStore";
import { walletService } from "@/lib/services/walletService";
import { betService } from "@/lib/services/betService";
import { matchBetService } from "@/lib/services/matchBetService";
import { checkBalance } from "@/lib/utils/checkBalance";
import { getRandomRivalTeam } from "@/lib/game/constants";
import SettingsModal from "@/components/game/SettingsModal";
import NavBar, { NavView } from "@/components/screens/NavBar";
import ProfileView from "@/components/screens/ProfileView";
import MarketScreen from "@/components/market/MarketScreen";
import WalletGuard from "@/components/guards/WalletGuard";
import SquadSelector from "@/components/squad/SquadSelector";
import SquadView from "@/components/screens/SquadView";
import { useSyncNfts } from "@/hooks/useSyncNfts";
import { useSyncListings } from "@/hooks/useSyncListings";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

const DIFFICULTIES = [
  {
    id: "amateur" as const,
    label: "AMATEUR LEAGUE",
    desc: "Easy AI, relaxed pace",
  },
  { id: "pro" as const, label: "CHAMPIONSHIP PRO", desc: "Balanced challenge" },
  {
    id: "legendary" as const,
    label: "LEGENDARY TELEVISION",
    desc: "Brutal AI, maximum intensity",
  },
];

const truncateAddress = (address: string) => {
  if (address.startsWith("0x") && address.length > 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
};

export default function SplashScreen({
  onStart,
  onOnlineStart,
}: {
  onStart: () => void;
  onOnlineStart?: (matchId: string) => void;
}) {
  const {
    difficulty,
    setSelectedTeam,
    setDifficulty,
    setPhase,
    setHomeTeam,
    setAwayTeam,
    setCurrentBetId,
    setCurrentMatchBetId,
    gameMode,
  } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [activeView, setActiveView] = useState<NavView>("play");
  const [profileInitialTab, setProfileInitialTab] = useState<"player" | "team">(
    "player",
  );
  const [onlineMatchId, setOnlineMatchId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isBetting, setIsBetting] = useState(false);
  const {
    isConnected,
    address,
    balance,
    wrongChain,
    reset: resetWallet,
  } = useWalletStore();
  const myNfts = useMarketStore((s) => s.myNfts);
  const isOnline = gameMode === "online";
  const [leaderboardTab, setLeaderboardTab] = useState<"ai" | "online">("online");
  const [showSquad, setShowSquad] = useState(false);
  useSyncNfts();
  useSyncListings();
  const leaderboard = useQuery(api.leaderboards.getLeaderboard, { gameMode: leaderboardTab });
  const user = useQuery(
    api.users.getByWallet,
    address ? { walletAddress: address } : "skip",
  );
  const upsertUser = useMutation(api.users.upsert);

  useEffect(() => {
    walletService.checkConnection();
    const unsubAccounts = walletService.onAccountsChanged((accounts) => {
      if (!accounts.length) {
        resetWallet();
        return;
      }
      walletService.checkConnection();
    });
    const unsubChain = walletService.onChainChanged(() =>
      walletService.checkConnection(),
    );
    return () => {
      unsubAccounts();
      unsubChain();
    };
  }, [resetWallet]);

  useEffect(() => {
    if (!address) return;
    walletService.refreshBalance();
    const interval = setInterval(() => walletService.refreshBalance(), 15_000);
    return () => clearInterval(interval);
  }, [address]);

  useEffect(() => {
    if (address) {
      upsertUser({ walletAddress: address });
    }
  }, [address, upsertUser]);

  const canPlay =
    isConnected && !wrongChain && !!(user?.teamName || user?.teamColor);
  const canPlayOnline = isConnected && !wrongChain;

  const handleStart = useCallback(async () => {
    if (!canPlay || isBetting) return;

    setHomeTeam({
      name: user?.teamName || "YOUR TEAM",
      color: user?.teamColor || "#10B981",
      accent: user?.teamAccent || "#D4AF37",
    });
    setAwayTeam(getRandomRivalTeam());
    setSelectedTeam("home");

    if (gameMode !== "online" && betService.isLive()) {
      if (!checkBalance(BigInt(1000000000000000))) {
        setIsBetting(false);
        return;
      }
      setIsBetting(true);
      try {
        const { betId } = await betService.deposit(difficulty);
        setCurrentBetId(betId);
      } catch (err) {
        console.error("[Bet] Deposit failed:", err);
        setIsBetting(false);
        return;
      }
      setIsBetting(false);
    }

    setPhase("playing");
    onStart();
  }, [canPlay, isBetting, user, gameMode, difficulty, setHomeTeam, setAwayTeam, setSelectedTeam, setCurrentBetId, setPhase, onStart]);

  const generateMatchId = () => {
    const id = `match_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setOnlineMatchId(id);
  };

  // Apply user's profile to the home-team slot in the game store.
  const applyMyTeamToStore = useCallback(() => {
    setHomeTeam({
      name: user?.teamName || "YOUR TEAM",
      color: user?.teamColor || "#10B981",
      accent: user?.teamAccent || "#D4AF37",
    });
    // Provisional opponent — replaced by real meta from the WS room_joined event
    setAwayTeam({
      name: "OPPONENT",
      abbr: "OPP",
      color: 0x3b82f6,
      darkColor: 0x1e3a8a,
      kitColor: "#3B82F6",
    });
    setSelectedTeam("home");
  }, [user, setHomeTeam, setAwayTeam, setSelectedTeam]);

  /**
   * CREATE: deposit 0.001 ETH on-chain via KickOffMatchBet, then use the
   * returned matchId as the WS room id. The opponent will join the same id.
   */
  const handleCreateOnlineMatch = useCallback(async () => {
    if (!canPlayOnline || isBetting) return;
    if (!matchBetService.isLive()) {
      // Fallback to off-chain only: behave like the old random-id flow
      generateMatchId();
      return;
    }
    if (!checkBalance(BigInt(1000000000000000))) return;

    setIsBetting(true);
    try {
      const { matchId } = await matchBetService.createMatch();
      setCurrentMatchBetId(matchId);
      setOnlineMatchId(String(matchId));
    } catch (err) {
      console.error("[MatchBet] Create failed:", err);
    } finally {
      setIsBetting(false);
    }
  }, [canPlayOnline, isBetting, setCurrentMatchBetId]);

  /**
   * CREATE → JOIN: the creator already deposited, just hop into the room.
   */
  const handleJoinMyCreatedMatch = useCallback(() => {
    if (!onlineMatchId.trim()) return;
    applyMyTeamToStore();
    onOnlineStart?.(onlineMatchId.trim());
  }, [onlineMatchId, applyMyTeamToStore, onOnlineStart]);

  /**
   * JOIN: deposit 0.001 ETH on the opponent's matchId, then connect.
   */
  const handleJoinExistingMatch = useCallback(async () => {
    if (!onlineMatchId.trim() || isBetting) return;
    if (!matchBetService.isLive()) {
      // Fallback to off-chain only: just connect
      applyMyTeamToStore();
      onOnlineStart?.(onlineMatchId.trim());
      return;
    }
    const matchId = Number(onlineMatchId.trim());
    if (!Number.isFinite(matchId) || matchId <= 0) {
      console.error("[MatchBet] Invalid match id:", onlineMatchId);
      return;
    }
    if (!checkBalance(BigInt(1000000000000000))) return;

    setIsBetting(true);
    try {
      await matchBetService.joinMatch(matchId);
      setCurrentMatchBetId(matchId);
      applyMyTeamToStore();
      onOnlineStart?.(String(matchId));
    } catch (err) {
      console.error("[MatchBet] Join failed:", err);
    } finally {
      setIsBetting(false);
    }
  }, [onlineMatchId, isBetting, applyMyTeamToStore, onOnlineStart, setCurrentMatchBetId]);

  const handleCopyMatchId = () => {
    navigator.clipboard.writeText(onlineMatchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-svh bg-[#040F08] flex flex-col items-center overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, #0F2A1D 0%, transparent 70%)",
        }}
      />

      {/* Field silhouette lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
        <div className="w-[90%] h-[60%] border-2 border-white relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-2 border-white" />
          </div>
          <div className="absolute inset-y-0 left-1/2 w-px bg-white" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5 min-h-svh">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => setPhase("menu")}
          className="self-start p-2 rounded-lg border border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[#0F2A1D] transition-all"
        >
          <ArrowLeft size={16} />
        </motion.button>

        {/* Hero + Nav */}
        <div className="flex items-start justify-between gap-4">
          <div className="text-center md:text-left flex-1">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] rounded-full mb-3"
            >
              <svg
                className="text-[#D4AF37] animate-spin"
                fill="none"
                height="13"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="m12 3-1.912 5.886L4.2 9l4.764 3.82L7.05 18.7 12 15l4.95 3.7-1.914-5.88L19.8 9l-5.888-.114L12 3z" />
              </svg>
              <span className="text-[10px] uppercase text-[#C59E30] font-broadcast tracking-widest font-bold">
                ARENA BROADCAST SYSTEM v2.5
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-broadcast font-black leading-none text-[#F3F7F4] whitespace-nowrap"
              style={{
                fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
                letterSpacing: "-0.02em",
              }}
            >
              KICKOFF{" "}
              <span
                style={{
                  WebkitTextFillColor: "transparent",
                  background: "linear-gradient(to right, #D4AF37, #C59E30)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                }}
              >
                3D
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[#7D9B8C] text-xs md:text-sm max-w-lg mt-2 font-light leading-relaxed"
            >
              Build your dream squad with NFT player cards. Each card brings unique
              stats and abilities to the pitch. Mint, trade, and dominate the league.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <NavBar activeView={activeView} onViewChange={setActiveView} />
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {activeView === "play" && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-5 flex-1"
            >
              {/* Main config grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                {/* Team selector */}
                <div
                  className={`${isOnline ? "md:col-span-12" : "md:col-span-8"} glass-panel-gold rounded-xl p-4 flex flex-col gap-4`}
                >
                  <h3 className="text-xs font-semibold text-[#C59E30] uppercase tracking-wider flex items-center gap-2">
                    <Users size={13} className="text-[#D4AF37]" />
                    YOUR TEAM
                  </h3>
                  {user && (user.teamName || user.teamColor) ? (
                    <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.25)] bg-[#0F2A1D]">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold font-broadcast text-lg text-white border-2"
                        style={{
                          backgroundColor: user.teamColor || "#10B981",
                          borderColor: user.teamAccent || "#D4AF37",
                        }}
                      >
                        {user.teamName
                          ? user.teamName.charAt(0).toUpperCase()
                          : "T"}
                      </div>
                      <div className="flex-1">
                        <p className="font-broadcast font-bold text-base text-[#F3F7F4]">
                          {user.teamName || "YOUR TEAM"}
                        </p>
                        <p className="text-[10px] text-[#7D9B8C] font-mono mt-0.5">
                          {user.playerName && (
                            <span className="text-[#C59E30]">
                              {user.playerName} •{" "}
                            </span>
                          )}
                          {isOnline ? "ONLINE MATCH" : "HOME GROUND"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-[#7D9B8C] tracking-wider">
                          JERSEY
                        </p>
                        <div className="flex gap-1 mt-1">
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{
                              backgroundColor: user.teamColor || "#10B981",
                            }}
                          />
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{
                              backgroundColor: user.teamAccent || "#D4AF37",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#040F08]/60">
                      <div className="w-14 h-14 rounded-full bg-[#0F2A1D] flex items-center justify-center font-bold font-broadcast text-lg text-[#7D9B8C] border border-[rgba(212,175,55,0.3)]">
                        ?
                      </div>
                      <div className="flex-1">
                        <p className="font-broadcast font-bold text-sm text-[#7D9B8C]">
                          NO TEAM CONFIGURED
                        </p>
                        <p className="text-[10px] text-[#7D9B8C] font-mono mt-0.5">
                          Go to{" "}
                          <span className="text-[#D4AF37]">PROFILE → TEAM</span>{" "}
                          to set up your team
                        </p>
                      </div>
                    </div>
                  )}

                  {!isOnline && (
                    <div className="pt-3 border-t border-[rgba(212,175,55,0.15)] flex items-center justify-between text-xs text-[#7D9B8C]">
                      <div>
                        Opponent:{" "}
                        <strong className="text-[#D4AF37] font-semibold">
                          RANDOM
                        </strong>
                      </div>
                      <div className="hidden sm:block">
                        Forecast:{" "}
                        <strong className="text-[#D4AF37] font-semibold">
                          FLOODLIGHTS NIGHT
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right panel: Difficulty (AI) or Matchmaking (Online) */}
                {!isOnline ? (
                  <div className="md:col-span-4 glass-panel rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-[#C59E30] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Target size={13} className="text-[#D4AF37]" />
                        MATCH DIFFICULTY
                      </h3>
                      <div className="space-y-1.5">
                        {DIFFICULTIES.map((d) => (
                          <motion.button
                            key={d.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setDifficulty(d.id)}
                            className={`w-full py-2 px-3 rounded text-left font-broadcast font-bold text-xs tracking-wider flex items-center justify-between transition-all ${
                              difficulty === d.id
                                ? "bg-[#D4AF37] text-[#040F08]"
                                : "bg-[#040F08]/60 text-[#7D9B8C] border border-transparent hover:bg-[#040F08] hover:text-white"
                            }`}
                          >
                            <span>{d.label}</span>
                            {difficulty === d.id && (
                              <svg
                                fill="none"
                                height="12"
                                stroke="currentColor"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                width="12"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#7D9B8C] mt-4 pt-2 border-t border-[rgba(212,175,55,0.1)]">
                      * Match timing runs at simulated television broadcast rate
                      (90 seconds fast speed).
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-12 glass-panel rounded-xl p-4 flex flex-col gap-4">
                    <h3 className="text-xs font-semibold text-[#C59E30] uppercase tracking-wider flex items-center gap-2">
                      <svg
                        className="text-[#3B82F6]"
                        fill="none"
                        height="13"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      ONLINE MATCHMAKING
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Create Room */}
                      <div className="p-4 rounded-lg bg-[#040F08]/60 border border-[rgba(59,130,246,0.3)]">
                        <p className="font-broadcast font-bold text-sm text-[#F3F7F4] mb-1">
                          CREATE MATCH
                        </p>
                        <p className="text-[10px] text-[#7D9B8C] mb-3">
                          Deposit 0.001 ETH and share the match ID with your opponent
                        </p>
                        {onlineMatchId ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 bg-[#0F2A1D] rounded border border-[rgba(59,130,246,0.3)]">
                              <span className="font-mono text-[11px] text-[#3B82F6] flex-1 truncate">
                                {onlineMatchId}
                              </span>
                              <button
                                onClick={handleCopyMatchId}
                                className="text-[#7D9B8C] hover:text-[#3B82F6] transition-colors"
                              >
                                {copied ? (
                                  <Check size={14} />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleJoinMyCreatedMatch}
                              disabled={!canPlayOnline || isBetting}
                              className="w-full py-2.5 rounded-lg font-broadcast font-bold text-xs tracking-widest text-[#040F08] disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background:
                                  "linear-gradient(to right, #3B82F6, #2563EB)",
                              }}
                            >
                              JOIN YOUR MATCH
                            </motion.button>
                          </div>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleCreateOnlineMatch}
                            disabled={!canPlayOnline || isBetting}
                            className="w-full py-2.5 rounded-lg border border-[rgba(59,130,246,0.3)] text-[#3B82F6] font-broadcast font-bold text-xs tracking-widest hover:bg-[rgba(59,130,246,0.1)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {isBetting ? (
                              <>
                                <div className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                                DEPOSITING 0.001 ETH...
                              </>
                            ) : (
                              "CREATE ROOM (0.001 ETH)"
                            )}
                          </motion.button>
                        )}
                      </div>

                      {/* Join Room */}
                      <div className="p-4 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.15)]">
                        <p className="font-broadcast font-bold text-sm text-[#F3F7F4] mb-1">
                          JOIN MATCH
                        </p>
                        <p className="text-[10px] text-[#7D9B8C] mb-3">
                          Enter a match ID and deposit 0.001 ETH to match the stake
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={onlineMatchId}
                            onChange={(e) => setOnlineMatchId(e.target.value)}
                            placeholder="Paste match ID..."
                            className="flex-1 px-3 py-2 rounded bg-[#040F08] border border-[rgba(212,175,55,0.2)] text-[#F3F7F4] text-[11px] font-mono placeholder:text-[#7D9B8C]/50 focus:outline-none focus:border-[#D4AF37]"
                          />
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleJoinExistingMatch}
                            disabled={!canPlayOnline || !onlineMatchId.trim() || isBetting}
                            className="px-4 py-2 rounded-lg font-broadcast font-bold text-xs tracking-widest text-[#040F08] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            style={{
                              background:
                                "linear-gradient(to right, #D4AF37, #C59E30)",
                            }}
                          >
                            {isBetting ? (
                              <div className="w-3 h-3 border-2 border-[#040F08] border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "JOIN"
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {!canPlayOnline && (
                      <p className="text-[10px] text-[#EF4444] font-broadcast tracking-wider text-center">
                        {!isConnected
                          ? "Connect your wallet to play online"
                          : "Switch to the correct network to play"}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[rgba(212,175,55,0.2)] gap-4">
                <div className="flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setShowSettings(true)}
                    className="p-2.5 glass-panel hover:bg-[#0F2A1D] rounded border border-[rgba(212,175,55,0.3)] text-[#D4AF37] transition-all"
                  >
                    <Settings size={18} />
                  </motion.button>
                  <div className="text-left">
                    <p className="text-[10px] text-[#7D9B8C] tracking-wider">
                      TELECAST SCHEDULER
                    </p>
                    <p className="text-xs font-bold text-[#F3F7F4] font-broadcast uppercase">
                      BROADCAST SETTINGS &amp; VIDEO FEED
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {!canPlay && (
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="text-[10px] text-[#EF4444] font-broadcast tracking-wider text-right">
                        {!isConnected
                          ? "Connect your wallet to play"
                          : wrongChain
                            ? "Switch to the correct network to play"
                            : "Set up your team to play"}
                      </p>
                      {isConnected && !wrongChain && (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => {
                            setProfileInitialTab("team");
                            setActiveView("profile");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#040F08] transition-all"
                        >
                          SET UP TEAM
                          <ArrowRight size={12} />
                        </motion.button>
                      )}
                    </div>
                  )}
                  <motion.button
                    whileTap={canPlay && !isBetting ? { scale: 0.96 } : undefined}
                    whileHover={canPlay && !isBetting ? { scale: 1.02 } : undefined}
                    onClick={handleStart}
                    disabled={!canPlay || isBetting}
                    className="w-full sm:w-auto px-8 py-3.5 font-black font-broadcast text-lg tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-[#040F08]"
                    style={{
                      background: canPlay && !isBetting
                        ? "linear-gradient(to right, #D4AF37, #C59E30)"
                        : "#1a2a1f",
                    }}
                  >
                    {isBetting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#040F08] border-t-transparent rounded-full animate-spin" />
                        DEPOSITING 0.001 ETH...
                      </>
                    ) : (
                      <>
                        START MATCH FEED
                        <Play size={18} fill="currentColor" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === "leaderboard" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="glass-panel-gold rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#C59E30] uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Trophy size={15} className="text-[#D4AF37]" />
                  GLOBAL LEADERBOARD
                </h3>
                <div className="flex gap-1 mb-4 p-1 bg-[#040F08] rounded-lg">
                  {(["online", "ai"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setLeaderboardTab(tab)}
                      className={`flex-1 py-1.5 text-[10px] font-broadcast font-bold uppercase tracking-widest rounded transition-all ${
                        leaderboardTab === tab
                          ? "bg-[#D4AF37] text-[#040F08]"
                          : "text-[#7D9B8C] hover:text-white"
                      }`}
                    >
                      {tab === "online" ? "ONLINE" : "VS CPU"}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {leaderboard && leaderboard.length > 0 ? (
                    leaderboard.map((entry, index) => (
                      <div
                        key={entry.displayName}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.1)]"
                      >
                        <span
                          className="font-broadcast font-black text-lg w-8 text-center"
                          style={{
                            color:
                              index === 0
                                ? "#D4AF37"
                                : index === 1
                                  ? "#C0C0C0"
                                  : index === 2
                                    ? "#CD7F32"
                                    : "#7D9B8C",
                          }}
                        >
                          #{index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-broadcast font-bold text-[11px] tracking-wider text-[#F3F7F4]">
                            {entry.displayName}
                            {entry.walletAddress &&
                              entry.displayName !== entry.walletAddress && (
                                <span className="text-[9px] text-[#7D9B8C] font-mono ml-2">
                                  {truncateAddress(entry.walletAddress)}
                                </span>
                              )}
                          </p>
                          <p className="text-[9px] text-[#7D9B8C] font-mono">
                            {entry.wins}W / {entry.draws}D / {entry.losses}L
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#D4AF37]">
                          {entry.wins * 100 + entry.draws * 25} PTS
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#7D9B8C] text-sm">
                        No matches recorded yet
                      </p>
                      <p className="text-[#C59E30] text-xs mt-1">
                        Play a match to appear on the leaderboard!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === "wallet" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="glass-panel-gold rounded-xl overflow-hidden">
                {/* Header */}
                <div className="p-4 pb-3 border-b border-[rgba(212,175,55,0.15)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                      <Wallet size={16} className="text-[#D4AF37]" />
                    </div>
                    <div>
                      <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-wider uppercase">
                        WALLET
                      </h3>
                      <p className="text-[8px] text-[#7D9B8C] mt-0.5">
                        MANAGE YOUR ASSETS
                      </p>
                    </div>
                  </div>
                </div>

                <WalletGuard fullScreen={false}>
                  <div className="p-4 space-y-4">
                    {/* Connection + Balance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Connected wallet */}
                      <div className="p-3 rounded-lg bg-[#040F08]/60 border border-[rgba(16,185,129,0.2)]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                          <span className="text-[8px] text-[#7D9B8C] font-broadcast uppercase tracking-wider">
                            Connected
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-[#F3F7F4] truncate">
                          {address}
                        </p>
                      </div>

                      {/* Balance */}
                      <div className="p-3 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.15)]">
                        <p className="text-[8px] text-[#7D9B8C] font-broadcast uppercase tracking-wider mb-1">
                          Balance
                        </p>
                        <p className="font-mono text-lg font-black text-[#D4AF37]">
                          {Number(balance).toFixed(4)}
                          <span className="text-[10px] text-[#C59E30] font-bold ml-1">ETH</span>
                        </p>
                      </div>
                    </div>

                    {/* NFT Collection */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#C59E30] font-broadcast font-bold uppercase tracking-wider">
                            YOUR COLLECTION
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/10 text-[8px] font-mono text-[#D4AF37] font-bold">
                            {myNfts.length}
                          </span>
                        </div>
                        {myNfts.length > 0 && (
                          <button
                            onClick={() => setActiveView("squad")}
                            className="text-[8px] text-[#D4AF37] font-broadcast font-bold uppercase tracking-wider hover:text-[#C59E30] transition-colors"
                          >
                            EDIT SQUAD →
                          </button>
                        )}
                      </div>

                      {myNfts.length === 0 ? (
                        <div className="text-center py-8 rounded-lg bg-[#040F08]/40 border border-dashed border-[rgba(212,175,55,0.15)]">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full border-2 border-dashed border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                            <Wallet size={22} className="text-[#D4AF37]/30" />
                          </div>
                          <p className="text-[10px] text-[#7D9B8C] font-broadcast mb-1">
                            NO NFTS YET
                          </p>
                          <p className="text-[8px] text-[#7D9B8C]/60 mb-3">
                            Mint your first player card to get started
                          </p>
                          <button
                            onClick={() => setActiveView("market")}
                            className="px-4 py-1.5 rounded-lg text-[9px] font-broadcast font-bold uppercase tracking-widest text-[#040F08]"
                            style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
                          >
                            GO TO MARKET
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {myNfts.map((nft) => {
                            const posColors: Record<string, string> = { GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };
                            const posColor = posColors[nft.position] || "#7D9B8C";
                            const ovr = Math.round((nft.speed + nft.shooting + nft.passing + nft.defense) / 4);
                            return (
                              <div
                                key={nft.tokenId}
                                className="p-2.5 rounded-lg bg-[#0F2A1D]/60 border border-[rgba(212,175,55,0.1)] hover:border-[rgba(212,175,55,0.25)] transition-all"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black text-white"
                                    style={{ backgroundColor: posColor }}
                                  >
                                    #{nft.tokenId}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold text-[#F3F7F4] truncate">
                                      Player #{nft.tokenId}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="text-[6px] font-bold px-1 py-0.5 rounded"
                                        style={{ backgroundColor: `${posColor}20`, color: posColor }}
                                      >
                                        {nft.position}
                                      </span>
                                      <span className="text-[7px] text-[#D4AF37] font-bold">
                                        OVR {ovr}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Mini stat bars */}
                                <div className="space-y-0.5">
                                  {[
                                    { label: "SPD", value: nft.speed },
                                    { label: "SHT", value: nft.shooting },
                                    { label: "PAS", value: nft.passing },
                                    { label: "DEF", value: nft.defense },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center gap-1">
                                      <span className="text-[6px] text-[#7D9B8C] w-3 font-mono">{label}</span>
                                      <div className="flex-1 h-0.5 bg-[#0a1a10] rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${value}%`,
                                            backgroundColor: value >= 80 ? "#10B981" : value >= 75 ? "#D4AF37" : "#F59E0B",
                                          }}
                                        />
                                      </div>
                                      <span className="text-[6px] font-mono text-[#F3F7F4] w-3 text-right">{value}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Ability badge */}
                                {nft.ability && (
                                  <div className="mt-1.5 pt-1.5 border-t border-[rgba(212,175,55,0.08)]">
                                    <span
                                      className="text-[5px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${ABILITIES[nft.ability].color}15`,
                                        color: ABILITIES[nft.ability].color,
                                        border: `1px solid ${ABILITIES[nft.ability].color}30`,
                                      }}
                                    >
                                      {ABILITIES[nft.ability].label}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Disconnect */}
                    <button
                      onClick={() => walletService.disconnect()}
                      className="w-full py-2.5 rounded-lg border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-[9px] font-broadcast font-bold uppercase tracking-widest hover:bg-[rgba(239,68,68,0.08)] transition-all flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={11} />
                      DISCONNECT
                    </button>
                  </div>
                </WalletGuard>
              </div>
            </motion.div>
          )}

          {activeView === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 flex-1"
            >
              <ProfileView initialTab={profileInitialTab} />
            </motion.div>
          )}

          {activeView === "market" && (
            <motion.div
              key="market"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 flex-1"
            >
              <MarketScreen />
            </motion.div>
          )}

          {activeView === "squad" && (
            <motion.div
              key="squad"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 flex-1"
            >
              <SquadView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      {/* Squad selector overlay */}
      <AnimatePresence>
        {showSquad && (
          <motion.div
            key="squad-selector"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#040F08] overflow-y-auto"
          >
            <SquadSelector
              onConfirm={() => setShowSquad(false)}
              onBack={() => setShowSquad(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
