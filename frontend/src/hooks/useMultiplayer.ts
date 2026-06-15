"use client";

import { useRef, useCallback, useState } from "react";
import { useGameStore, OpponentMeta } from "@/stores/useGameStore";
import type { SyncState, InputState } from "@/lib/game/game-logic";
import type { PlayerStats } from "@/lib/game/constants";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002/ws";

/**
 * Metadata we publish to the room on connect so the opponent's screen can
 * render our team colour, name, and NFT-equipped formation slots.
 */
export interface MyPlayerMeta {
  walletAddress?: string;
  teamName: string;
  teamColor: string;
  teamAccent: string;
  abbr?: string;
  nftSlotIndices: number[];
  squadStats?: (PlayerStats | undefined)[];
  matchBetId?: number;
}

interface RoomPlayer {
  playerId: string;
  teamId: "home" | "away" | null;
  meta: OpponentMeta | null;
}

export function useMultiplayer() {
  const wsRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const matchIdRef = useRef("");
  const playerIdRef = useRef("");
  const myMetaRef = useRef<MyPlayerMeta | null>(null);
  // Latest team assignment — mirrored into a ref so message handlers (which
  // live inside a useCallback with `[]` deps) always read the current value
  // instead of the `null` they captured on mount.
  const myTeamRef = useRef<"home" | "away" | null>(null);

  const setPhase = useGameStore(s => s.setPhase);
  const updateMatchState = useGameStore(s => s.updateMatchState);
  const setMyTeamStore = useGameStore(s => s.setMyTeam);
  const setOpponentMeta = useGameStore(s => s.setOpponentMeta);
  const setHomeTeam = useGameStore(s => s.setHomeTeam);
  const setAwayTeam = useGameStore(s => s.setAwayTeam);
  const homeTeam = useGameStore(s => s.homeTeam);
  const awayTeam = useGameStore(s => s.awayTeam);

  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myTeam, setMyTeam] = useState<"home" | "away" | null>(null);
  const [gameState, setGameState] = useState<SyncState | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ winner: string | null; score: { home: number; away: number }; payout?: string } | null>(null);
  const [serverCountdown, setServerCountdown] = useState<number | null>(null);
  const [lastGoal, setLastGoal] = useState<{ team: "home" | "away"; scorerId: number | null; scorerTeam: "home" | "away" | null; key: number } | null>(null);

  /**
   * Apply incoming opponent meta to the relevant team slot in the game store
   * so both screens render matching kit colours, team names, and NFT auras.
   */
  const applyOpponentMeta = useCallback((opponent: RoomPlayer, myTeamId: "home" | "away" | null) => {
    if (!opponent.meta || !opponent.teamId || !myTeamId) return;
    setOpponentMeta(opponent.meta);

    // The OPPONENT is the team that is NOT mine. Slot it into away or home accordingly.
    if (opponent.teamId !== myTeamId) {
      const colorHex = parseInt(opponent.meta.teamColor.replace("#", ""), 16);
      const darkHex = parseInt(opponent.meta.teamAccent.replace("#", ""), 16);
      const abbr = opponent.meta.abbr || opponent.meta.teamName.substring(0, 3).toUpperCase();
      if (opponent.teamId === "away") {
        setAwayTeam({
          name: opponent.meta.teamName,
          abbr,
          color: colorHex,
          darkColor: darkHex,
          kitColor: opponent.meta.teamColor,
        });
      } else {
        // Opponent is home (I am away) — overwrite homeTeam with opponent data for 3D rendering.
        setHomeTeam({
          name: opponent.meta.teamName,
          color: opponent.meta.teamColor,
          accent: opponent.meta.teamAccent,
        });
        // Also populate awayTeam with MY own team data so scoreboards can resolve names.
        const myMeta = myMetaRef.current;
        if (myMeta) {
          const myColorHex = parseInt(myMeta.teamColor.replace("#", ""), 16);
          const myAccentHex = parseInt(myMeta.teamAccent.replace("#", ""), 16);
          setAwayTeam({
            name: myMeta.teamName,
            abbr: myMeta.abbr || myMeta.teamName.substring(0, 3).toUpperCase(),
            color: myColorHex,
            darkColor: myAccentHex,
            kitColor: myMeta.teamColor,
          });
        }
      }
    }
  }, [setOpponentMeta, setAwayTeam, setHomeTeam]);

  const connect = useCallback((newMatchId: string, newPlayerId: string, meta?: MyPlayerMeta) => {
    // Prevent duplicate connections
    if (wsRef.current || connectingRef.current) {
      wsRef.current?.close();
      wsRef.current = null;
    }

    matchIdRef.current = newMatchId;
    playerIdRef.current = newPlayerId;
    myMetaRef.current = meta ?? null;
    connectingRef.current = true;

    const url = `${WS_URL}?matchId=${newMatchId}&playerId=${newPlayerId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      connectingRef.current = false;
      setConnected(true);
      // Publish my meta so the opponent gets my team colour + squad immediately
      if (myMetaRef.current) {
        ws.send(JSON.stringify({ event: "player_meta", data: myMetaRef.current }));
      }
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.event) {
        case "room_joined": {
          const { teamId, players: p } = msg.data;
          myTeamRef.current = teamId;
          setMyTeam(teamId);
          setMyTeamStore(teamId);
          setPlayers(p);
          setOpponentConnected(p.length >= 2);
          // If the opponent already published meta, apply it
          const opp = p.find((x: RoomPlayer) => x.playerId !== playerIdRef.current);
          if (opp) applyOpponentMeta(opp, teamId);
          break;
        }

        case "player_joined": {
          const { players: p } = msg.data;
          setPlayers(p);
          setOpponentConnected(p.length >= 2);
          const opp = p.find((x: RoomPlayer) => x.playerId !== playerIdRef.current);
          if (opp) applyOpponentMeta(opp, myTeamRef.current);
          break;
        }

        case "player_meta_updated": {
          const { players: p } = msg.data;
          setPlayers(p);
          const opp = p.find((x: RoomPlayer) => x.playerId !== playerIdRef.current);
          if (opp) applyOpponentMeta(opp, myTeamRef.current);
          break;
        }

        case "countdown": {
          setServerCountdown(msg.data.count);
          break;
        }

        case "game_start": {
          const { state } = msg.data;
          setGameState(state);
          setPhase("playing");
          break;
        }

        case "game_update": {
          const { state } = msg.data;
          setGameState(state);
          updateMatchState({
            score: state.score,
            matchTime: state.matchTime,
            possession: state.possession,
          });
          break;
        }

        case "goal": {
          const { score, team, scorerId, scorerTeam, scorerName } = msg.data;
          const goalKey = Date.now() + Math.random();
          setLastGoal({ team, scorerId: scorerId ?? null, scorerTeam: scorerTeam ?? null, key: goalKey });
          const isMyGoal = team === myTeam;
          const mt = myTeamRef.current;
          const who = isMyGoal
            ? (mt === "home" ? (homeTeam?.name || "YOUR TEAM") : (awayTeam?.name || "YOUR TEAM"))
            : (mt === "home" ? (awayTeam?.name || "OPPONENT") : (homeTeam?.name || "OPPONENT"));
          const scorerLabel = scorerName ? ` — ${scorerName}` : "";
          updateMatchState({
            score,
            commentary: `COMMENTATOR: "GOOOAL! ${who} scores!${scorerLabel}"`,
          });
          break;
        }

        case "game_end": {
          const { winner, score, payout } = msg.data;
          setMatchEnd({ winner, score, payout });
          updateMatchState({ score, phase: "finished" });
          setPhase("finished");
          break;
        }

        case "player_disconnected": {
          setOpponentConnected(false);
          break;
        }
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      connectingRef.current = false;
      setConnected(false);
      setOpponentConnected(false);
    };

    ws.onerror = () => {
      connectingRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    connectingRef.current = false;
    myTeamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setOpponentConnected(false);
    setGameState(null);
    setMatchEnd(null);
    setMyTeamStore(null);
    setOpponentMeta(null);
  }, [setMyTeamStore, setOpponentMeta]);

  const sendInput = useCallback((input: Partial<InputState>) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      event: "player_input",
      data: input,
    }));
  }, []);

  // No cleanup — StrictMode double-mount would kill the connection.
  // Disconnection is handled by beforeunload in OnlineGameCanvas.

  return {
    connect,
    disconnect,
    sendInput,
    connected,
    opponentConnected,
    players,
    myTeam,
    gameState,
    matchEnd,
    serverCountdown,
    lastGoal,
  };
}
