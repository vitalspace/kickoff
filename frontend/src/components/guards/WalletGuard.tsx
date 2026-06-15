"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, RefreshCw } from "lucide-react";
import { useWalletStore } from "@/stores/useWalletStore";
import { walletService } from "@/lib/services/walletService";
import { NETWORK } from "@/lib/config/network";

export default function WalletGuard({
  children,
  fullScreen = true,
}: {
  children: React.ReactNode;
  fullScreen?: boolean;
}) {
  const { isConnected, isConnecting, wrongChain } = useWalletStore();

  useEffect(() => {
    walletService.checkConnection();
  }, []);

  const wrapperClass = fullScreen ? "fixed inset-0 flex items-center justify-center bg-[#040F08]" : "flex flex-col items-center justify-center py-10 text-center w-full";
  const panelClass = fullScreen ? "glass-panel-gold rounded-xl p-8 max-w-sm w-full mx-4 text-center" : "glass-panel-gold rounded-xl p-6 w-full text-center";

  if (isConnecting) {
    if (fullScreen) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#040F08]">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-broadcast font-black text-sm text-[#F3F7F4] tracking-widest">CHECKING WALLET...</p>
          </div>
        </div>
      );
    }
    return (
      <div className={wrapperClass}>
        <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-broadcast font-black text-xs text-[#F3F7F4] tracking-widest">CHECKING WALLET...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={wrapperClass}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={panelClass}
        >
          <div className="w-16 h-16 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center mx-auto mb-4">
            <Wallet size={28} className="text-[#D4AF37]" />
          </div>
          <h2 className="font-broadcast font-bold text-base text-[#F3F7F4] mb-2">WALLET REQUIRED</h2>
          <p className="text-[11px] text-[#7D9B8C] mb-5 leading-relaxed">
            You need to connect your wallet to access this section. Link your MetaMask to continue.
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => walletService.connect()}
            className="w-full px-6 py-2.5 font-broadcast font-bold text-xs tracking-widest rounded-lg text-[#040F08] mb-2"
            style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
          >
            CONNECT WALLET
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => { walletService.addNetwork().catch(() => {}); }}
            className="w-full px-5 py-2 font-broadcast font-bold text-[10px] tracking-widest rounded-lg border border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)] transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={11} />
            Add {NETWORK.chainName} to MetaMask
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (wrongChain) {
    return (
      <div className={wrapperClass}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${panelClass}${fullScreen ? " border border-[rgba(239,68,68,0.3)]" : ""}`}
        >
          <div className="w-16 h-16 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={28} className="text-[#EF4444]" />
          </div>
          <h2 className="font-broadcast font-bold text-base text-[#F3F7F4] mb-2">WRONG NETWORK</h2>
          <p className="text-[11px] text-[#7D9B8C] mb-5 leading-relaxed">
            Please switch to <strong className="text-[#F3F7F4]">{NETWORK.chainName}</strong> (Chain ID: {NETWORK.chainId}) to continue.
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => { walletService.switchChain().catch(() => {}); }}
            className="w-full px-6 py-2.5 font-broadcast font-bold text-xs tracking-widest rounded-lg text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(to right, #EF4444, #DC2626)" }}
          >
            <RefreshCw size={13} />
            Switch to {NETWORK.chainName}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
