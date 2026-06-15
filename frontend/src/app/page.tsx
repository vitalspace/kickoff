"use client";

import { useState } from "react";
import { useGameStore } from "@/stores/useGameStore";
import ModeSelectScreen from "@/components/screens/ModeSelectScreen";
import SplashScreen from "@/components/screens/SplashScreen";
import WalletGuard from "@/components/guards/WalletGuard";
import dynamic from "next/dynamic";
import PostMatchScreen from "@/components/screens/PostMatchScreen";
import HelpButton from "@/components/ui/HelpButton";

const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#040F08]">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-broadcast font-black text-xl text-[#F3F7F4] tracking-widest">LOADING ARENA...</p>
      </div>
    </div>
  ),
});

const OnlineGameCanvas = dynamic(() => import("@/components/game/OnlineGameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#040F08]">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-broadcast font-black text-xl text-[#F3F7F4] tracking-widest">CONNECTING TO ARENA...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { phase, setPhase, resetMatch, gameMode } = useGameStore();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [playerId] = useState(() => `player_${Math.random().toString(36).slice(2, 10)}`);

  const handleOnlineStart = (id: string) => {
    setMatchId(id);
    setPhase("playing");
  };

  return (
    <>
      {phase === "menu" && <ModeSelectScreen />}

      {phase === "splash" && (
        <SplashScreen
          onStart={() => setPhase("playing")}
          onOnlineStart={handleOnlineStart}
        />
      )}

      {phase === "playing" && gameMode === "online" && matchId && (
        <OnlineGameCanvas
          matchId={matchId}
          playerId={playerId}
          onMatchEnd={() => setPhase("finished")}
        />
      )}

      {phase === "playing" && (gameMode !== "online" || !matchId) && (
        <WalletGuard>
          <GameCanvas onMatchEnd={() => setPhase("finished")} />
        </WalletGuard>
      )}

      {phase === "finished" && (
        <WalletGuard>
          <PostMatchScreen
            onHome={() => resetMatch()}
            onRematch={() => {
              resetMatch();
              setTimeout(() => setPhase("playing"), 50);
            }}
          />
        </WalletGuard>
      )}

      <HelpButton />
    </>
  );
}
