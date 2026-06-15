"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  X,
  Trophy,
  Users,
  Shield,
  Wallet,
  Gamepad2,
  Swords,
  Store,
  Target,
} from "lucide-react";

const steps = [
  {
    icon: Gamepad2,
    title: "SELECT MODE",
    desc: "Choose between Play vs AI (single-player) or Play Online (real-time 1v1 multiplayer).",
    color: "#10B981",
  },
  {
    icon: Wallet,
    title: "CONNECT WALLET",
    desc: "Link your MetaMask wallet to access the market, NFTs, and place bets. Online mode works without a wallet.",
    color: "#F59E0B",
  },
  {
    icon: Users,
    title: "CUSTOMIZE TEAM",
    desc: "Set your team name and colors in the Profile tab. Your identity is your wallet address.",
    color: "#3B82F6",
  },
  {
    icon: Shield,
    title: "BUILD YOUR SQUAD",
    desc: "Go to the Squad tab to assign NFT players to your GK, DEF, and MID slots. NFT stats (speed, shooting, etc.) boost your team. No NFTs? Default players work fine.",
    color: "#8B5CF6",
  },
  {
    icon: Target,
    title: "PICK DIFFICULTY",
    desc: "Choose Amateur, Championship, or Legendary. Higher difficulty = faster, smarter AI.",
    color: "#EF4444",
  },
  {
    icon: Swords,
    title: "PLAY THE MATCH",
    desc: "Control your closest player with WASD. Press Space to shoot, E to pass. Hold to charge power. Score goals to win!",
    color: "#D4AF37",
  },
  {
    icon: Trophy,
    title: "EARN REWARDS",
    desc: "Wins earn 100 points, draws 25. Climb the leaderboard. Earn ETH from betting and trading NFTs on the market.",
    color: "#10B981",
  },
  {
    icon: Store,
    title: "THE MARKET",
    desc: "Buy and sell NFT players with ETH. Each NFT has unique stats and abilities. Mint new players or trade existing ones.",
    color: "#EC4899",
  },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Fixed button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-[rgba(212,175,55,0.3)] bg-[rgba(13,31,22,0.9)] backdrop-blur-md text-[#D4AF37] hover:border-[rgba(212,175,55,0.6)] hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all"
      >
        <HelpCircle size={20} />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0a1a0f] shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[rgba(212,175,55,0.1)] bg-[#0a1a0f]/95 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#C59E30] flex items-center justify-center">
                    <HelpCircle size={16} className="text-[#040F08]" />
                  </div>
                  <div>
                    <h2 className="font-broadcast font-black text-sm tracking-widest text-[#F3F7F4]">
                      HOW TO PLAY
                    </h2>
                    <p className="text-[9px] text-[#7D9B8C] tracking-wider">
                      STEP-BY-STEP GUIDE
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg border border-[rgba(212,175,55,0.15)] text-[#7D9B8C] hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.3)] transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Steps */}
              <div className="px-6 py-5 flex flex-col gap-1">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-start gap-4 py-3 group"
                    >
                      {/* Step number + icon */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10"
                          style={{
                            background: `linear-gradient(135deg, ${step.color}20, ${step.color}08)`,
                          }}
                        >
                          <Icon size={18} style={{ color: step.color }} />
                        </div>
                        {i < steps.length - 1 && (
                          <div className="w-px h-3 bg-[rgba(212,175,55,0.15)]" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[9px] font-bold tracking-wider"
                            style={{ color: step.color }}
                          >
                            STEP {i + 1}
                          </span>
                        </div>
                        <p className="font-broadcast font-bold text-xs tracking-widest text-[#F3F7F4] mt-0.5">
                          {step.title}
                        </p>
                        <p className="text-[11px] text-[#7D9B8C] mt-1 leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Controls hint */}
              <div className="px-6 py-4 border-t border-[rgba(212,175,55,0.1)]">
                <p className="font-broadcast font-bold text-[9px] text-[#D4AF37] tracking-widest mb-2">
                  CONTROLS
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#7D9B8C]">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] font-mono text-[9px] text-[#D4AF37]">
                      WASD
                    </kbd>
                    <span>Move player</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] font-mono text-[9px] text-[#D4AF37]">
                      SPACE
                    </kbd>
                    <span>Shoot (hold for power)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] font-mono text-[9px] text-[#D4AF37]">
                      E
                    </kbd>
                    <span>Pass (hold for power)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] font-mono text-[9px] text-[#D4AF37]">
                      Q
                    </kbd>
                    <span>Sprint</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
