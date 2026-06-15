"use client";

import { create } from "zustand";
import { GameState, GameMode, INITIAL_GAME_STATE, TeamId, RivalTeam } from "@/lib/game/constants";

interface TeamSettings {
  name: string;
  color: string;
  accent: string;
}

/**
 * Opponent metadata received via WebSocket in multiplayer matches.
 * Includes team styling and which formation slots are NFT-equipped so the
 * remote player gets the NFT aura/label rendered on both screens.
 */
export interface OpponentMeta {
  walletAddress?: string;
  teamName: string;
  teamColor: string;
  teamAccent: string;
  abbr?: string;
  nftSlotIndices: number[]; // 0..7 — slot indices in the formation
}

interface GameStore extends GameState {
  homeTeam: TeamSettings;
  awayTeam: RivalTeam | null;
  opponentMeta: OpponentMeta | null;
  setPhase: (phase: GameState["phase"]) => void;
  setGameMode: (mode: GameMode) => void;
  setSelectedTeam: (team: TeamId) => void;
  setMyTeam: (team: TeamId | null) => void;
  setDifficulty: (d: GameState["difficulty"]) => void;
  setHomeTeam: (team: TeamSettings) => void;
  setAwayTeam: (team: RivalTeam) => void;
  setOpponentMeta: (meta: OpponentMeta | null) => void;
  updateMatchState: (partial: Partial<GameState>) => void;
  setSettings: (s: Partial<GameState["settings"]>) => void;
  setCurrentBetId: (id: number | null) => void;
  setCurrentMatchBetId: (id: number | null) => void;
  resetMatch: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  ...INITIAL_GAME_STATE,
  homeTeam: { name: "YOUR TEAM", color: "#10B981", accent: "#D4AF37" },
  awayTeam: null,
  opponentMeta: null,

  setPhase: (phase: GameState["phase"]) => set({ phase }),
  setGameMode: (gameMode: GameMode) => set({ gameMode, phase: "splash" }),
  setSelectedTeam: (selectedTeam: TeamId) => set({ selectedTeam }),
  setMyTeam: (myTeam: TeamId | null) => set({ myTeam }),
  setDifficulty: (difficulty: GameState["difficulty"]) => set({ difficulty }),
  setHomeTeam: (homeTeam: TeamSettings) => set({ homeTeam }),
  setAwayTeam: (awayTeam: RivalTeam) => set({ awayTeam }),
  setOpponentMeta: (opponentMeta: OpponentMeta | null) => set({ opponentMeta }),

  updateMatchState: (partial: Partial<GameState>) =>
    set((s: GameStore) => ({ ...s, ...partial })),

  setSettings: (settings: Partial<GameState["settings"]>) =>
    set((s: GameStore) => ({ settings: { ...s.settings, ...settings } })),

  setCurrentBetId: (id: number | null) => set({ currentBetId: id }),
  setCurrentMatchBetId: (id: number | null) => set({ currentMatchBetId: id }),

  resetMatch: () =>
    set({
      score: { home: 0, away: 0 },
      matchTime: 0,
      halfTime: false,
      phase: "menu",
      gameMode: null,
      possession: null,
      commentary: INITIAL_GAME_STATE.commentary,
      lastGoalTeam: null,
      awayTeam: null,
      myTeam: null,
      currentBetId: null,
      currentMatchBetId: null,
      opponentMeta: null,
    }),
}));
