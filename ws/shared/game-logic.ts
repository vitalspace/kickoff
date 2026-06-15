// Pure game logic — no THREE.js, no DOM, no "use client"
// Shared between server (Bun WS) and client (engine.ts)

import {
  PITCH_W, PITCH_D, BALL_RADIUS, PLAYER_RADIUS,
  GOAL_W, GOAL_H,
  FORMATION_HOME, FORMATION_AWAY,
  DEFAULT_PLAYER_STATS,
} from "./constants";
import type { TeamId, PlayerStats } from "./constants";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Vec3 { x: number; y: number; z: number }

export interface InputState {
  up: boolean; down: boolean; left: boolean; right: boolean;
  sprint: boolean; shoot: boolean; pass: boolean;
  shootHeld: boolean; shootReleased: boolean;
  passHeld: boolean; passReleased: boolean;
}

export interface Player {
  id: number; teamId: TeamId;
  pos: Vec3; vel: Vec3;
  isGK: boolean; hasBall: boolean;
  tackleCooldown: number;
  facing: number;
  stats: PlayerStats;
}

export interface GameLoopState {
  ball: Vec3; ballVel: Vec3;
  players: Player[];
  possession: TeamId | null;
  possessorId: number | null;
  score: { home: number; away: number };
  goalFlash: TeamId | null; goalFlashTimer: number;
  commentary: string; matchTime: number;
  possession_pct: { home: number; away: number };
  kickCooldown: number;
  shootCooldown: number;
  shootPower: number;
  isCharging: boolean;
  passPower: number;
  isPassCharging: boolean;
  lastPasserId: number | null;
  lastKickerId: number | null;
  awayShootPower: number;
  awayIsCharging: boolean;
  awayPassPower: number;
  awayIsPassCharging: boolean;
}

export interface SyncState {
  ball: Vec3;
  ballVel: Vec3;
  players: {
    id: number;
    teamId: "home" | "away";
    pos: Vec3;
    facing: number;
    isGK: boolean;
    hasBall: boolean;
  }[];
  possession: "home" | "away" | null;
  possessorId: number | null;
  score: { home: number; away: number };
  matchTime: number;
  possession_pct: { home: number; away: number };
  goalFlash: "home" | "away" | null;
  commentary: string;
  shootPower: number;
  isCharging: boolean;
  passPower: number;
  isPassCharging: boolean;
  awayShootPower: number;
  awayIsCharging: boolean;
  awayPassPower: number;
  awayIsPassCharging: boolean;
}

export function createInputState(): InputState {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, shoot: false, pass: false,
    shootHeld: false, shootReleased: false,
    passHeld: false, passReleased: false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const dist2D = (a: Vec3, b: Vec3) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const GX = PITCH_W / 2;
const GZ = PITCH_D / 2;

// ─── Difficulty ───────────────────────────────────────────────────────────────
export const DIFFICULTY = {
  amateur:   { speed: 5.0, shootRange: 35, passChance: 0.008, tackleChance: 0.25 },
  pro:       { speed: 7.0, shootRange: 40, passChance: 0.014, tackleChance: 0.45 },
  legendary: { speed: 9.0, shootRange: 45, passChance: 0.020, tackleChance: 0.65 },
};

export type DifficultyKey = keyof typeof DIFFICULTY;

// ─── AI shoot charging (module-level state) ───────────────────────────────────
const aiShootCharge = new Map<number, number>();

function aiChargeFor(diff: DifficultyKey) {
  switch (diff) {
    case "amateur":   return rand(0.35, 0.75);
    case "pro":       return rand(0.55, 1.05);
    case "legendary": return rand(0.85, 1.35);
  }
}

// ─── Trail type (kept simple, no THREE refs) ─────────────────────────────────
export type TrailType = "shoot" | "pass" | "clear" | "none";

let activeTrail: { type: TrailType; power: number } = { type: "none", power: 0 };
export function setActiveTrail(t: TrailType, power: number) {
  activeTrail = { type: t, power };
}
export function getActiveTrail() {
  return activeTrail;
}

// ─── State creation ───────────────────────────────────────────────────────────
function mkPlayer(id: number, teamId: TeamId, fx: number, fz: number, isGK: boolean, stats?: PlayerStats): Player {
  return {
    id, teamId,
    pos: { x: fx, y: 0, z: fz }, vel: { x: 0, y: 0, z: 0 },
    isGK, hasBall: false,
    tackleCooldown: 0,
    facing: teamId === "home" ? Math.PI / 2 : -Math.PI / 2,
    stats: stats ?? { ...DEFAULT_PLAYER_STATS },
  };
}

export function mkState(
  homeStats?: (PlayerStats | undefined)[],
  awayStats?: (PlayerStats | undefined)[],
): GameLoopState {
  return {
    ball: { x: 0, y: BALL_RADIUS, z: 0 },
    ballVel: { x: 1.5, y: 0.2, z: 0.5 },
    players: [
      ...FORMATION_HOME.map((f, i) => mkPlayer(i, "home", f.x, f.z, f.isGK, homeStats?.[i])),
      ...FORMATION_AWAY.map((f, i) => mkPlayer(i + 8, "away", f.x, f.z, f.isGK, awayStats?.[i])),
    ],
    possession: null, possessorId: null,
    score: { home: 0, away: 0 },
    goalFlash: null, goalFlashTimer: 0,
    commentary: 'COMMENTATOR: "The referee blows the whistle — KickOff 3D is underway!"',
    matchTime: 0,
    possession_pct: { home: 50, away: 50 },
    kickCooldown: 0, shootCooldown: 0,
    shootPower: 0, isCharging: false,
    passPower: 0, isPassCharging: false,
    lastPasserId: null,
    lastKickerId: null,
    awayShootPower: 0, awayIsCharging: false,
    awayPassPower: 0, awayIsPassCharging: false,
  };
}

// ─── Kick ─────────────────────────────────────────────────────────────────────
function kick(
  s: GameLoopState,
  tx: number, tz: number,
  power: number, lift: number,
  kickerId?: number,
  trailType: TrailType = "none",
  trailPower: number = 0.5,
) {
  const dx = tx - s.ball.x, dz = tz - s.ball.z;
  const m = Math.sqrt(dx * dx + dz * dz) || 1;
  s.ballVel.x = (dx / m) * power;
  s.ballVel.z = (dz / m) * power;
  s.ballVel.y = lift;
  s.possessorId = null;
  s.possession = null;
  s.lastPasserId = null;
  s.lastKickerId = kickerId ?? null;
  s.players.forEach(p => p.hasBall = false);
  s.kickCooldown = 0.5;
  s.shootCooldown = kickerId !== undefined ? 1.2 : 0;
  aiShootCharge.clear();
  setActiveTrail(trailType, trailPower);
}

export function resetKickoff(s: GameLoopState) {
  s.ball = { x: 0, y: BALL_RADIUS, z: 0 };
  s.ballVel = { x: rand(-2, 2), y: 0.3, z: rand(-2, 2) };
  s.possessorId = null; s.possession = null;
  s.lastPasserId = null;
  s.lastKickerId = null;
  s.kickCooldown = 0.8; s.shootCooldown = 0;
  s.players.forEach(p => { p.hasBall = false; p.tackleCooldown = 0; });
  FORMATION_HOME.forEach((f, i) => { s.players[i].pos = { x: f.x, y: 0, z: f.z }; s.players[i].facing = Math.PI / 2; });
  FORMATION_AWAY.forEach((f, i) => { s.players[i + 8].pos = { x: f.x, y: 0, z: f.z }; s.players[i + 8].facing = -Math.PI / 2; });
  setActiveTrail("none", 0);
}

// ─── Move helper ──────────────────────────────────────────────────────────────
function movePlayer(p: Player, tx: number, tz: number, speed: number, dt: number) {
  const dx = tx - p.pos.x, dz = tz - p.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
  if (d > 0.25) {
    p.pos.x += (dx / d) * speed * dt;
    p.pos.z += (dz / d) * speed * dt;
    p.facing = Math.atan2(dx / d, dz / d);
  }
  p.pos.x = clamp(p.pos.x, -GX + 0.5, GX - 0.5);
  p.pos.z = clamp(p.pos.z, -GZ + 0.5, GZ - 0.5);
}

// ─── Main tick ────────────────────────────────────────────────────────────────
export function gameTick(
  s: GameLoopState,
  dt: number,
  inp: InputState,
  diff: DifficultyKey,
  myTeam: TeamId,
  awayInp?: InputState,
): { goal: TeamId | null; scorerId: number | null } {
  const cfg = DIFFICULTY[diff];

  // Timers
  if (s.kickCooldown > 0) s.kickCooldown = Math.max(0, s.kickCooldown - dt);
  if (s.shootCooldown > 0) s.shootCooldown = Math.max(0, s.shootCooldown - dt);
  s.players.forEach(p => { if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt); });

  // Ball physics
  if (s.possessorId === null) {
    s.ballVel.x *= 0.972; s.ballVel.z *= 0.972;
    s.ballVel.y -= 14 * dt;
    s.ball.x += s.ballVel.x * dt;
    s.ball.y += s.ballVel.y * dt;
    s.ball.z += s.ballVel.z * dt;
    if (s.ball.y <= BALL_RADIUS) { s.ball.y = BALL_RADIUS; s.ballVel.y = Math.abs(s.ballVel.y) * 0.45; }
    if (Math.abs(s.ball.z) > GZ - 0.3) { s.ballVel.z *= -0.55; s.ball.z = clamp(s.ball.z, -(GZ - 0.3), GZ - 0.3); }
    const inGoalMouth = Math.abs(s.ball.z) < GOAL_W / 2;
    if (!inGoalMouth && Math.abs(s.ball.x) > GX - 0.3) { s.ballVel.x *= -0.55; s.ball.x = clamp(s.ball.x, -(GX - 0.3), GX - 0.3); }
  }

  // Glue ball in front of carrier
  if (s.possessorId !== null) {
    const c = s.players.find(p => p.id === s.possessorId);
    if (c) {
      s.ball.x = c.pos.x + Math.sin(c.facing) * 1.2;
      s.ball.z = c.pos.z + Math.cos(c.facing) * 1.2;
      s.ball.y = BALL_RADIUS;
      s.ballVel.x = s.ballVel.z = s.ballVel.y = 0;
    }
  }

  // Goal detection
  const inGoalMouth = Math.abs(s.ball.z) < GOAL_W / 2 && s.ball.y <= GOAL_H + 0.2;
  if (inGoalMouth && s.ball.x >= GX - 1) {
    const scorerId = s.lastKickerId;
    s.score.home++; s.goalFlash = "home"; s.goalFlashTimer = 3;
    resetKickoff(s); return { goal: "home", scorerId };
  }
  if (inGoalMouth && s.ball.x <= -GX + 1) {
    const scorerId = s.lastKickerId;
    s.score.away++; s.goalFlash = "away"; s.goalFlashTimer = 3;
    resetKickoff(s); return { goal: "away", scorerId };
  }

  // Pickup / tackle
  const myPlayer = s.players
    .filter(p => p.teamId === myTeam && !p.isGK)
    .sort((a, b) => dist2D(a.pos, s.ball) - dist2D(b.pos, s.ball))[0];

  if (s.kickCooldown <= 0) {
    const PICKUP_R = PLAYER_RADIUS + BALL_RADIUS + 1.8;
    const TACKLE_R = PLAYER_RADIUS + BALL_RADIUS + 2.5;

    let nearDist = Infinity, nearId = -1;
    s.players.forEach(p => { const d = dist2D(p.pos, s.ball); if (d < nearDist) { nearDist = d; nearId = p.id; } });

    if (nearDist < PICKUP_R) {
      const nearest = s.players.find(p => p.id === nearId)!;

      if (s.possessorId === null) {
        const blockedShooter = nearest.teamId === myTeam && s.shootCooldown > 0;
        if (!blockedShooter) {
          s.possessorId = nearId;
          s.possession = nearest.teamId;
          s.players.forEach(p => p.hasBall = p.id === nearId);
          setActiveTrail("none", 0);
        }
      } else {
        const possessor = s.players.find(p => p.id === s.possessorId)!;
        if (nearest.teamId !== possessor.teamId && nearest.tackleCooldown <= 0) {
          const isHumanTackling = nearest.teamId === myTeam;
          const chance = isHumanTackling ? 0.55 : cfg.tackleChance;
          if (Math.random() < chance) {
            const nx = s.ball.x - possessor.pos.x, nz = s.ball.z - possessor.pos.z;
            const nm = Math.sqrt(nx * nx + nz * nz) || 1;
            s.ballVel.x = (nx / nm) * rand(3, 7) + rand(-2, 2);
            s.ballVel.z = (nz / nm) * rand(3, 7) + rand(-2, 2);
            s.ballVel.y = rand(0.2, 1.0);
            s.possessorId = null; s.possession = null; s.kickCooldown = 0.25;
            s.lastPasserId = null;
            s.players.forEach(p => p.hasBall = false);
            setActiveTrail("none", 0);
            nearest.tackleCooldown = 0.4;
            possessor.tackleCooldown = 0.3;
          } else {
            nearest.tackleCooldown = 0.2;
          }
        }
      }
    }

    if (myPlayer && s.possessorId !== null && s.possessorId !== myPlayer.id) {
      const dToCarrier = dist2D(myPlayer.pos, s.ball);
      const possessor = s.players.find(p => p.id === s.possessorId)!;
      if (
        dToCarrier < TACKLE_R &&
        possessor.teamId !== myTeam &&
        myPlayer.tackleCooldown <= 0 &&
        nearId === myPlayer.id
      ) {
        if (Math.random() < 0.55) {
          const nx = s.ball.x - possessor.pos.x, nz = s.ball.z - possessor.pos.z;
          const nm = Math.sqrt(nx * nx + nz * nz) || 1;
          s.ballVel.x = (nx / nm) * rand(3, 7) + rand(-2, 2);
          s.ballVel.z = (nz / nm) * rand(3, 7) + rand(-2, 2);
          s.ballVel.y = rand(0.2, 1.0);
          s.possessorId = null; s.possession = null; s.kickCooldown = 0.25;
          s.lastPasserId = null;
          s.players.forEach(p => p.hasBall = false);
          setActiveTrail("none", 0);
          myPlayer.tackleCooldown = 0.4;
          possessor.tackleCooldown = 0.3;
        } else {
          myPlayer.tackleCooldown = 0.2;
        }
      }
    }
  }

  // Human player
  if (myPlayer) {
    const spd = 8.5 * (inp.sprint ? 1.65 : 1);
    let mx = 0, mz = 0;
    if (inp.up) mz -= 1;
    if (inp.down) mz += 1;
    if (inp.left) mx -= myTeam === "home" ? 1 : -1;
    if (inp.right) mx += myTeam === "home" ? 1 : -1;
    const ml = Math.sqrt(mx * mx + mz * mz) || 1;
    if (mx !== 0 || mz !== 0) {
      myPlayer.pos.x += (mx / ml) * spd * dt;
      myPlayer.pos.z += (mz / ml) * spd * dt;
      myPlayer.facing = Math.atan2(mx / ml, mz / ml);
    } else if (s.possessorId === myPlayer.id) {
      myPlayer.facing = myTeam === "home" ? Math.PI / 2 : -Math.PI / 2;
    }
    myPlayer.pos.x = clamp(myPlayer.pos.x, -GX + 1, GX - 1);
    myPlayer.pos.z = clamp(myPlayer.pos.z, -GZ + 1, GZ - 1);

    // Shoot
    if (inp.shootHeld && s.possessorId === myPlayer.id && !s.isCharging) {
      s.isCharging = true; s.shootPower = 0;
    }
    if (s.isCharging && inp.shootHeld) {
      s.shootPower = Math.min(1, s.shootPower + dt);
    }
    if (inp.shootReleased && s.isCharging) {
      s.isCharging = false;
      if (s.possessorId === myPlayer.id) {
        const power = Math.max(0.1, s.shootPower);
        const tgx = myTeam === "home" ? GX : -GX;
        const cz = s.ball.z >= 0 ? -(GOAL_W / 2 - 0.4) : (GOAL_W / 2 - 0.4);
        const shootSpeed = 15 + power * 25;
        const shootLift = 0.8 + power * 3.5;
        kick(s, tgx, cz, shootSpeed, shootLift, myPlayer.id, "shoot", power);
        s.shootPower = 0;
      }
    }
    inp.shootReleased = false;
    if (s.isCharging && s.possessorId !== myPlayer.id) {
      s.isCharging = false; s.shootPower = 0;
    }

    // Pass
    if (inp.passHeld && s.possessorId === myPlayer.id && !s.isPassCharging && !s.isCharging) {
      s.isPassCharging = true; s.passPower = 0;
    }
    if (s.isPassCharging && inp.passHeld) {
      s.passPower = Math.min(1, s.passPower + dt);
    }
    if (inp.passReleased && s.isPassCharging) {
      s.isPassCharging = false; inp.pass = false;
      if (s.possessorId === myPlayer.id) {
        const tgx = myTeam === "home" ? GX : -GX;
        const mate = s.players
          .filter(t => t.teamId === myTeam && t.id !== myPlayer.id && !t.isGK)
          .sort((a, b) => Math.abs(a.pos.x - tgx) - Math.abs(b.pos.x - tgx))[0];
        if (mate) {
          const power = Math.max(0.1, s.passPower);
          const passSpeed = 12 + power * 18;
          const passLift = 0.4 + power * 1.0;
          kick(s, mate.pos.x, mate.pos.z, passSpeed, passLift, myPlayer.id, "pass", power);
        }
        s.passPower = 0;
      }
    }
    inp.passReleased = false;
    if (s.isPassCharging && (s.possessorId !== myPlayer.id || s.isCharging)) {
      s.isPassCharging = false; s.passPower = 0;
    }
    if (inp.pass && !s.isPassCharging && s.possessorId === myPlayer.id && !inp.passHeld) {
      inp.pass = false;
      const tgx = myTeam === "home" ? GX : -GX;
      const mate = s.players
        .filter(t => t.teamId === myTeam && t.id !== myPlayer.id && !t.isGK)
        .sort((a, b) => Math.abs(a.pos.x - tgx) - Math.abs(b.pos.x - tgx))[0];
      if (mate) kick(s, mate.pos.x, mate.pos.z, rand(18, 22), rand(0.8, 1.2), myPlayer.id, "pass", 0.4);
    }
  }

  // Away team human player (multiplayer)
  const awayPlayer = awayInp ? s.players
    .filter(p => p.teamId === "away" && !p.isGK)
    .sort((a, b) => dist2D(a.pos, s.ball) - dist2D(b.pos, s.ball))[0] : null;

  if (awayPlayer && awayInp) {
    const spd = 8.5 * (awayInp.sprint ? 1.65 : 1);
    let mx = 0, mz = 0;
    if (awayInp.up) mz -= 1;
    if (awayInp.down) mz += 1;
    if (awayInp.left) mx -= 1;
    if (awayInp.right) mx += 1;
    const ml = Math.sqrt(mx * mx + mz * mz) || 1;
    if (mx !== 0 || mz !== 0) {
      awayPlayer.pos.x += (mx / ml) * spd * dt;
      awayPlayer.pos.z += (mz / ml) * spd * dt;
      awayPlayer.facing = Math.atan2(mx / ml, mz / ml);
    } else if (s.possessorId === awayPlayer.id) {
      awayPlayer.facing = -Math.PI / 2;
    }
    awayPlayer.pos.x = clamp(awayPlayer.pos.x, -GX + 1, GX - 1);
    awayPlayer.pos.z = clamp(awayPlayer.pos.z, -GZ + 1, GZ - 1);

    // Away shoot (uses dedicated away charging state)
    if (awayInp.shootHeld && s.possessorId === awayPlayer.id && !s.awayIsCharging) {
      s.awayIsCharging = true; s.awayShootPower = 0;
    }
    if (s.awayIsCharging && awayInp.shootHeld) {
      s.awayShootPower = Math.min(1, s.awayShootPower + dt);
    }
    if (awayInp.shootReleased && s.awayIsCharging) {
      s.awayIsCharging = false;
      if (s.possessorId === awayPlayer.id) {
        const power = Math.max(0.1, s.awayShootPower);
        const tgx = -GX;
        const cz = s.ball.z >= 0 ? -(GOAL_W / 2 - 0.4) : (GOAL_W / 2 - 0.4);
        kick(s, tgx, cz, 15 + power * 25, 0.8 + power * 3.5, awayPlayer.id, "shoot", power);
        s.awayShootPower = 0;
      }
    }
    awayInp.shootReleased = false;
    if (s.awayIsCharging && s.possessorId !== awayPlayer.id) {
      s.awayIsCharging = false; s.awayShootPower = 0;
    }

    // Away pass (uses dedicated away charging state)
    if (awayInp.passHeld && s.possessorId === awayPlayer.id && !s.awayIsPassCharging && !s.awayIsCharging) {
      s.awayIsPassCharging = true; s.awayPassPower = 0;
    }
    if (s.awayIsPassCharging && awayInp.passHeld) {
      s.awayPassPower = Math.min(1, s.awayPassPower + dt);
    }
    if (awayInp.passReleased && s.awayIsPassCharging) {
      s.awayIsPassCharging = false; awayInp.pass = false;
      if (s.possessorId === awayPlayer.id) {
        const tgx = -GX;
        const mate = s.players
          .filter(t => t.teamId === "away" && t.id !== awayPlayer.id && !t.isGK)
          .sort((a, b) => Math.abs(a.pos.x - tgx) - Math.abs(b.pos.x - tgx))[0];
        if (mate) {
          const power = Math.max(0.1, s.awayPassPower);
          kick(s, mate.pos.x, mate.pos.z, 12 + power * 18, 0.4 + power * 1.0, awayPlayer.id, "pass", power);
        }
        s.awayPassPower = 0;
      }
    }
    awayInp.passReleased = false;
    if (s.awayIsPassCharging && (s.possessorId !== awayPlayer.id || s.awayIsCharging)) {
      s.awayIsPassCharging = false; s.awayPassPower = 0;
    }
    if (awayInp.pass && !s.awayIsPassCharging && s.possessorId === awayPlayer.id && !awayInp.passHeld) {
      awayInp.pass = false;
      const tgx = -GX;
      const mate = s.players
        .filter(t => t.teamId === "away" && t.id !== awayPlayer.id && !t.isGK)
        .sort((a, b) => Math.abs(a.pos.x - tgx) - Math.abs(b.pos.x - tgx))[0];
      if (mate) kick(s, mate.pos.x, mate.pos.z, rand(18, 22), rand(0.8, 1.2), awayPlayer.id, "pass", 0.4);
    }
  }

  // AI players
  const presserIds = new Map<TeamId, number[]>();
  (["home", "away"] as TeamId[]).forEach(tid => {
    const sorted = s.players
      .filter(p => p.teamId === tid && !p.isGK)
      .sort((a, b) => dist2D(a.pos, s.ball) - dist2D(b.pos, s.ball));
    presserIds.set(tid, sorted.slice(0, 3).map(p => p.id));
  });

  s.players.forEach(p => {
    if (p.id === myPlayer?.id) return;
    if (awayPlayer && p.id === awayPlayer.id) return;

    const isHome = p.teamId === "home";
    const aDir = isHome ? 1 : -1;
    const tgx = isHome ? GX : -GX;
    const iCarrier = s.possessorId === p.id;
    const teamHasBall = s.possession === p.teamId;
    const pressers = presserIds.get(p.teamId) ?? [];
    const isPrimary = pressers[0] === p.id;
    const isSupport = pressers[1] === p.id;
    const isSecondSupport = pressers[2] === p.id;

    // Goalkeeper
    if (p.isGK) {
      const gkBaseX = isHome ? -GX + 1.8 : GX - 1.8;
      const ballNear = dist2D(p.pos, s.ball) < 14;
      const rushX = ballNear ? (isHome ? -GX + 5.5 : GX - 5.5) : gkBaseX;
      const targetX = iCarrier ? gkBaseX : rushX;
      const targetZ = clamp(s.ball.z, -GOAL_W / 2 + 0.5, GOAL_W / 2 - 0.5);
      movePlayer(p, targetX, targetZ, cfg.speed * 1.1, dt);
      if (iCarrier) {
        kick(s, aDir * rand(28, 40), rand(-10, 10), rand(22, 30), rand(2.5, 3.5), undefined, "clear", 0.7);
        return;
      }
      return;
    }

    // Ball carrier AI
    if (iCarrier) {
      const distToGoal = dist2D(p.pos, { x: tgx, y: 0, z: 0 });

      if (distToGoal < cfg.shootRange) {
        const held = aiShootCharge.get(p.id) ?? 0;
        const need = aiChargeFor(diff);
        if (held === 0) {
          aiShootCharge.set(p.id, 0.0001);
        } else if (held >= need) {
          const power = 0.6 + Math.random() * 0.4;
          const shootSpeed = 15 + power * 25;
          const shootLift = 0.8 + power * 3.5;
          const czSign = s.ball.z >= 0 ? -1 : 1;
          const aimJitter = (1 - power) * 1.4;
          const cz = czSign * (GOAL_W / 2 - 0.4) + rand(-aimJitter, aimJitter);
          kick(s, tgx, cz, shootSpeed, shootLift, undefined, "shoot", power);
          aiShootCharge.delete(p.id);
          return;
        } else {
          aiShootCharge.set(p.id, held + dt);
        }
      } else {
        aiShootCharge.delete(p.id);
      }

      const blockers = s.players
        .filter(o => o.teamId !== p.teamId && !o.isGK)
        .filter(o => {
          const betweenX = isHome
            ? o.pos.x > p.pos.x && o.pos.x < tgx
            : o.pos.x < p.pos.x && o.pos.x > tgx;
          return betweenX && Math.abs(o.pos.z - p.pos.z) < 4;
        });

      const underHeavyPressure = s.players.some(o => o.teamId !== p.teamId && dist2D(o.pos, p.pos) < 2.5);
      const canDribblePast = blockers.length > 0 && blockers.length <= 2;

      const mateAhead = s.players
        .filter(t => t.teamId === p.teamId && t.id !== p.id && !t.isGK)
        .filter(t => t.id !== s.lastPasserId)
        .filter(t => Math.abs(t.pos.x - tgx) < Math.abs(p.pos.x - tgx) - 5)
        .filter(t => !s.players.some(o => o.teamId !== p.teamId && dist2D(o.pos, t.pos) < 3))[0];

      const shouldPass = (underHeavyPressure && !canDribblePast) || (mateAhead && Math.random() < 0.3);

      if (shouldPass && Math.random() < cfg.passChance * 8) {
        const target = mateAhead || s.players
          .filter(t => t.teamId === p.teamId && t.id !== p.id && !t.isGK)
          .filter(t => t.id !== s.lastPasserId)
          .sort((a, b) => Math.abs(a.pos.x - tgx) - Math.abs(b.pos.x - tgx))[0];
        if (target) {
          s.lastPasserId = p.id;
          const dist = dist2D(target.pos, p.pos);
          const power = clamp(0.25 + dist / 30 + (underHeavyPressure ? 0.2 : 0), 0.25, 1.0);
          const passSpeed = 12 + power * 18;
          const passLift = 0.4 + power * 1.0;
          kick(s, clamp(target.pos.x, -GX + 2, GX - 2), clamp(target.pos.z, -GZ + 2, GZ - 2), passSpeed, passLift, undefined, "pass", power);
          return;
        }
      }

      // Dribble
      const gdx = tgx - p.pos.x;
      const gdz = (0 - p.pos.z) * 0.4;
      let dodgeZ = 0;
      if (blockers.length > 0) {
        const blocker = blockers[0];
        const side = blocker.pos.z > p.pos.z ? -1 : 1;
        dodgeZ = side * 5;
      }
      const finalGdz = gdz + dodgeZ;
      const gmag = Math.sqrt(gdx * gdx + finalGdz * finalGdz) || 1;
      const gnx = gdx / gmag;
      const gnz = finalGdz / gmag;
      p.pos.x += gnx * cfg.speed * dt;
      p.pos.z += gnz * cfg.speed * dt;
      p.pos.x = clamp(p.pos.x, -GX + 0.5, GX - 0.5);
      p.pos.z = clamp(p.pos.z, -GZ + 0.5, GZ - 0.5);
      p.facing = Math.atan2(gnx, gnz);
      return;
    }

    // Non-carrier AI
    let tx = p.pos.x, tz = p.pos.z;

    if (isPrimary && !teamHasBall) {
      tx = s.ball.x; tz = s.ball.z;
    } else if (isSupport && !teamHasBall) {
      const side = p.pos.z >= s.ball.z ? 3.5 : -3.5;
      tx = clamp(s.ball.x - aDir * 3, -GX + 2, GX - 2);
      tz = clamp(s.ball.z + side, -GZ + 2, GZ - 2);
    } else if (isSecondSupport && !teamHasBall) {
      const side = p.pos.z >= s.ball.z ? -4 : 4;
      tx = clamp(s.ball.x - aDir * 5, -GX + 2, GX - 2);
      tz = clamp(s.ball.z + side, -GZ + 2, GZ - 2);
    } else if (teamHasBall) {
      const distToBall = dist2D(p.pos, s.ball);
      const ahead = distToBall < 15;
      if (ahead) {
        tx = clamp(s.ball.x + aDir * rand(10, 16), -GX + 3, GX - 3);
        tz = clamp(s.ball.z + (p.pos.z - s.ball.z) * 1.5, -GZ + 2, GZ - 2);
      } else {
        tx = clamp(s.ball.x + aDir * 8, -GX + 3, GX - 3);
        tz = clamp(p.pos.z, -GZ + 3, GZ - 3);
      }
    } else {
      const fm = isHome ? FORMATION_HOME : FORMATION_AWAY;
      const fi = clamp(isHome ? (p.id % 8) : ((p.id - 8) % 8), 0, fm.length - 1);
      const fPos = fm[fi];
      tx = clamp(fPos.x - aDir * 4 + (s.ball.x - fPos.x) * 0.08, -GX + 2, GX - 2);
      tz = fPos.z + (s.ball.z - fPos.z) * 0.07;
    }

    movePlayer(p, tx, tz, cfg.speed, dt);
  });

  // Player separation
  const SEP = PLAYER_RADIUS * 2 + 0.2;
  const carrierId = s.possessorId;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < s.players.length; i++) {
      for (let j = i + 1; j < s.players.length; j++) {
        const a = s.players[i], b = s.players[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        if (d < SEP) {
          const push = (SEP - d) / 2;
          const nx = dx / d, nz = dz / d;
          const aLocked = a.id === myPlayer?.id || a.id === carrierId;
          const bLocked = b.id === myPlayer?.id || b.id === carrierId;
          if (!aLocked) { a.pos.x -= nx * push; a.pos.z -= nz * push; }
          if (!bLocked) { b.pos.x += nx * push; b.pos.z += nz * push; }
          a.pos.x = clamp(a.pos.x, -GX + 0.5, GX - 0.5); a.pos.z = clamp(a.pos.z, -GZ + 0.5, GZ - 0.5);
          b.pos.x = clamp(b.pos.x, -GX + 0.5, GX - 0.5); b.pos.z = clamp(b.pos.z, -GZ + 0.5, GZ - 0.5);
        }
      }
    }
  }

  // Re-lock carrier facing (AI only — humans drive facing via input)
  if (carrierId !== null) {
    const carrier = s.players.find(p => p.id === carrierId);
    if (carrier && !carrier.isGK) {
      const isHumanCarrier =
        (myPlayer && carrier.id === myPlayer.id) ||
        (awayPlayer && carrier.id === awayPlayer.id);
      if (!isHumanCarrier) {
        const tgx = carrier.teamId === "home" ? GX : -GX;
        const fdx = tgx - carrier.pos.x;
        const fdz = 0 - carrier.pos.z;
        const fm = Math.sqrt(fdx * fdx + fdz * fdz) || 1;
        carrier.facing = Math.atan2(fdx / fm, fdz / fm);
      }
    }
  }

  // Possession %
  if (s.possession === "home") { s.possession_pct.home = clamp(s.possession_pct.home + 0.07, 30, 75); s.possession_pct.away = 100 - s.possession_pct.home; }
  else if (s.possession === "away") { s.possession_pct.away = clamp(s.possession_pct.away + 0.07, 30, 75); s.possession_pct.home = 100 - s.possession_pct.away; }

  return { goal: null, scorerId: null };
}

// ─── Serialization ────────────────────────────────────────────────────────────
export function toSyncState(s: GameLoopState): SyncState {
  return {
    ball: { ...s.ball },
    ballVel: { ...s.ballVel },
    players: s.players.map(p => ({
      id: p.id,
      teamId: p.teamId,
      pos: { ...p.pos },
      facing: p.facing,
      isGK: p.isGK,
      hasBall: p.hasBall,
    })),
    possession: s.possession,
    possessorId: s.possessorId,
    score: { ...s.score },
    matchTime: s.matchTime,
    possession_pct: { ...s.possession_pct },
    goalFlash: s.goalFlash,
    commentary: s.commentary,
    shootPower: s.shootPower,
    isCharging: s.isCharging,
    passPower: s.passPower,
    isPassCharging: s.isPassCharging,
    awayShootPower: s.awayShootPower,
    awayIsCharging: s.awayIsCharging,
    awayPassPower: s.awayPassPower,
    awayIsPassCharging: s.awayIsPassCharging,
  };
}


