"use client";

import { motion } from "framer-motion";
import { X, Info } from "lucide-react";
import { useGameStore } from "@/stores/useGameStore";

function Toggle({
  label, desc, value, onToggle,
}: { label: string; desc: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(212,175,55,0.1)]">
      <div>
        <p className="font-broadcast font-bold text-sm text-[#F3F7F4] tracking-wider">{label}</p>
        <p className="text-[10px] text-[#7D9B8C]">{desc}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onToggle}
        className={`w-10 h-6 rounded-full relative flex items-center px-0.5 transition-all duration-300 border ${
          value
            ? "bg-[#0F2A1D] border-[#D4AF37] justify-end"
            : "bg-[#040F08] border-[rgba(212,175,55,0.3)] justify-start"
        }`}
      >
        <motion.span
          layout
          className={`w-4 h-4 rounded-full shadow-md ${value ? "bg-[#F3F7F4]" : "bg-[#7D9B8C]"}`}
        />
      </motion.button>
    </div>
  );
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useGameStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-md glass-panel-gold rounded-xl overflow-hidden shadow-2xl border border-[#D4AF37]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(212,175,55,0.25)] flex items-center justify-between"
          style={{ background: "linear-gradient(to right, #0D1F16, #040F08)" }}>
          <div className="flex items-center gap-2">
            <svg className="text-[#D4AF37]" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="font-broadcast font-black text-base tracking-widest text-[#F3F7F4]">ARENA DECK CONTROLS</span>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="text-[#7D9B8C] hover:text-white transition-colors">
            <X size={18} />
          </motion.button>
        </div>

        {/* Toggles */}
        <div className="p-5 space-y-1">
          <Toggle
            label="TELEMETRY ANALYTICS HUD"
            desc="Render live possession percentages on screen overlays."
            value={settings.telemetryHud}
            onToggle={() => setSettings({ telemetryHud: !settings.telemetryHud })}
          />
          <Toggle
            label="TELEY-SOUND COMMENTATOR"
            desc="Simulate realistic announcer text alerts during match goals."
            value={settings.audioCommentary}
            onToggle={() => setSettings({ audioCommentary: !settings.audioCommentary })}
          />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-broadcast font-bold text-sm text-[#F3F7F4] tracking-wider">3D PITCH DEPTH OF FIELD</p>
              <p className="text-[10px] text-[#7D9B8C]">Enables high definition canvas blur on stadium background.</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setSettings({ depthOfField: !settings.depthOfField })}
              className={`w-10 h-6 rounded-full relative flex items-center px-0.5 transition-all duration-300 border ${
                settings.depthOfField
                  ? "bg-[#0F2A1D] border-[#D4AF37] justify-end"
                  : "bg-[#040F08] border-[rgba(212,175,55,0.3)] justify-start"
              }`}
            >
              <motion.span
                layout
                className={`w-4 h-4 rounded-full shadow-md ${settings.depthOfField ? "bg-[#F3F7F4]" : "bg-[#7D9B8C]"}`}
              />
            </motion.button>
          </div>

          <div className="p-3 bg-[#040F08] border border-[rgba(212,175,55,0.15)] rounded text-[10px] text-[#7D9B8C] flex items-start gap-2 mt-3">
            <Info size={13} className="text-[#D4AF37] shrink-0 mt-0.5" />
            <span>Changes require synchronization loop restart. All WebGL textures reload on confirmation.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#040F08] border-t border-[rgba(212,175,55,0.25)] flex gap-2.5">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="flex-1 py-2 border border-[rgba(212,175,55,0.2)] text-[#7D9B8C] rounded font-broadcast font-bold text-xs uppercase tracking-widest hover:text-white transition-all"
          >
            DISCARD
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="flex-1 py-2 rounded font-broadcast font-black text-xs uppercase tracking-widest shadow-md hover:brightness-110 transition-all text-[#040F08]"
            style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
          >
            SAVE MODIFICATIONS
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
