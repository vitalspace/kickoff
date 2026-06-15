"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildScene, buildPitch, buildGoals, buildStadium,
  buildPlayers, buildBall, buildBallTrail, createCamera, setCameraMode, CameraMode,
} from "@/lib/game/scene-builder";
import { SoccerEngine } from "@/lib/game/engine";
import { useGameStore } from "@/stores/useGameStore";
import { useSquadStore } from "@/stores/useSquadStore";
import { TEAMS, type GameState } from "@/lib/game/constants";

interface GameCanvasProps {
  onMatchEnd: () => void;
}

export default function GameCanvas({ onMatchEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SoccerEngine | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [cameraMode, setCamMode] = useState<CameraMode>("broadcast");
  const [goalFlash, setGoalFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);

  const {
    score, matchTime, commentary, difficulty, selectedTeam,
    settings, updateMatchState, setPhase, setMyTeam, shootPower, isCharging,
    passPower, isPassCharging, homeTeam, awayTeam,
  } = useGameStore();

  const teamHome = {
    ...TEAMS.home,
    name: homeTeam.name,
    kitColor: homeTeam.color,
    abbr: homeTeam.name?.substring(0, 3).toUpperCase() || TEAMS.home.abbr,
  };
  const teamAway = awayTeam
    ? { ...TEAMS.away, name: awayTeam.name, kitColor: awayTeam.kitColor, abbr: awayTeam.abbr }
    : TEAMS.away;

  const halfTime = matchTime < 45;
  const minutes = Math.floor(matchTime);
  const seconds = Math.floor((matchTime % 1) * 60);
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Possession percentage
  const [poss, setPoss] = useState({ home: 50, away: 50 });

  useEffect(() => {
    if (!canvasRef.current) return;

    setMyTeam("home");

    const scene = buildScene();
    buildPitch(scene);
    buildGoals(scene);
    buildStadium(scene);

    const squadStats = useSquadStore.getState().getStatsArray();
    const nftPlayerIds = new Set<number>();
    squadStats.forEach((stats, i) => {
      if (stats && stats !== undefined) nftPlayerIds.add(i);
    });

    const players = buildPlayers(scene, homeTeam, awayTeam || undefined, nftPlayerIds);
    const ball = buildBall(scene);
    const trail = buildBallTrail(scene);
    const camera = createCamera();

    const engine = new SoccerEngine(canvasRef.current, scene, camera, ball, players, trail, squadStats);
    engineRef.current = engine;

    engine.onStateUpdate = (partial: Partial<GameState>) => {
      updateMatchState(partial);
      if (partial.score) {
        const ls = engine.getLoopState();
        setPoss({ ...ls.possession_pct });
      }
      if (partial.lastGoalTeam) {
        const t = partial.lastGoalTeam === "home" ? teamHome.name : teamAway.name;
        setGoalFlash(`GOAL — ${t}!`);
        setTimeout(() => setGoalFlash(null), 2500);
      }
      if (partial.phase === "finished") {
        stopRef.current?.();
        setTimeout(() => {
          setPhase("finished");
          onMatchEnd();
        }, 1000);
      }
    };

    setLoading(false);

    // ── Countdown 3-2-1-GO before engine starts ───────────────────────────
    setCountdown(3);
    let count = 3;
    const countInterval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countInterval);
        setCountdown(null); // null = show GO
        setShowGo(true);
        setTimeout(() => {
          setShowGo(false);
          const stop = engine.start(difficulty, selectedTeam);
          stopRef.current = stop;
        }, 600);
      }
    }, 1000);

    return () => {
      clearInterval(countInterval);
      stopRef.current?.();
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCameraSwitch = (mode: CameraMode) => {
    setCamMode(mode);
    const eng = engineRef.current;
    if (!eng) return;
    const cam = eng.getCamera();
    if (cam) setCameraMode(cam, mode);
  };

  const handleShootStart = () => {
    const input = engineRef.current?.getInput();
    if (input) { input.shootHeld = true; }
  };
  const handleShootEnd = () => {
    const input = engineRef.current?.getInput();
    if (input) { input.shootHeld = false; input.shootReleased = true; }
  };
  const handlePass = () => {
    const input = engineRef.current?.getInput();
    if (input) { input.pass = true; setTimeout(() => { if (input) input.pass = false; }, 100); }
  };
  const handleQuit = () => {
    stopRef.current?.();
    setPhase("splash");
  };
  const handleEndMatch = () => {
    stopRef.current?.();
    setPhase("finished");
    onMatchEnd();
  };

  return (
    <div className="relative w-full h-svh bg-[#0E271B] overflow-hidden">
      {/* Three.js canvas */}
      <canvas ref={canvasRef} id="game-canvas" />

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center bg-[#040F08] z-50"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-broadcast font-black text-xl text-[#F3F7F4] tracking-widest">LOADING ARENA...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal Flash */}
      <AnimatePresence>
        {goalFlash && (
          <motion.div
            key="goal-flash"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
          >
            <div className="px-12 py-6 bg-[#D4AF37] rounded-2xl shadow-[0_0_60px_rgba(212,175,55,0.8)]">
              <p className="font-broadcast font-black text-5xl text-[#040F08] tracking-tighter">
                {goalFlash}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key="countdown-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none"
            style={{ background: "rgba(4,15,8,0.75)" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ opacity: 0, scale: 2.0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="font-broadcast font-black text-[#D4AF37] tracking-tighter select-none"
                style={{ fontSize: "clamp(100px,22vw,190px)", textShadow: "0 0 80px rgba(212,175,55,0.8)" }}
              >
                {countdown}
              </motion.div>
            </AnimatePresence>
            <p className="mt-6 text-[#7AB89A] font-broadcast text-xl tracking-widest uppercase">
              Get ready...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GO! flash */}
      <AnimatePresence>
        {showGo && (
          <motion.div
            key="go-flash"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.4, ease: "backOut" }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <p
              className="font-broadcast font-black text-[#00FF88] tracking-tighter select-none"
              style={{ fontSize: "clamp(80px,18vw,160px)", textShadow: "0 0 80px rgba(0,255,136,0.9)" }}
            >
              GO!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Broadcast Scoreboard */}
      <div className="absolute top-4 left-0 right-0 flex justify-center px-4 z-20">
        <div className="w-full max-w-xl">
          <div className="flex items-center glass-panel rounded-lg overflow-hidden border border-[#D4AF37] shadow-2xl">
            {/* Home team */}
            <div className="flex-1 flex items-center justify-end px-3 py-2 gap-2"
              style={{ background: `linear-gradient(to left, ${homeTeam.color}40, transparent)` }}>
              <span className="font-broadcast font-black text-[#F3F7F4] text-xs md:text-sm tracking-wider hidden sm:block">{teamHome.name}</span>
              <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] text-white border border-[rgba(212,175,55,0.3)]"
                style={{ background: teamHome.kitColor }}>
                {teamHome.abbr}
              </div>
              <span className="font-broadcast font-black text-2xl text-[#F3F7F4]">{score.home}</span>
            </div>

            {/* Timer */}
            <div className="px-3 py-1 bg-black flex flex-col items-center justify-center min-w-[72px] border-x border-[rgba(212,175,55,0.3)] text-center">
              <span className="text-[8px] font-bold text-[#D4AF37] font-broadcast tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse inline-block" /> LIVE
              </span>
              <span className="font-mono text-sm font-black text-[#F3F7F4] leading-tight">{timeStr}</span>
              <span className="text-[7px] font-semibold text-[#7D9B8C]">{halfTime ? "1ST HALF" : "2ND HALF"}</span>
            </div>

            {/* Away team */}
            <div className="flex-1 flex items-center justify-start px-3 py-2 gap-2"
              style={{ background: `linear-gradient(to right, ${teamAway.kitColor}30, transparent)` }}>
              <span className="font-broadcast font-black text-2xl text-[#F3F7F4]">{score.away}</span>
              <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] border border-[rgba(212,175,55,0.3)]"
                style={{ background: teamAway.kitColor, color: "#040F08" }}>
                {teamAway.abbr}
              </div>
              <span className="font-broadcast font-black text-[#F3F7F4] text-xs md:text-sm tracking-wider hidden sm:block">{teamAway.name}</span>
            </div>
          </div>

          {/* Commentary ticker */}
          <div className="mt-2 px-3 py-1.5 glass-panel rounded border border-[rgba(212,175,55,0.2)] text-center flex items-center gap-2 justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-mono uppercase text-[#7D9B8C] tracking-wider truncate">{commentary}</span>
          </div>
        </div>
      </div>

      {/* Possession stat (center) */}
      {settings.telemetryHud && (
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 z-20 w-72">
          <div className="glass-panel-gold rounded-lg p-2.5 shadow-lg border border-[#D4AF37]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-[#C59E30] font-broadcast uppercase tracking-wider">POSSESSION</span>
              <span className="text-[8px] font-mono text-[#7D9B8C]">STAT: LIVE</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-1.5 font-broadcast font-bold">
              <span className="text-[#10B981]">EMR {Math.round(poss.home)}%</span>
              <span className="text-[#7D9B8C] text-[9px]">BALL</span>
              <span className="text-[#D4AF37]">GAT {Math.round(poss.away)}%</span>
            </div>
            <div className="w-full bg-[#040F08] h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-[#10B981] h-full transition-all duration-500" style={{ width: `${poss.home}%` }} />
              <div className="bg-[#D4AF37] h-full transition-all duration-500" style={{ width: `${poss.away}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 space-y-3">
        {/* Shoot power bar - shows when charging shot */}
        {isCharging && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider font-broadcast">SHOT POWER</span>
                <span className="text-[9px] text-white font-mono">{Math.round(shootPower * 100)}%</span>
              </div>
              <div className="w-full bg-[#040F08] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${shootPower * 100}%`,
                    background: shootPower < 0.5
                      ? `linear-gradient(to right, #10B981, #F59E0B)`
                      : `linear-gradient(to right, #F59E0B, #EF4444)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pass power bar - shows when charging pass */}
        {isPassCharging && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-[#10B981] font-bold uppercase tracking-wider font-broadcast">PASS POWER</span>
                <span className="text-[9px] text-white font-mono">{Math.round(passPower * 100)}%</span>
              </div>
              <div className="w-full bg-[#040F08] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${passPower * 100}%`,
                    background: passPower < 0.5
                      ? `linear-gradient(to right, #10B981, #3B82F6)`
                      : `linear-gradient(to right, #3B82F6, #8B5CF6)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Camera + Controls row */}
        <div className="w-full max-w-2xl mx-auto grid grid-cols-2 gap-2">
          {/* Camera views */}
          <div className="glass-panel rounded-lg p-2">
            <h4 className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider mb-1.5 font-broadcast">CAMERA</h4>
            <div className="grid grid-cols-3 gap-1">
              {(["broadcast", "isometric", "tactical"] as CameraMode[]).map((m) => (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleCameraSwitch(m)}
                  className={`py-1 text-[8px] uppercase font-bold font-broadcast rounded text-center transition-all ${
                    cameraMode === m
                      ? "bg-[#D4AF37] text-[#040F08]"
                      : "bg-[#040F08] text-[#7D9B8C] hover:text-white"
                  }`}
                >
                  {m === "broadcast" ? "HD" : m === "isometric" ? "ISO" : "TOP"}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="glass-panel rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider font-broadcast">CONTROLS</h4>
              <span className="text-[7px] text-[#7D9B8C] font-mono">W/A/S/D + SPACE</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onMouseDown={handlePass} onTouchStart={handlePass}
                className="py-2 bg-[rgba(13,31,22,0.9)] border border-[rgba(212,175,55,0.3)] text-[#F3F7F4] rounded text-[9px] font-broadcast font-bold uppercase tracking-widest text-center transition-all active:bg-[#153C29]"
              >
                PASS [F]
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onMouseDown={handleShootStart} onMouseUp={handleShootEnd} onMouseLeave={handleShootEnd}
                onTouchStart={handleShootStart} onTouchEnd={handleShootEnd}
                className="py-2 rounded text-[9px] font-broadcast font-black uppercase tracking-widest text-center shadow-lg transition-all"
                style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)", color: "#040F08" }}
              >
                SHOOT [SPACE]
              </motion.button>
            </div>
          </div>
        </div>

        {/* Match control footer */}
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between pt-2 border-t border-[rgba(212,175,55,0.15)]">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleQuit}
            className="py-1 px-3 glass-panel hover:bg-[rgba(13,31,22,0.9)] text-[#7D9B8C] hover:text-white rounded text-xs font-broadcast flex items-center gap-1.5 transition-all"
          >
            <svg fill="none" height="12" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="12">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            ABANDON
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleEndMatch}
            className="py-1 px-3.5 glass-panel border border-[#D4AF37] text-[#F3F7F4] rounded text-xs font-broadcast font-bold tracking-wider flex items-center gap-1.5 transition-all"
          >
            FULL TIME
            <svg fill="none" height="12" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="12">
              <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
