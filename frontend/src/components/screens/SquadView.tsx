"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Trash2, Shield, Check, ChevronDown, Zap, Target, Swords, Star } from "lucide-react";
import { useSquadStore } from "@/stores/useSquadStore";
import { useMarketStore, ABILITIES } from "@/stores/useMarketStore";

const POSITION_COLORS: Record<string, string> = {
  GK: "#F59E0B",
  DEF: "#3B82F6",
  MID: "#10B981",
  FWD: "#EF4444",
};

const FORMATION_SLOTS = [
  { index: 0, position: "GK", label: "GOALKEEPER", short: "GK" },
  { index: 1, position: "DEF", label: "LB", short: "LB" },
  { index: 2, position: "DEF", label: "CB", short: "CB" },
  { index: 3, position: "DEF", label: "CB", short: "CB" },
  { index: 4, position: "DEF", label: "RB", short: "RB" },
  { index: 5, position: "MID", label: "LM", short: "LM" },
  { index: 6, position: "MID", label: "CM", short: "CM" },
  { index: 7, position: "MID", label: "RM", short: "RM" },
];

function StatBar({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  const color = value >= 80 ? "#10B981" : value >= 75 ? "#D4AF37" : "#F59E0B";
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-[8px] text-[#7D9B8C]">{icon}</span>}
      <span className="text-[8px] text-[#7D9B8C] w-3 uppercase font-mono">{label}</span>
      <div className="flex-1 h-1 bg-[#0a1a10] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[8px] font-mono text-[#F3F7F4] w-4 text-right font-bold">{value}</span>
    </div>
  );
}

export default function SquadView() {
  const { slots, setSlot, autoFill, clearSquad, getSlotDetails } = useSquadStore();
  const myNfts = useMarketStore((s) => s.myNfts);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const details = getSlotDetails();
  const filledCount = slots.filter((s) => s !== undefined).length;
  const excludeIds = slots.filter((s) => s !== undefined) as number[];

  const handleSelectNft = (tokenId: number) => {
    if (pickerSlot !== null) {
      setSlot(pickerSlot, tokenId);
      setPickerSlot(null);
    }
  };

  const pickerSlotInfo = pickerSlot !== null ? FORMATION_SLOTS[pickerSlot] : null;
  const availableNfts = myNfts.filter(
    (nft) =>
      !excludeIds.includes(nft.tokenId) &&
      (pickerSlotInfo
        ? nft.position === pickerSlotInfo.position ||
          (nft.position === "FWD" && pickerSlotInfo.position === "MID")
        : true),
  );

  // Calculate team average OVR
  const assignedDetails = details.filter((d) => d.tokenId !== undefined);
  const teamOvr = assignedDetails.length > 0
    ? Math.round(assignedDetails.reduce((sum, d) => sum + (d.stats.speed + d.stats.shooting + d.stats.passing + d.stats.defense) / 4, 0) / assignedDetails.length)
    : null;

  return (
    <div className="glass-panel-gold rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[rgba(212,175,55,0.15)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
              <Shield size={16} className="text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-wider uppercase">
                SQUAD
              </h3>
              <p className="text-[8px] text-[#7D9B8C] mt-0.5">
                4-3-3 FORMATION
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#7D9B8C] font-mono">
                {filledCount}/8
              </span>
              {teamOvr !== null && (
                <div className="px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                  <span className="text-[9px] font-broadcast font-bold text-[#D4AF37]">
                    TEAM OVR {teamOvr}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[8px] text-[#7D9B8C] mt-0.5">
              {myNfts.length} NFT{myNfts.length !== 1 ? "s" : ""} in collection
            </p>
          </div>
        </div>

        {/* Quick info */}
        <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.1)]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-[8px] text-[#7D9B8C]">NFT equipped</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#7D9B8C]/50" />
            <span className="text-[8px] text-[#7D9B8C]">Default (70)</span>
          </div>
        </div>
      </div>

      {/* Formation */}
      <div className="p-4">
        {/* Pitch background */}
        <div className="relative rounded-xl bg-[#0a1a10] border border-[rgba(212,175,55,0.08)] p-4 overflow-hidden">
          {/* Field lines */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white" />
          </div>

          <div className="relative space-y-3">
            {/* GK */}
            <FormationSlot
              slot={details[0]}
              formation={FORMATION_SLOTS[0]}
              onPick={() => setPickerSlot(0)}
              onRemove={() => setSlot(0, undefined)}
              variant="wide"
            />

            {/* DEF row */}
            <div>
              <p className="text-[7px] text-[#3B82F6] font-broadcast font-bold uppercase tracking-widest mb-1.5 ml-1">
                DEFENSE
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {details.slice(1, 5).map((slot, i) => (
                  <FormationSlot
                    key={slot.formationIndex}
                    slot={slot}
                    formation={FORMATION_SLOTS[i + 1]}
                    onPick={() => setPickerSlot(slot.formationIndex)}
                    onRemove={() => setSlot(slot.formationIndex, undefined)}
                    variant="card"
                  />
                ))}
              </div>
            </div>

            {/* MID row */}
            <div>
              <p className="text-[7px] text-[#10B981] font-broadcast font-bold uppercase tracking-widest mb-1.5 ml-1">
                MIDFIELD
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {details.slice(5, 8).map((slot, i) => (
                  <FormationSlot
                    key={slot.formationIndex}
                    slot={slot}
                    formation={FORMATION_SLOTS[i + 5]}
                    onPick={() => setPickerSlot(slot.formationIndex)}
                    onRemove={() => setSlot(slot.formationIndex, undefined)}
                    variant="card"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={autoFill}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-[9px] font-broadcast font-bold uppercase tracking-widest hover:bg-[#10B981]/20 transition-all"
          >
            <Wand2 size={11} />
            AUTO-FILL
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={clearSquad}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[9px] font-broadcast font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-all"
          >
            <Trash2 size={11} />
            CLEAR
          </motion.button>
          {filledCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/20">
              <Check size={10} className="text-[#10B981]" />
              <span className="text-[8px] text-[#10B981] font-broadcast font-bold">ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* NFT Picker */}
      {pickerSlotInfo && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-[rgba(212,175,55,0.15)]"
        >
          <div className="p-3 bg-[#040F08]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-[7px] font-broadcast font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${POSITION_COLORS[pickerSlotInfo.position]}20`, color: POSITION_COLORS[pickerSlotInfo.position] }}
                >
                  {pickerSlotInfo.position}
                </span>
                <span className="text-[9px] text-[#F3F7F4] font-broadcast font-bold">
                  SELECT FOR {pickerSlotInfo.label}
                </span>
              </div>
              <button
                onClick={() => setPickerSlot(null)}
                className="text-[8px] text-[#7D9B8C] hover:text-[#EF4444] font-broadcast uppercase tracking-wider transition-colors"
              >
                CLOSE
              </button>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {availableNfts.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full border-2 border-dashed border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                    <Star size={18} className="text-[#D4AF37]/30" />
                  </div>
                  <p className="text-[9px] text-[#7D9B8C]">
                    {myNfts.length === 0
                      ? "No NFTs yet. Mint some in MARKET!"
                      : "No matching NFTs for this position."}
                  </p>
                </div>
              ) : (
                availableNfts.map((nft) => {
                  const posColor = POSITION_COLORS[nft.position] || "#7D9B8C";
                  const ovr = Math.round((nft.speed + nft.shooting + nft.passing + nft.defense) / 4);
                  return (
                    <motion.button
                      key={nft.tokenId}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectNft(nft.tokenId)}
                      className="w-full p-2.5 rounded-lg bg-[#0F2A1D]/60 border border-[rgba(212,175,55,0.08)] hover:border-[#D4AF37]/30 hover:bg-[#0F2A1D] transition-all text-left flex items-center gap-2.5"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg"
                        style={{ backgroundColor: posColor }}
                      >
                        #{nft.tokenId}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-[#F3F7F4]">
                            Player #{nft.tokenId}
                          </span>
                          <span className="text-[8px] font-mono text-[#7D9B8C]">
                            OVR <span className="text-[#D4AF37] font-bold">{ovr}</span>
                          </span>
                          {nft.ability && (
                            <span
                              className="text-[6px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${ABILITIES[nft.ability].color}15`,
                                color: ABILITIES[nft.ability].color,
                                border: `1px solid ${ABILITIES[nft.ability].color}30`,
                              }}
                            >
                              {ABILITIES[nft.ability].label}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-x-2 gap-y-0.5">
                          <StatBar label="SPD" value={nft.speed} icon={<Zap size={6} />} />
                          <StatBar label="SHT" value={nft.shooting} icon={<Target size={6} />} />
                          <StatBar label="PAS" value={nft.passing} icon={<Swords size={6} />} />
                          <StatBar label="DEF" value={nft.defense} icon={<Shield size={6} />} />
                        </div>
                      </div>
                      <ChevronDown size={14} className="text-[#7D9B8C] rotate-[-90deg] shrink-0" />
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FormationSlot({
  slot,
  formation,
  onPick,
  onRemove,
  variant,
}: {
  slot: ReturnType<typeof useSquadStore.getState>["getSlotDetails"] extends () => (infer R)[] ? R : never;
  formation: (typeof FORMATION_SLOTS)[number];
  onPick: () => void;
  onRemove: () => void;
  variant: "wide" | "card";
}) {
  const posColor = POSITION_COLORS[slot.position] || "#7D9B8C";
  const isAssigned = slot.tokenId !== undefined;
  const ovr = isAssigned
    ? Math.round((slot.stats.speed + slot.stats.shooting + slot.stats.passing + slot.stats.defense) / 4)
    : null;

  if (variant === "wide") {
    return (
      <motion.div
        whileTap={{ scale: 0.99 }}
        onClick={isAssigned ? undefined : onPick}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          isAssigned
            ? "bg-[#0F2A1D] border-[rgba(212,175,55,0.25)] shadow-[0_0_12px_rgba(212,175,55,0.08)]"
            : "bg-[#040F08]/40 border-[rgba(212,175,55,0.08)] cursor-pointer hover:border-[#D4AF37]/30 hover:bg-[#0F2A1D]/30"
        }`}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
          style={{ backgroundColor: isAssigned ? posColor : `${posColor}30`, color: isAssigned ? "white" : posColor }}
        >
          {isAssigned ? `#${slot.tokenId}` : formation.short}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-broadcast font-bold text-[#F3F7F4] uppercase tracking-wider">
              {formation.label}
            </span>
            {isAssigned && slot.stats.ability && (
              <span
                className="text-[6px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${ABILITIES[slot.stats.ability].color}15`,
                  color: ABILITIES[slot.stats.ability].color,
                  border: `1px solid ${ABILITIES[slot.stats.ability].color}30`,
                }}
              >
                {ABILITIES[slot.stats.ability].label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
            <StatBar label="SPD" value={isAssigned ? slot.stats.speed : 70} />
            <StatBar label="SHT" value={isAssigned ? slot.stats.shooting : 70} />
            <StatBar label="PAS" value={isAssigned ? slot.stats.passing : 70} />
            <StatBar label="DEF" value={isAssigned ? slot.stats.defense : 70} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAssigned ? (
            <>
              <span className="text-[10px] text-[#D4AF37] font-broadcast font-black">OVR {ovr}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-[#EF4444]/60 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
              >
                ✕
              </button>
            </>
          ) : (
            <span className="text-[8px] text-[#7D9B8C]/50 font-broadcast">DEFAULT</span>
          )}
        </div>
      </motion.div>
    );
  }

  // Card variant for DEF/MID rows
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={isAssigned ? undefined : onPick}
      className={`p-2.5 rounded-lg border transition-all ${
        isAssigned
          ? "bg-[#0F2A1D] border-[rgba(212,175,55,0.25)]"
          : "bg-[#040F08]/40 border-[rgba(212,175,55,0.08)] cursor-pointer hover:border-[#D4AF37]/30 hover:bg-[#0F2A1D]/30"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[7px] font-black"
            style={{ backgroundColor: isAssigned ? posColor : `${posColor}30`, color: isAssigned ? "white" : posColor }}
          >
            {isAssigned ? `#${slot.tokenId}` : formation.short}
          </div>
          <span className="text-[7px] font-broadcast font-bold text-[#7D9B8C] uppercase tracking-wider">
            {formation.label}
          </span>
        </div>
        {isAssigned ? (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-[#D4AF37] font-broadcast font-black">{ovr}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-4 h-4 rounded flex items-center justify-center text-[7px] text-[#EF4444]/60 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="text-[7px] text-[#7D9B8C]/40 font-broadcast">70</span>
        )}
      </div>

      {isAssigned ? (
        <div className="space-y-0.5">
          <StatBar label="SPD" value={slot.stats.speed} />
          <StatBar label="SHT" value={slot.stats.shooting} />
          <StatBar label="PAS" value={slot.stats.passing} />
          <StatBar label="DEF" value={slot.stats.defense} />
          {slot.stats.ability && (
            <div className="pt-1">
              <span
                className="text-[5px] font-bold px-1 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${ABILITIES[slot.stats.ability].color}15`,
                  color: ABILITIES[slot.stats.ability].color,
                  border: `1px solid ${ABILITIES[slot.stats.ability].color}30`,
                }}
              >
                {ABILITIES[slot.stats.ability].label}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-0.5 opacity-30">
          <StatBar label="SPD" value={70} />
          <StatBar label="SHT" value={70} />
          <StatBar label="PAS" value={70} />
          <StatBar label="DEF" value={70} />
        </div>
      )}
    </motion.div>
  );
}
