"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  Sparkles,
  AlertCircle,
  Wallet,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { nftService } from "@/lib/services/nftService";
import { CONTRACTS, isNftDeployed } from "@/lib/config/contracts";
import { NETWORK } from "@/lib/config/network";
import { walletService } from "@/lib/services/walletService";
import { checkBalance } from "@/lib/utils/checkBalance";
import {
  useMarketStore,
  ABILITIES,
  PlayerAttributes,
} from "@/stores/useMarketStore";
import { useWalletStore } from "@/stores/useWalletStore";
import PlayerCard from "@/components/market/PlayerCard";

function truncate(address: string): string {
  if (address.startsWith("0x") && address.length > 10) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  return address;
}

export default function MintTab() {
  const {
    address,
    balance,
    isConnected,
    isConnecting,
    wrongChain,
    chainId,
  } = useWalletStore();
  const myNfts = useMarketStore((s) => s.myNfts);
  const [busy, setBusy] = useState(false);
  const [lastMinted, setLastMinted] = useState<PlayerAttributes | null>(null);

  const ethBalance = (Number(balance) || 0).toFixed(4);
  const mintCost = nftService.mintCost;
  const hasEnoughEth = useMemo(
    () => (Number(balance) || 0) >= Number(mintCost),
    [balance, mintCost],
  );
  const nftDeployed = isNftDeployed();
  const abilityCount = Object.keys(ABILITIES).length;

  // Live-mode wallets auto-recheck on mount so the address is fresh
  // even if the user landed on the tab before connecting.
  useEffect(() => {
    walletService.checkConnection();
  }, []);

  const handleConnect = async () => {
    try {
      await walletService.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      toast.error("Wallet connect failed", { description: msg });
    }
  };

  const handleSwitchChain = async () => {
    try {
      await walletService.switchChain();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Switch failed";
      toast.error("Network switch failed", { description: msg });
    }
  };

  const handleMint = async () => {
    if (!isConnected || !address) {
      toast.error("Wallet not connected", {
        description: "Click CONNECT to link MetaMask first.",
      });
      return;
    }
    if (wrongChain) {
      toast.error("Wrong network", {
        description: `Switch to ${NETWORK.chainName} (chain ${NETWORK.chainId}).`,
      });
      return;
    }
    if (!hasEnoughEth) {
      const costWei = BigInt(Math.floor(Number(mintCost) * 1e18));
      if (!checkBalance(costWei)) return;
    }
    setBusy(true);
    try {
      const result = await nftService.mintCard(address);
      const abilityName = result.card.ability
        ? ` — ${ABILITIES[result.card.ability].label}`
        : "";
      toast.success(`Card #${result.tokenId} minted!${abilityName}`, {
        description: result.txHash
          ? "Confirmed on-chain. Check MY COLLECTION."
          : "Saved locally. Check MY COLLECTION.",
      });
      setLastMinted(result.card);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Minting failed";
      toast.error("Mint failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-5 glass-panel-gold rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#D4AF37]" />
          <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase">
            MINT A PLAYER
          </h3>
        </div>

        {/* Connection state banner */}
        {!isConnected ? (
          <ConnectionBanner
            tone="warn"
            icon={<Wallet size={13} className="text-[#D4AF37]" />}
            title="WALLET NOT CONNECTED"
            subtitle="Link MetaMask to start minting."
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#040F08] disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
            >
              <LinkIcon size={11} />
              {isConnecting ? "CONNECTING..." : "CONNECT METAMASK"}
            </motion.button>
          </ConnectionBanner>
        ) : wrongChain ? (
          <ConnectionBanner
            tone="error"
            icon={<RefreshCw size={13} className="text-[#EF4444]" />}
            title="WRONG NETWORK"
            subtitle={`Switch to ${NETWORK.chainName} (chain ${NETWORK.chainId}). Currently on #${chainId ?? "?"}.`}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleSwitchChain}
              className="w-full py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-white flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(to right, #EF4444, #DC2626)" }}
            >
              <RefreshCw size={11} />
              SWITCH TO {NETWORK.chainName.toUpperCase()}
            </motion.button>
          </ConnectionBanner>
        ) : (
          <ConnectionBanner
            tone="ok"
            icon={<LinkIcon size={13} className="text-[#10B981]" />}
            title="READY"
            subtitle={`Connected as ${truncate(address ?? "")}`}
          />
        )}

        <div className="rounded-lg p-3 bg-[#040F08]/60 border border-[rgba(212,175,55,0.15)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Coins size={16} className="text-[#D4AF37] shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] tracking-widest text-[#7D9B8C] font-broadcast">
                WALLET BALANCE
              </p>
              <p className="font-mono text-xs text-[#F3F7F4] truncate">
                {ethBalance} ETH
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] tracking-widest text-[#7D9B8C] font-broadcast">
              MINT COST
            </p>
            <p className="font-mono text-xs font-bold text-[#D4AF37]">
              {mintCost} ETH
            </p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          onClick={handleMint}
          disabled={busy || !isConnected || wrongChain}
          className="w-full py-3.5 rounded-lg font-broadcast font-black text-base tracking-widest text-[#040F08] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
        >
          <Sparkles size={16} />
          {busy ? "MINTING..." : "MINT"}
        </motion.button>

        <p className="text-[9px] text-[#7D9B8C] leading-relaxed text-center">
          {abilityCount} abilities · ~{Math.round((abilityCount * 6))}% drop chance per mint
        </p>

        {nftDeployed && isConnected && !wrongChain && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)]">
            <AlertCircle size={12} className="text-[#10B981] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#7D9B8C] leading-relaxed">
              Live mode. Mint signs a transaction paying{" "}
              <strong className="text-[#F3F7F4]">{mintCost} ETH</strong> to
              the contract treasury.
            </p>
          </div>
        )}

        {!nftDeployed && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)]">
            <AlertCircle size={12} className="text-[#EF4444] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#7D9B8C] leading-relaxed">
              <strong className="text-[#F3F7F4]">NFT contract not detected.</strong>{" "}
              Loaded address: <code className="text-[#EF4444]">{CONTRACTS.kickOffPlayerNFT}</code>.
              Verify with{" "}
              <code className="text-[#7D9B8C]">cast code {CONTRACTS.kickOffPlayerNFT} --rpc-url http://127.0.0.1:8545</code>.
              If empty, restart Anvil + redeploy + hard-refresh (Ctrl+Shift+R).
            </p>
          </div>
        )}

        <details className="text-[9px] text-[#7D9B8C] mt-auto pt-2 border-t border-[rgba(212,175,55,0.08)]">
          <summary className="cursor-pointer hover:text-[#D4AF37] tracking-wider">
            DEBUG
          </summary>
          <div className="mt-1 space-y-0.5 font-mono break-all">
            <p>NFT: {CONTRACTS.kickOffPlayerNFT}</p>
            <p>Market: {CONTRACTS.kickOffMarket}</p>
            <p>isNftDeployed(): {String(isNftDeployed())}</p>
            <p>chainId (target): {NETWORK.chainId}</p>
            <p>chainId (wallet): {chainId ?? "null"}</p>
            <p>balance: {balance}</p>
          </div>
        </details>
      </div>

      <div className="lg:col-span-7 glass-panel rounded-xl p-5 flex flex-col gap-3 min-h-[420px]">
        <div className="flex items-center justify-between">
          <h3 className="font-broadcast font-bold text-xs text-[#C59E30] uppercase tracking-wider">
            {lastMinted ? "LATEST MINT" : "YOUR CARDS"}
          </h3>
          <span className="text-[10px] text-[#7D9B8C] font-mono">
            {myNfts.length} OWNED
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {lastMinted ? (
              <motion.div
                key={lastMinted.tokenId}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-xs"
              >
                <PlayerCard card={lastMinted} variant="collection" />
              </motion.div>
            ) : myNfts.length > 0 ? (
              <motion.div
                key="latest-owned"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-xs"
              >
                <PlayerCard
                  card={myNfts[myNfts.length - 1]}
                  variant="collection"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10"
              >
                <div className="w-20 h-20 mx-auto mb-3 rounded-full border-2 border-dashed border-[rgba(212,175,55,0.3)] flex items-center justify-center">
                  <Sparkles size={28} className="text-[#D4AF37]/50" />
                </div>
                <p className="text-[#7D9B8C] text-xs font-broadcast tracking-widest">
                  NO CARDS YET
                </p>
                <p className="text-[#7D9B8C] text-[10px] mt-1">
                  {isConnected && !wrongChain
                    ? "Hit MINT to roll your first player."
                    : "Connect your wallet to start."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ConnectionBanner({
  tone,
  icon,
  title,
  subtitle,
  children,
}: {
  tone: "ok" | "warn" | "error";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  const palette = {
    ok: "bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.25)]",
    warn: "bg-[rgba(212,175,55,0.08)] border-[rgba(212,175,55,0.25)]",
    error: "bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)]",
  }[tone];

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg border ${palette}`}>
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="font-broadcast font-bold text-[10px] text-[#F3F7F4] tracking-widest">
            {title}
          </p>
          <p className="text-[10px] text-[#7D9B8C] leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
