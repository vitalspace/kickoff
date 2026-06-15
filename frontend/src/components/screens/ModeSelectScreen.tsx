"use client";

import { motion } from "framer-motion";
import { Bot, Globe, Settings, Trophy, Users, Zap, Shield } from "lucide-react";
import { useGameStore } from "@/stores/useGameStore";
import { GameMode } from "@/lib/game/constants";
import SettingsModal from "@/components/game/SettingsModal";
import { useState } from "react";
import dynamic from "next/dynamic";

const StadiumBackground = dynamic(() => import("@/components/game/StadiumBackground"), { ssr: false });

export default function ModeSelectScreen() {
  const { setGameMode } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);

  const modes: { id: GameMode; label: string; sub: string; icon: typeof Bot; gradient: string; accent: string }[] = [
    {
      id: "ai",
      label: "PLAY VS AI",
      sub: "Challenge the CPU opponent",
      icon: Bot,
      gradient: "linear-gradient(135deg, #10B981, #059669)",
      accent: "#10B981",
    },
    {
      id: "online",
      label: "PLAY ONLINE",
      sub: "Matchmake with another player",
      icon: Globe,
      gradient: "linear-gradient(135deg, #3B82F6, #2563EB)",
      accent: "#3B82F6",
    },
  ];

  const features = [
    { icon: Trophy, label: "LEADERBOARD", desc: "Compete for the top" },
    { icon: Users, label: "MULTIPLAYER", desc: "Real-time 1v1 matches" },
    { icon: Zap, label: "RAPIER PHYSICS", desc: "Realistic ball dynamics" },
    { icon: Shield, label: "NFT SQUADS", desc: "Own your players" },
  ];

  return (
    <div className="relative min-h-svh bg-[#040F08] flex flex-col overflow-hidden">
      {/* 3D Stadium background */}
      <StadiumBackground />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 pointer-events-none bg-[#040F08]/60" />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            background: i % 4 === 0 ? "#D4AF37" : i % 4 === 1 ? "#10B981" : i % 4 === 2 ? "#3B82F6" : "#7D9B8C",
            left: `${5 + (i * 4.7) % 90}%`,
            top: `${8 + (i * 6.3) % 80}%`,
          }}
          animate={{
            y: [0, -20 - (i % 5) * 8, 0],
            opacity: [0.1, 0.35 + (i % 3) * 0.1, 0.1],
          }}
          transition={{
            duration: 4 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#D4AF37] to-[#C59E30] flex items-center justify-center">
            <span className="font-broadcast font-black text-xs text-[#040F08]">K3</span>
          </div>
          <span className="font-broadcast font-bold text-[11px] text-[#7D9B8C] tracking-widest hidden sm:block">KICKOFF 3D</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg border border-[rgba(212,175,55,0.15)] text-[#7D9B8C] hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.3)] transition-all"
        >
          <Settings size={16} />
        </motion.button>
      </motion.div>

      {/* Main content — vertically centered */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className="w-full max-w-lg flex flex-col items-center gap-8">
          {/* Title block */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)] rounded-full mb-5"
            >
              <svg className="text-[#D4AF37] animate-spin" fill="none" height="12" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m12 3-1.912 5.886L4.2 9l4.764 3.82L7.05 18.7 12 15l4.95 3.7-1.914-5.88L19.8 9l-5.888-.114L12 3z" />
              </svg>
              <span className="text-[9px] uppercase text-[#C59E30] font-broadcast tracking-widest font-bold">
                ARENA BROADCAST SYSTEM v2.5
              </span>
            </motion.div>

            <h1
              className="font-broadcast font-black leading-none text-[#F3F7F4]"
              style={{ fontSize: "clamp(3.5rem, 14vw, 7rem)", letterSpacing: "-0.03em" }}
            >
              KICKOFF{" "}
              <span
                style={{
                  WebkitTextFillColor: "transparent",
                  background: "linear-gradient(135deg, #D4AF37 0%, #C59E30 50%, #D4AF37 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                }}
              >
                3D
              </span>
            </h1>

            <p className="text-[#7D9B8C] text-sm mt-3 font-light max-w-xs mx-auto leading-relaxed">
              High-fidelity stadium emulation with Three.js graphics and Rapier collision dynamics
            </p>
          </motion.div>

          {/* Mode buttons */}
          <div className="w-full flex flex-col gap-3">
            {modes.map((mode, i) => {
              const Icon = mode.icon;
              return (
                <motion.button
                  key={mode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.015 }}
                  onClick={() => setGameMode(mode.id)}
                  className="w-full py-5 px-5 rounded-xl flex items-center gap-4 transition-all text-left group relative overflow-hidden"
                  style={{
                    background: "rgba(13, 31, 22, 0.8)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(212, 175, 55, 0.12)",
                  }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 20% 50%, ${mode.accent}15 0%, transparent 60%)` }}
                  />
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 relative z-10 border border-white/10"
                    style={{ background: mode.gradient }}
                  >
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1 relative z-10">
                    <p className="font-broadcast font-black text-base tracking-widest text-[#F3F7F4] group-hover:text-white transition-colors">
                      {mode.label}
                    </p>
                    <p className="text-[11px] text-[#7D9B8C] mt-0.5 group-hover:text-[#9BB8A8] transition-colors">{mode.sub}</p>
                  </div>
                  <svg
                    className="text-[#7D9B8C] group-hover:text-[#D4AF37] transition-all group-hover:translate-x-1 relative z-10"
                    fill="none"
                    height="18"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </motion.button>
              );
            })}
          </div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="flex flex-col items-center text-center p-3 rounded-lg bg-[rgba(13,31,22,0.5)] border border-[rgba(212,175,55,0.08)]"
                >
                  <Icon size={16} className="text-[#D4AF37] mb-1.5" />
                  <p className="font-broadcast font-bold text-[9px] text-[#F3F7F4] tracking-widest">{f.label}</p>
                  <p className="text-[8px] text-[#7D9B8C] mt-0.5">{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="relative z-10 flex items-center justify-between px-6 py-3 border-t border-[rgba(212,175,55,0.08)]"
      >
        <p className="text-[9px] text-[#7D9B8C] font-mono tracking-wider">v2.5.0 · THREE.JS + RAPIER</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <p className="text-[9px] text-[#7D9B8C] font-mono tracking-wider">SERVERS ONLINE</p>
        </div>
      </motion.div>

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
