import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const BET_CONTRACT = process.env.NEXT_PUBLIC_KICKOFF_BET ?? "";
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY;

const BET_ABI = [
  "function reportResult(uint64 betId, bool playerWon, bool isDraw) external",
  "function claim(uint64 betId) external",
];

export async function POST(req: NextRequest) {
  try {
    const { betId, playerWon, isDraw } = await req.json();

    if (!BET_CONTRACT) {
      return NextResponse.json({ error: "BET_CONTRACT not set" }, { status: 500 });
    }
    if (!ORACLE_KEY) {
      return NextResponse.json({ error: "ORACLE_PRIVATE_KEY not set" }, { status: 500 });
    }
    if (typeof betId !== "number") {
      return NextResponse.json({ error: "betId required" }, { status: 400 });
    }

    const provider = new JsonRpcProvider(RPC_URL, undefined, { polling: false });
    const signer = new Wallet(ORACLE_KEY, provider);
    const contract = new Contract(BET_CONTRACT, BET_ABI, signer);

    const reportTx = await contract.reportResult(betId, !!playerWon, !!isDraw);
    await reportTx.wait();

    let claimTxHash: string | null = null;
    if (playerWon && !isDraw) {
      const claimTx = await contract.claim(betId);
      await claimTx.wait();
      claimTxHash = claimTx.hash;
    }

    return NextResponse.json({
      ok: true,
      reportTxHash: reportTx.hash,
      claimTxHash,
    });
  } catch (err) {
    console.error("[Oracle] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oracle failed" },
      { status: 500 },
    );
  }
}
