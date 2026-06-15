"use client";

import { motion } from "framer-motion";
import { PlayerStats } from "@/lib/game/constants";
import { ABILITIES } from "@/stores/useMarketStore";
import { Shield, Zap, Target, Swords, Star } from "lucide-react";

const POSITION_COLORS: Record<string, string> = {
  GK: "#F59E0B",
  DEF: "#3B82F6",
  MID: "#10B981",
  FWD: "#EF4444",
};

const POSITION_LABELS: Record<string, string> = {
  GK: "GOALKEEPER",
  DEF: "DEFENDER",
  MID: "MIDFIELDER",
  FWD: "FORWARD",
};

function StatBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const color = value >= 80 ? "#10B981" : value >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-[#7D9B8C] w-3">{icon}</span>
      <span className="text-[8px] text-[#7D9B8C] w-6 uppercase">{label}</span>
      <div className="flex-1 h-1 bg-[#040F08] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[8px] font-mono text-[#F3F7F4] w-4 text-right">{value}</span>
    </div>
  );
}

export default function SquadSlot({
  position,
  stats,
  tokenId,
  onSelect,
  onRemove,
  isActive,
}: {
  position: string;
  stats: PlayerStats;
  tokenId?: number;
  onSelect: () => void;
  onRemove: () => void;
  isActive?: boolean;
}) {
  const posColor = POSITION_COLORS[position] || "#7D9B8C";
  const isAssigned = tokenId !== undefined;
  const overallRating = Math.round((stats.speed + stats.shooting + stats.passing + stats.defense) / 4);

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={isAssigned ? undefined : onSelect}
      className={`relative p-3 rounded-lg border transition-all ${
        isAssigned
          ? "bg-[#0F2A1D] border-[rgba(212,175,55,0.3)]"
          : "bg-[#040F08]/60 border-[rgba(212,175,55,0.15)] cursor-pointer hover:border-[#D4AF37]/50 hover:bg-[#0F2A1D]/50"
      } ${isActive ? "ring-1 ring-[#D4AF37]" : ""}`}
    >
      {/* Position badge */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[8px] font-broadcast font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${posColor}20`, color: posColor }}
        >
          {POSITION_LABELS[position] || position}
        </span>
        {isAssigned && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-[8px] text-[#EF4444] hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {isAssigned ? (
        <>
          {/* NFT info */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: posColor }}
            >
              #{tokenId}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#F3F7F4] truncate">
                Player #{tokenId}
              </p>
              <p className="text-[8px] text-[#7D9B8C]">
                OVR <span className="text-[#D4AF37] font-bold">{overallRating}</span>
              </p>
            </div>
            {stats.ability && (
              <span
                className="text-[7px] font-bold px-1 py-0.5 rounded"
                style={{
                  backgroundColor: `${ABILITIES[stats.ability].color}20`,
                  color: ABILITIES[stats.ability].color,
                }}
              >
                {ABILITIES[stats.ability].label}
              </span>
            )}
          </div>

          {/* Stat bars */}
          <div className="space-y-1">
            <StatBar label="SPD" value={stats.speed} icon={<Zap size={8} />} />
            <StatBar label="SHT" value={stats.shooting} icon={<Target size={8} />} />
            <StatBar label="PAS" value={stats.passing} icon={<Swords size={8} />} />
            <StatBar label="DEF" value={stats.defense} icon={<Shield size={8} />} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-4">
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-[rgba(212,175,55,0.3)] flex items-center justify-center mb-2">
            <Star size={16} className="text-[#D4AF37]/40" />
          </div>
          <p className="text-[9px] text-[#7D9B8C] font-broadcast tracking-wider">
            TAP TO SELECT
          </p>
        </div>
      )}
    </motion.div>
  );
}
