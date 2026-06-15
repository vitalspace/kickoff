"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import {
  buildScene, buildPitch, buildGoals, buildStadium,
  buildPlayers, buildBall, buildBallTrail, createCamera, CameraMode,
} from "@/lib/game/scene-builder";
import { useGameStore } from "@/stores/useGameStore";
import { useSquadStore } from "@/stores/useSquadStore";
import { useWalletStore } from "@/stores/useWalletStore";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { TEAMS } from "@/lib/game/constants";
import { BALL_RADIUS } from "@/lib/game/constants";
import { bindKeyboard, createInputState } from "@/lib/game/game-logic";
import type { SyncState } from "@/lib/game/game-logic";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface OnlineGameCanvasProps {
  matchId: string;
  playerId: string;
  onMatchEnd: () => void;
}

export default function OnlineGameCanvas({ matchId, playerId, onMatchEnd }: OnlineGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraMode, setCamMode] = useState<CameraMode>("broadcast");
  const [loading, setLoading] = useState(true);
  const [showGo, setShowGo] = useState(false);

  const { score, matchTime, commentary, homeTeam, awayTeam, opponentMeta, currentMatchBetId, updateMatchState, setPhase } = useGameStore();
  const { connect, disconnect, sendInput, connected, gameState, opponentConnected, myTeam, matchEnd, serverCountdown, lastGoal } = useMultiplayer();
  const { address } = useWalletStore();
  const user = useQuery(api.users.getByWallet, address ? { walletAddress: address } : "skip");

  const input = useRef(createInputState());
  const gameStateRef = useRef<SyncState | null>(null);
  useEffect(() => { gameStateRef.current = gameState; });

  // Mirror myTeam into a ref so the frame-loop closure always reads the latest value
  const myTeamRef = useRef<"home" | "away" | null>(myTeam);
  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);

  // Track previous ball position for rotation computation
  const prevBallPos = useRef({ x: 0, z: 0 });

  const teamHome = {
    ...TEAMS.home,
    name: homeTeam.name,
    kitColor: homeTeam.color,
    abbr: homeTeam.name?.substring(0, 3).toUpperCase() || TEAMS.home.abbr,
  };
  const teamAway = awayTeam
    ? { ...TEAMS.away, name: awayTeam.name, kitColor: awayTeam.kitColor, abbr: awayTeam.abbr }
    : TEAMS.away;

  const didConnect = useRef(false);
  useEffect(() => {
    if (didConnect.current) return;
    // Wait for Convex user data so the meta carries the real team name/colour
    if (address && user === undefined) return;
    didConnect.current = true;

    // Assemble my player meta so the opponent sees my real team colour, name,
    // and which formation slots are NFT-equipped.
    const squadStats = useSquadStore.getState().getStatsArray();
    const nftSlotIndices: number[] = [];
    squadStats.forEach((s, i) => { if (s) nftSlotIndices.push(i); });

    const teamName = user?.teamName || homeTeam.name || "YOUR TEAM";
    const teamColor = user?.teamColor || homeTeam.color || "#10B981";
    const teamAccent = user?.teamAccent || homeTeam.accent || "#D4AF37";

    connect(matchId, playerId, {
      walletAddress: address ?? undefined,
      teamName,
      teamColor,
      teamAccent,
      abbr: teamName.substring(0, 3).toUpperCase(),
      nftSlotIndices,
      squadStats,
      matchBetId: currentMatchBetId ?? undefined,
    });
    const onUnload = () => disconnect();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, address]);

  // Setup Three.js scene + render loop. Wait for `myTeam` AND opponent meta
  // so we know both kit colours + which formation slots to mark as NFT —
  // that way the aura/label render correctly on every screen regardless of
  // who joined first. The teardown is parked in a ref so subsequent re-runs
  // of this effect (triggered by late `player_meta_updated` events) don't
  // dispose the renderer mid-game.
  const builtRef = useRef(false);
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!canvasRef.current || !myTeam || !opponentMeta || builtRef.current) return;
    builtRef.current = true;

    // Local squad: which formation slots (0..7) are NFT-equipped
    const mySquadStats = useSquadStore.getState().getStatsArray();
    const myNftSlots = new Set<number>();
    mySquadStats.forEach((s, i) => { if (s) myNftSlots.add(i); });

    // Opponent squad (received via socket meta)
    const oppNftSlots = new Set<number>(opponentMeta?.nftSlotIndices ?? []);

    // Map "my slots" / "opponent slots" → home/away id space
    const homeNftIds = myTeam === "home" ? myNftSlots : oppNftSlots;
    const awayNftIds = myTeam === "away" ? myNftSlots : oppNftSlots;

    const scene = buildScene();
    buildPitch(scene);
    buildGoals(scene);
    buildStadium(scene);
    const players = buildPlayers(scene, homeTeam, awayTeam || undefined, homeNftIds, awayNftIds);
    const ball = buildBall(scene);
    const trail = buildBallTrail(scene);
    const camera = createCamera();

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const resize = () => {
      const par = canvasRef.current?.parentElement;
      if (!par) return;
      const w = par.clientWidth || 800, h = par.clientHeight || 450;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const unbind = bindKeyboard(input.current);

    let animId = 0;
    let lastTime = performance.now();

    const frame = (ts: number) => {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      sendInput({
        up: input.current.up,
        down: input.current.down,
        left: input.current.left,
        right: input.current.right,
        sprint: input.current.sprint,
        shootHeld: input.current.shootHeld,
        shootReleased: input.current.shootReleased,
        passHeld: input.current.passHeld,
        passReleased: input.current.passReleased,
      });
      input.current.shootReleased = false;
      input.current.passReleased = false;

      const gs = gameStateRef.current;
      if (gs) {
        // Active player (used by indicator logic below)
        const activePlayer = gs.players
          .filter(p => p.teamId === myTeamRef.current && !p.isGK)
          .sort((a, b) => {
            const da = Math.sqrt((a.pos.x - gs.ball.x) ** 2 + (a.pos.z - gs.ball.z) ** 2);
            const db = Math.sqrt((b.pos.x - gs.ball.x) ** 2 + (b.pos.z - gs.ball.z) ** 2);
            return da - db;
          })[0];

        // Ball position — always authoritative from server, BUT we also
        // compute the expected glued position from the carrier so the ball
        // visibly tracks the player smoothly even between 20Hz updates.
        // The carrier (home OR away) is part of gs.players, so this works
        // identically on both sockets.
        const carrier = gs.possessorId != null ? gs.players.find(pl => pl.id === gs.possessorId) : null;
        const GLUE_DIST = 1.2;
        let targetX = gs.ball.x;
        let targetY = gs.ball.y;
        let targetZ = gs.ball.z;
        if (carrier) {
          targetX = carrier.pos.x + Math.sin(carrier.facing) * GLUE_DIST;
          targetY = BALL_RADIUS;
          targetZ = carrier.pos.z + Math.cos(carrier.facing) * GLUE_DIST;
        }
        // Smooth lerp so the ball visibly trails the carrier instead of
        // teleporting every 50ms — critical for the remote player.
        const lerpFactor = carrier ? 0.45 : 0.7;
        ball.position.x += (targetX - ball.position.x) * lerpFactor;
        ball.position.y += (targetY - ball.position.y) * lerpFactor;
        ball.position.z += (targetZ - ball.position.z) * lerpFactor;

        // Ball rotation — sync to carrier facing so it follows player turns
        if (carrier) {
          ball.rotation.set(0, carrier.facing, 0);
          ball.rotation.x += ts * 0.004;
        } else {
          const dx = gs.ball.x - prevBallPos.current.x;
          const dz = gs.ball.z - prevBallPos.current.z;
          if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
            ball.rotation.x += dz * 8;
            ball.rotation.z -= dx * 8;
            ball.rotation.y = 0;
          }
        }
        prevBallPos.current.x = gs.ball.x;
        prevBallPos.current.z = gs.ball.z;

        players.forEach(pm => {
          const p = gs.players.find(pl => pl.id === pm.id);
          if (p) {
            pm.group.position.set(p.pos.x, 0, p.pos.z);
            pm.group.rotation.y = p.facing;

            const ring = pm.group.getObjectByName("indicator") as THREE.Mesh | undefined;
            const arrowGroup = pm.group.getObjectByName("arrowGroup") as THREE.Group | undefined;
            const arrow = arrowGroup?.getObjectByName("arrow") as THREE.Mesh | undefined;
            const halo = arrowGroup?.getObjectByName("halo") as THREE.Mesh | undefined;
            if (ring && arrowGroup && arrow && halo) {
              const isActive = p.id === activePlayer?.id;
              const isCarrier = gs.possessorId === p.id;
              ring.visible = isActive || isCarrier;
              arrowGroup.visible = isActive;
              const rm = ring.material as THREE.MeshBasicMaterial;
              const am = arrow.material as THREE.MeshBasicMaterial;
              const hm = halo.material as THREE.MeshBasicMaterial;

              // Gold = my active player has the ball (highest priority)
              // Yellow = someone else on the pitch has the ball
              // Cyan = my active player, no ball yet
              const COLOR_GOLD = 0xD4AF37;
              const COLOR_YELLOW = 0xFFFF00;
              const COLOR_CYAN = 0x00FFFF;
              let indicatorColor: number;
              if (isActive && isCarrier) indicatorColor = COLOR_GOLD;
              else if (isCarrier) indicatorColor = COLOR_YELLOW;
              else indicatorColor = COLOR_CYAN;
              rm.color.setHex(indicatorColor);
              am.color.setHex(indicatorColor);
              hm.color.setHex(indicatorColor);
              // Pulse the active player ring + bob arrow group
              if (isActive) {
                const pulse = 0.6 + Math.sin(ts * 0.006) * 0.4;
                rm.opacity = pulse;
                ring.scale.setScalar(1.0 + Math.sin(ts * 0.006) * 0.15);
                // Bob the entire arrow group up and down for clear visibility
                arrowGroup.position.y = 2.6 + Math.sin(ts * 0.005) * 0.35;
                am.opacity = 0.85 + Math.sin(ts * 0.008) * 0.15;
                hm.opacity = 0.2 + Math.sin(ts * 0.008) * 0.12;
                // Slow spin for extra visibility
                arrowGroup.rotation.y = ts * 0.002;
              } else {
                rm.opacity = 1;
                ring.scale.setScalar(1);
                am.opacity = 0.95;
                hm.opacity = 0.25;
              }
            }

            // NFT aura + floating "NFT" label — animated to match PvCPU engine
            if (pm.aura) {
              const isCarrier = gs.possessorId === p.id;
              const pulse = 0.5 + Math.sin(ts * 0.004 + pm.id * 0.7) * 0.5;
              (pm.aura.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.5;
              pm.aura.rotation.z = ts * 0.001;
              pm.aura.scale.setScalar(1.0 + pulse * 0.15);
              if (pm.auraGlow) pm.auraGlow.intensity = isCarrier ? 1.5 : 0.6 + pulse * 0.4;
            }
            if (pm.nftLabel) pm.nftLabel.position.y = 2.3 + Math.sin(ts * 0.003 + pm.id) * 0.15;
          }
        });

        // Trail
        if (gs.possessorId === null && (gs.ballVel.x !== 0 || gs.ballVel.z !== 0)) {
          trail.setType("shoot", 0.5);
          trail.push(gs.ball);
        }
        trail.update(dt, camera);

        // Sync store (throttled)
        if (Math.round(ts / 250) !== Math.round((ts - dt * 1000) / 250)) {
          updateMatchState({
            score: gs.score,
            matchTime: gs.matchTime,
            possession: gs.possession,
          });
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    setLoading(false);

    // Park the teardown — the dedicated unmount effect below fires it.
    // Do NOT return it from here, otherwise re-running this effect on a late
    // `opponentMeta` update would dispose the renderer mid-game.
    teardownRef.current = () => {
      cancelAnimationFrame(animId);
      unbind();
      window.removeEventListener("resize", resize);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, opponentMeta]);

  // Real unmount: dispose the renderer + cancel any pending frame.
  useEffect(() => () => {
    teardownRef.current?.();
    teardownRef.current = null;
  }, []);

  // Show GO! flash when game starts
  const showedGo = useRef(false);
  useEffect(() => {
    if (!gameState || showedGo.current) return;
    showedGo.current = true;
    setShowGo(true);
    setTimeout(() => setShowGo(false), 800);
  }, [gameState]);

  // Show goal flash — renders directly from lastGoal with a unique key,
  // auto-hides after 3s via a transient flag so consecutive goals re-trigger.
  const [goalVisible, setGoalVisible] = useState(false);
  useEffect(() => {
    if (!lastGoal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalVisible(true);
    const t = setTimeout(() => setGoalVisible(false), 3000);
    return () => clearTimeout(t);
  }, [lastGoal]);

  // Handle match end
  useEffect(() => {
    if (matchEnd) {
      setTimeout(() => {
        setPhase("finished");
        onMatchEnd();
      }, 1500);
    }
  }, [matchEnd, setPhase, onMatchEnd]);

  // Dismiss the connecting spinner as soon as the WebSocket is open — the
  // "Waiting for opponent" overlay then takes over until the opponent joins
  // and publishes their meta (which is when the 3D scene actually builds).
  // Drive `loading` directly off the connection state instead of a setter
  // call to avoid a synchronous re-render inside an effect.
  const showLoading = loading && !connected;

  const handleQuit = () => {
    disconnect();
    setPhase("splash");
  };

  // Determine which charging state to show based on local team
  const isHome = myTeam === "home";
  const myScore = isHome ? score.home : score.away;
  const oppScore = isHome ? score.away : score.home;

  // Scoreboard: always show "my team" on left, "opponent" on right
  const scoreboardLeftName = isHome ? teamHome.name : teamAway.name;
  const scoreboardLeftColor = isHome ? teamHome.kitColor : teamAway.kitColor;
  const scoreboardRightName = isHome ? teamAway.name : teamHome.name;
  const scoreboardRightColor = isHome ? teamAway.kitColor : teamHome.kitColor;
  const localShootPower = isHome ? (gameState?.shootPower ?? 0) : (gameState?.awayShootPower ?? 0);
  const localIsCharging = isHome ? (gameState?.isCharging ?? false) : (gameState?.awayIsCharging ?? false);
  const localPassPower = isHome ? (gameState?.passPower ?? 0) : (gameState?.awayPassPower ?? 0);
  const localIsPassCharging = isHome ? (gameState?.isPassCharging ?? false) : (gameState?.awayIsPassCharging ?? false);

  // NFT badge counts shown on the scoreboard — derived from local squad +
  // the opponent meta we received over the WebSocket so both screens agree.
  const mySquadCount = useSquadStore((s) => s.slots.filter((id) => id !== undefined).length);
  const oppSquadCount = opponentMeta?.nftSlotIndices.length ?? 0;
  const homeNftCount = isHome ? mySquadCount : oppSquadCount;
  const awayNftCount = isHome ? oppSquadCount : mySquadCount;

  return (
    <div className="relative w-full h-svh bg-[#0E271B] overflow-hidden">
      <canvas ref={canvasRef} id="game-canvas" />

      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#040F08] z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-broadcast font-black text-xl text-[#F3F7F4] tracking-widest">CONNECTING TO ARENA...</p>
          </div>
        </div>
      )}

      {/* Waiting overlay — covers from connect → countdown. Shows the match
          id while no opponent is connected, then a generic "syncing" message
          while we wait for the opponent's meta + countdown to fire. */}
      {!gameState && serverCountdown === null && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-[#040F08]/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-broadcast font-black text-lg text-[#F3F7F4] tracking-widest">
              {!opponentConnected
                ? "WAITING FOR OPPONENT"
                : !opponentMeta
                  ? "SYNCING SQUAD..."
                  : "PREPARING MATCH..."}
            </p>
            {!opponentConnected && (
              <p className="text-[#7D9B8C] text-xs mt-2">
                Share match ID: <span className="text-[#D4AF37] font-mono">{matchId}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Server countdown overlay */}
      <AnimatePresence>
        {serverCountdown !== null && serverCountdown > 0 && (
          <motion.div
            key="countdown-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none"
            style={{ background: "rgba(4,15,8,0.75)" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={serverCountdown}
                initial={{ opacity: 0, scale: 2.0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="font-broadcast font-black text-[#D4AF37] tracking-tighter select-none"
                style={{ fontSize: "clamp(100px,22vw,190px)", textShadow: "0 0 80px rgba(212,175,55,0.8)" }}
              >
                {serverCountdown}
              </motion.div>
            </AnimatePresence>
            <p className="mt-6 text-[#7AB89A] font-broadcast text-xl tracking-widest uppercase">Get ready...</p>
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

      {/* Goal flash — key changes per goal so AnimatePresence remounts it */}
      <AnimatePresence>
        {goalVisible && lastGoal && (() => {
          const isMyTeamScore = lastGoal.team === myTeam;
          const teamName = isMyTeamScore
            ? (myTeam === "home" ? (homeTeam.name || "YOUR TEAM") : (awayTeam?.name || "YOUR TEAM"))
            : (myTeam === "home" ? (awayTeam?.name || "OPPONENT") : (homeTeam.name || "OPPONENT"));
          const scorerLabel = lastGoal.scorerId != null ? ` — Player #${lastGoal.scorerId}` : "";
          const text = `GOAL! ${teamName} SCORES!${scorerLabel}`;
          return (
            <motion.div
              key={`goal-flash-${lastGoal.key}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <div className="px-12 py-6 bg-[#D4AF37] rounded-2xl shadow-[0_0_60px_rgba(212,175,55,0.8)]">
                <p className="font-broadcast font-black text-5xl text-[#040F08] tracking-tighter">
                  {text}
                </p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Top Broadcast Scoreboard */}
      <div className="absolute top-4 left-0 right-0 flex justify-center px-4 z-20">
        <div className="w-full max-w-xl">
          <div className="flex items-center glass-panel rounded-lg overflow-hidden border border-[#D4AF37] shadow-2xl">
            <div className="flex-1 flex items-center justify-end px-3 py-2 gap-2"
              style={{ background: `linear-gradient(to left, ${scoreboardLeftColor}40, transparent)` }}>
              <span className="font-broadcast font-black text-[#F3F7F4] text-xs md:text-sm tracking-wider hidden sm:block">{scoreboardLeftName}</span>
              {homeNftCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-broadcast font-black tracking-wider"
                  style={{ background: "rgba(0,255,136,0.18)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.4)" }}>
                  NFT×{homeNftCount}
                </span>
              )}
              <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] text-white border border-[rgba(212,175,55,0.3)]"
                style={{ background: scoreboardLeftColor }}>
                {isHome ? teamHome.abbr : teamAway.abbr}
              </div>
              <span className="font-broadcast font-black text-2xl text-[#F3F7F4]">{myScore}</span>
            </div>
            <div className="px-3 py-1 bg-black flex flex-col items-center justify-center min-w-[72px] border-x border-[rgba(212,175,55,0.3)] text-center">
              <span className="text-[8px] font-bold text-[#D4AF37] font-broadcast tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse inline-block" /> LIVE
              </span>
              <span className="font-mono text-sm font-black text-[#F3F7F4] leading-tight">
                {String(Math.floor(matchTime)).padStart(2, "0")}:{String(Math.floor((matchTime % 1) * 60)).padStart(2, "0")}
              </span>
              <span className="text-[7px] font-semibold text-[#7D9B8C]">{matchTime < 45 ? "1ST HALF" : "2ND HALF"}</span>
            </div>
            <div className="flex-1 flex items-center justify-start px-3 py-2 gap-2"
              style={{ background: `linear-gradient(to right, ${scoreboardRightColor}30, transparent)` }}>
              <span className="font-broadcast font-black text-2xl text-[#F3F7F4]">{oppScore}</span>
              <div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[10px] border border-[rgba(212,175,55,0.3)]"
                style={{ background: scoreboardRightColor, color: "#040F08" }}>
                {isHome ? teamAway.abbr : teamHome.abbr}
              </div>
              {awayNftCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-broadcast font-black tracking-wider"
                  style={{ background: "rgba(255,170,0,0.18)", color: "#ffaa00", border: "1px solid rgba(255,170,0,0.4)" }}>
                  NFT×{awayNftCount}
                </span>
              )}
              <span className="font-broadcast font-black text-[#F3F7F4] text-xs md:text-sm tracking-wider hidden sm:block">{scoreboardRightName}</span>
            </div>
          </div>

          <div className="mt-2 px-3 py-1.5 glass-panel rounded border border-[rgba(212,175,55,0.2)] text-center flex items-center gap-2 justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-mono uppercase text-[#7D9B8C] tracking-wider truncate">{commentary}</span>
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 space-y-3">
        {/* Shoot power bar - shows when charging shot */}
        {localIsCharging && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider font-broadcast">SHOT POWER</span>
                <span className="text-[9px] text-white font-mono">{Math.round(localShootPower * 100)}%</span>
              </div>
              <div className="w-full bg-[#040F08] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${localShootPower * 100}%`,
                    background: localShootPower < 0.5
                      ? `linear-gradient(to right, #10B981, #F59E0B)`
                      : `linear-gradient(to right, #F59E0B, #EF4444)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pass power bar - shows when charging pass */}
        {localIsPassCharging && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-[#10B981] font-bold uppercase tracking-wider font-broadcast">PASS POWER</span>
                <span className="text-[9px] text-white font-mono">{Math.round(localPassPower * 100)}%</span>
              </div>
              <div className="w-full bg-[#040F08] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${localPassPower * 100}%`,
                    background: localPassPower < 0.5
                      ? `linear-gradient(to right, #10B981, #3B82F6)`
                      : `linear-gradient(to right, #3B82F6, #8B5CF6)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-2xl mx-auto grid grid-cols-2 gap-2">
          <div className="glass-panel rounded-lg p-2">
            <h4 className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider mb-1.5 font-broadcast">CAMERA</h4>
            <div className="grid grid-cols-3 gap-1">
              {(["broadcast", "isometric", "tactical"] as CameraMode[]).map((m) => (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setCamMode(m)}
                  className={`py-1 text-[8px] uppercase font-bold font-broadcast rounded text-center transition-all ${
                    cameraMode === m ? "bg-[#D4AF37] text-[#040F08]" : "bg-[#040F08] text-[#7D9B8C] hover:text-white"
                  }`}
                >
                  {m === "broadcast" ? "HD" : m === "isometric" ? "ISO" : "TOP"}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[9px] text-[#C59E30] font-bold uppercase tracking-wider font-broadcast">CONTROLS</h4>
              <span className="text-[7px] text-[#7D9B8C] font-mono">W/A/S/D + SPACE</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onMouseDown={() => { input.current.passHeld = true; input.current.pass = true; }}
                onMouseUp={() => { input.current.passHeld = false; input.current.passReleased = true; }}
                onTouchStart={() => { input.current.passHeld = true; input.current.pass = true; }}
                onTouchEnd={() => { input.current.passHeld = false; input.current.passReleased = true; }}
                className="py-2 bg-[rgba(13,31,22,0.9)] border border-[rgba(212,175,55,0.3)] text-[#F3F7F4] rounded text-[9px] font-broadcast font-bold uppercase tracking-widest text-center transition-all active:bg-[#153C29]"
              >
                PASS [F]
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onMouseDown={() => { input.current.shootHeld = true; }}
                onMouseUp={() => { input.current.shootHeld = false; input.current.shootReleased = true; }}
                onTouchStart={() => { input.current.shootHeld = true; }}
                onTouchEnd={() => { input.current.shootHeld = false; input.current.shootReleased = true; }}
                className="py-2 rounded text-[9px] font-broadcast font-black uppercase tracking-widest text-center shadow-lg transition-all"
                style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)", color: "#040F08" }}
              >
                SHOOT [SPACE]
              </motion.button>
            </div>
          </div>
        </div>

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

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#7D9B8C] font-mono">YOU: {myTeam?.toUpperCase()}</span>
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-[#10B981]" : "bg-[#EF4444]"}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
