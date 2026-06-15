// KickOff 3D — Standalone WebSocket Multiplayer Server
import { mkState, gameTick, toSyncState, createInputState } from "./shared/game-logic";
import type { InputState, DifficultyKey } from "./shared/game-logic";
import type { TeamId, PlayerStats } from "./shared/constants";

const PORT = Number(process.env.WS_PORT) || 3002;
const TICK_RATE = 50;

interface PlayerMeta {
  walletAddress?: string;
  teamName: string;
  teamColor: string;     // hex string e.g. "#3B82F6"
  teamAccent: string;    // hex string
  abbr?: string;         // 3-letter
  nftSlotIndices: number[]; // 0..7 slots equipped with NFTs
  squadStats?: (PlayerStats | undefined)[]; // length 8, undefined for non-NFT slots
  matchBetId?: number;   // on-chain id for KickOffMatchBet
}

interface RoomPlayer {
  playerId: string;
  teamId: TeamId | null;
  ws: any;
  meta: PlayerMeta | null;
}

const rooms = new Map<string, {
  players: Map<string, RoomPlayer>;
  state: any;
  tickInterval: any;
  matchTime: number;
  difficulty: DifficultyKey;
}>();

function broadcast(matchId: string, data: any, srv: any) {
  try { srv.publish(`match:${matchId}`, JSON.stringify(data)); } catch {}
}

function playerSummaries(room: { players: Map<string, RoomPlayer> }) {
  return [...room.players.entries()].map(([id, p]) => ({
    playerId: id,
    teamId: p.teamId,
    meta: p.meta,
  }));
}

function startGameLoop(matchId: string, srv: any) {
  const room = rooms.get(matchId);
  if (!room || room.tickInterval) return;

  // Pick up squad stats from each player's meta so NFT players exist in the
  // shared game state. The actual gameplay impact is opt-in by the shared
  // game logic — passing the array is forward-compatible.
  let homeStats: (PlayerStats | undefined)[] | undefined;
  let awayStats: (PlayerStats | undefined)[] | undefined;
  for (const p of room.players.values()) {
    if (p.teamId === "home" && p.meta?.squadStats) homeStats = p.meta.squadStats;
    if (p.teamId === "away" && p.meta?.squadStats) awayStats = p.meta.squadStats;
  }

  room.state = mkState(homeStats, awayStats);
  room.state._homeInput = createInputState();
  room.state._awayInput = createInputState();
  room.matchTime = 0;

  // Server-side countdown: 3, 2, 1, GO! — both clients see the same timing
  broadcast(matchId, { event: "countdown", data: { count: 3 } }, srv);
  setTimeout(() => broadcast(matchId, { event: "countdown", data: { count: 2 } }, srv), 1000);
  setTimeout(() => broadcast(matchId, { event: "countdown", data: { count: 1 } }, srv), 2000);
  setTimeout(() => {
    broadcast(matchId, { event: "countdown", data: { count: 0 } }, srv); // 0 = GO!
    broadcast(matchId, { event: "game_start", data: { matchId, state: toSyncState(room.state) } }, srv);

    room.tickInterval = setInterval(() => {
      const dt = TICK_RATE / 1000;
      room.matchTime += dt;
      room.state.matchTime = Math.min((room.matchTime / 90) * 90, 90);

      const { goal, scorerId } = gameTick(room.state, dt, room.state._homeInput, room.difficulty, "home", room.state._awayInput);

      if (goal) {
        const scorer = scorerId != null ? room.state.players.find((p: any) => p.id === scorerId) : null;
        broadcast(matchId, {
          event: "goal",
          data: {
            team: goal,
            score: { ...room.state.score },
            scorerId,
            scorerTeam: scorer?.teamId ?? null,
            scorerName: scorer ? `Player #${scorer.id}` : null,
          },
        }, srv);
        broadcast(matchId, { event: "game_update", data: { state: toSyncState(room.state) } }, srv);
      }

      if (room.state.matchTime >= 90) {
        const s = room.state.score;
        const w = s.home > s.away ? "home" : s.away > s.home ? "away" : null;
        broadcast(matchId, { event: "game_end", data: { winner: w, score: { ...s } } }, srv);
        clearInterval(room.tickInterval!);
        room.tickInterval = null;
        // Clean up: disconnect all players and delete room
        room.players.forEach((p) => { try { p.ws.close(4001, "Game over"); } catch {} });
        rooms.delete(matchId);
        console.log(`[Room ${matchId}] Game over — room deleted`);
        return;
      }

      broadcast(matchId, { event: "game_update", data: { state: toSyncState(room.state) } }, srv);
    }, TICK_RATE);

    console.log(`[Room ${matchId}] Game loop started`);
  }, 3000);
}

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    console.log(`[HTTP] ${req.method} ${url.pathname}`);
    if (url.pathname === "/ws") {
      const matchId = url.searchParams.get("matchId");
      const playerId = url.searchParams.get("playerId");
      if (!matchId || !playerId) return new Response("Bad params", { status: 400 });

      const room = rooms.get(matchId);
      if (room && room.players.size >= 2 && !room.players.has(playerId))
        return new Response("Room full", { status: 403 });

      const ok = server.upgrade(req, { data: { playerId, matchId, teamId: null } });
      if (ok) return;
      return new Response("Upgrade failed", { status: 500 });
    }
    if (url.pathname === "/health") return Response.json({ status: "ok", rooms: rooms.size });
    return new Response("KickOff 3D WS Server");
  },
  websocket: {
    publishToSelf: false,
    open(ws: any) {
      const { matchId, playerId } = ws.data;
      if (!rooms.has(matchId)) {
        rooms.set(matchId, { players: new Map(), state: null, tickInterval: null, matchTime: 0, difficulty: "pro" });
      }
      const room = rooms.get(matchId)!;

      // Handle reconnect: if same playerId already in room, replace the old socket
      if (room.players.has(playerId)) {
        const old = room.players.get(playerId)!;
        try { old.ws.close(4000, "Reconnected"); } catch {}
        const teamId = old.teamId;
        ws.data.teamId = teamId;
        room.players.set(playerId, { playerId, teamId, ws, meta: old.meta });
        ws.subscribe(`match:${matchId}`);
        ws.send(JSON.stringify({
          event: "room_joined",
          data: {
            matchId, playerId, teamId,
            playerCount: room.players.size,
            players: playerSummaries(room),
          },
        }));
        console.log(`[Room ${matchId}] ${playerId} reconnected as ${teamId} (${room.players.size}/2)`);
        return;
      }

      if (room.players.size >= 2) { ws.close(4003, "Full"); return; }

      const teamId: TeamId = room.players.size === 0 ? "home" : "away";
      ws.data.teamId = teamId;
      room.players.set(playerId, { playerId, teamId, ws, meta: null });
      ws.subscribe(`match:${matchId}`);

      const players = playerSummaries(room);
      broadcast(matchId, { event: "player_joined", data: { playerId, teamId, playerCount: room.players.size, players } }, server);
      ws.send(JSON.stringify({ event: "room_joined", data: { matchId, playerId, teamId, playerCount: room.players.size, players } }));

      console.log(`[Room ${matchId}] ${playerId} joined as ${teamId} (${room.players.size}/2)`);
      // Note: game loop now starts only after both players have published their meta
      // (see `player_meta` handler below) — that way the loop has the squad stats.
    },
    message(ws: any, message: any) {
      const data = JSON.parse(String(message));
      const { matchId, playerId, teamId } = ws.data;
      const room = rooms.get(matchId);
      if (!room) return;

      if (data.event === "player_meta") {
        const me = room.players.get(playerId);
        if (!me) return;
        me.meta = data.data as PlayerMeta;

        // Re-broadcast the updated roster so the opponent sees my team color +
        // NFT squad right away (before the game starts).
        const players = playerSummaries(room);
        broadcast(matchId, { event: "player_meta_updated", data: { playerId, teamId, meta: me.meta, players } }, server);

        // Start the game loop only when both players are present AND both have
        // published their meta — otherwise the loop would spawn without the
        // squad stats / kit colors.
        if (
          room.players.size === 2 &&
          [...room.players.values()].every((p) => p.meta !== null) &&
          !room.tickInterval &&
          !room.state
        ) {
          setTimeout(() => startGameLoop(matchId, server), 600);
        }
        return;
      }

      if (data.event !== "player_input") return;
      const input = data.data;
      if (teamId === "home" && room.state?._homeInput) {
        const hi = room.state._homeInput;
        const { shootReleased, passReleased, ...rest } = input;
        Object.assign(hi, rest);
        if (shootReleased) hi.shootReleased = true;
        if (passReleased) hi.passReleased = true;
      } else if (teamId === "away" && room.state?._awayInput) {
        const ai = room.state._awayInput;
        const { shootReleased, passReleased, ...rest } = input;
        Object.assign(ai, rest);
        if (shootReleased) ai.shootReleased = true;
        if (passReleased) ai.passReleased = true;
      }
    },
    close(ws: any) {
      const { matchId, playerId } = ws.data;
      const room = rooms.get(matchId);
      if (!room) return;
      // Only remove if this is still the current socket (not replaced by a reconnect)
      const current = room.players.get(playerId);
      if (current && current.ws === ws) {
        room.players.delete(playerId);
        console.log(`[Room ${matchId}] ${playerId} left (${room.players.size} left)`);
        broadcast(matchId, { event: "player_disconnected", data: { playerId } }, server);
        if (room.tickInterval && room.players.size < 2) {
          clearInterval(room.tickInterval);
          room.tickInterval = null;
        }
        if (room.players.size === 0) { rooms.delete(matchId); }
      }
    },
  },
});

console.log(`⚽ KickOff 3D WS → ws://localhost:${server.port}/ws`);
