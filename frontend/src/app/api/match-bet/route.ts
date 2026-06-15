import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const MATCH_BET_CONTRACT = process.env.NEXT_PUBLIC_KICKOFF_MATCH_BET ?? "";
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY;
if (!ORACLE_KEY) throw new Error("ORACLE_PRIVATE_KEY env var is required");

const MATCH_BET_ABI = [
  "function reportResult(uint64 matchId, uint8 winner) external",
  "function claim(uint64 matchId) external",
  "function getMatch(uint64 matchId) view returns (tuple(uint64 id, address home, address away, uint256 stake, uint8 state, uint8 winner, uint64 createdAt, uint64 joinedAt, uint64 reportedAt))",
];

interface SettleResult {
  ok: true;
  reportTxHash: string | null;
  claimTxHash: string | null;
  already: boolean;
}

// In-flight lock per matchId. Both clients hit this endpoint at the same
// moment when the game ends — without serialising we'd issue concurrent
// `reportResult` + `claim` transactions from the same oracle wallet and
// trip "nonce too low" on the second one.
const inflight = new Map<number, Promise<SettleResult>>();

function isHarmlessTxError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; info?: { error?: { message?: string } } };
  const msg = (e.message || "") + " " + (e.info?.error?.message || "");
  // The opponent's tx beat us: state already moved past LIVE/REPORTED, or our
  // nonce raced theirs. Either way, the settlement happened — not an error.
  return (
    e.code === "NONCE_EXPIRED" ||
    msg.includes("nonce") ||
    msg.includes("InvalidState") ||
    msg.includes("already known")
  );
}

async function settle(matchId: number, winnerCode: number): Promise<SettleResult> {
  const provider = new JsonRpcProvider(RPC_URL, undefined, { polling: false });
  const signer = new Wallet(ORACLE_KEY, provider);
  const contract = new Contract(MATCH_BET_CONTRACT, MATCH_BET_ABI, signer);

  const current = await contract.getMatch(matchId);
  const state = Number(current.state); // 0=OPEN 1=LIVE 2=REPORTED 3=SETTLED 4=CANCELLED

  let reportTxHash: string | null = null;
  if (state === 1) {
    try {
      const tx = await contract.reportResult(matchId, winnerCode);
      await tx.wait();
      reportTxHash = tx.hash;
    } catch (err) {
      if (!isHarmlessTxError(err)) throw err;
    }
  }

  let claimTxHash: string | null = null;
  const refreshed = await contract.getMatch(matchId);
  if (Number(refreshed.state) === 2) {
    try {
      const tx = await contract.claim(matchId);
      await tx.wait();
      claimTxHash = tx.hash;
    } catch (err) {
      if (!isHarmlessTxError(err)) throw err;
    }
  }

  return {
    ok: true,
    reportTxHash,
    claimTxHash,
    already: state >= 3,
  };
}

/**
 * Oracle endpoint for the multiplayer match contract. Reports the result and
 * triggers the claim so the winner (or both, on a draw) gets paid without
 * needing a second wallet signature.
 *
 * Body: { matchId: number, winner: "home" | "away" | null }
 *
 * Both clients call this when the match ends — concurrent calls are
 * coalesced via the per-matchId `inflight` map so the oracle only fires
 * one `reportResult` + one `claim` per match.
 */
export async function POST(req: NextRequest) {
  try {
    const { matchId, winner } = await req.json();

    if (!MATCH_BET_CONTRACT) {
      return NextResponse.json({ error: "MATCH_BET_CONTRACT not set" }, { status: 500 });
    }
    if (typeof matchId !== "number") {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const winnerCode = winner === "home" ? 1 : winner === "away" ? 2 : 0;

    let pending = inflight.get(matchId);
    if (!pending) {
      pending = settle(matchId, winnerCode).finally(() => {
        inflight.delete(matchId);
      });
      inflight.set(matchId, pending);
    }

    const result = await pending;
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Oracle:MatchBet] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oracle failed" },
      { status: 500 },
    );
  }
}
