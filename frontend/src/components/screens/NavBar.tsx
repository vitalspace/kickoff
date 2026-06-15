"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Trophy, Wallet, User, Store, Menu, X, Link, Shield } from "lucide-react";
import { useWalletStore } from "@/stores/useWalletStore";
import { walletService } from "@/lib/services/walletService";

type NavView = "play" | "squad" | "leaderboard" | "wallet" | "market" | "profile";

interface NavBarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

export type { NavView };

const NAV_ITEMS: { id: NavView; label: string; icon: typeof Gamepad2 }[] = [
  { id: "play", label: "PLAY", icon: Gamepad2 },
  { id: "squad", label: "SQUAD", icon: Shield },
  { id: "leaderboard", label: "LEADERBOARD", icon: Trophy },
  { id: "market", label: "MARKET", icon: Store },
  { id: "wallet", label: "WALLET", icon: Wallet },
  { id: "profile", label: "PROFILE", icon: User },
];

export default function NavBar({ activeView, onViewChange }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isConnected, isConnecting } = useWalletStore();

  const handleSelect = (id: NavView) => {
    onViewChange(id);
    setMobileOpen(false);
  };

  const handleConnectWallet = () => {
    walletService.connect();
  };

  return (
    <nav className="relative z-50">
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-1 bg-[rgba(4,15,8,0.85)] border border-[rgba(212,175,55,0.25)] rounded-lg backdrop-blur-sm px-1 py-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest transition-all ${
                active
                  ? "text-[#040F08]"
                  : "text-[#7D9B8C] hover:text-[#D4AF37]"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-md"
                  style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon size={12} />
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Connect Wallet Button - only show when not connected */}
        {!isConnected && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest text-[#040F08] disabled:opacity-50 disabled:cursor-not-allowed ml-1"
            style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
          >
            <Link size={12} />
            {isConnecting ? "CONNECTING..." : "CONNECT"}
          </motion.button>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        className="sm:hidden p-2 glass-panel border border-[rgba(212,175,55,0.3)] rounded-lg text-[#D4AF37]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 sm:hidden bg-[rgba(4,15,8,0.95)] border border-[rgba(212,175,55,0.25)] rounded-lg backdrop-blur-sm p-1 min-w-[160px]"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest transition-all ${
                    active
                      ? "bg-gradient-to-r from-[#D4AF37] to-[#C59E30] text-[#040F08]"
                      : "text-[#7D9B8C] hover:text-white hover:bg-[#0F2A1D]"
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
            
            {/* Connect Wallet Button - only show when not connected */}
            {!isConnected && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest text-[#040F08] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
              >
                <Link size={13} />
                {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
