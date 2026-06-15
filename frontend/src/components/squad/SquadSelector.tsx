"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Trash2, ArrowRight, ArrowLeft, Users } from "lucide-react";
import { useSquadStore } from "@/stores/useSquadStore";
import SquadSlot from "@/components/squad/SquadSlot";
import NftPickerModal from "@/components/squad/NftPickerModal";

const FORMATION_SLOTS = [
  { index: 0, position: "GK" },
  { index: 1, position: "DEF" },
  { index: 2, position: "DEF" },
  { index: 3, position: "DEF" },
  { index: 4, position: "DEF" },
  { index: 5, position: "MID" },
  { index: 6, position: "MID" },
  { index: 7, position: "MID" },
];

export default function SquadSelector({
  onConfirm,
  onBack,
}: {
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { slots, setSlot, autoFill, clearSquad, getSlotDetails } = useSquadStore();
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  const details = getSlotDetails();
  const filledCount = slots.filter((s) => s !== undefined).length;
  const excludeIds = slots.filter((s) => s !== undefined) as number[];

  const handleSelect = (tokenId: number) => {
    if (pickerSlot !== null) {
      setSlot(pickerSlot, tokenId);
      setPickerSlot(null);
    }
  };

  const pickerSlotInfo = pickerSlot !== null ? FORMATION_SLOTS[pickerSlot] : null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] text-[#7D9B8C] hover:text-[#D4AF37] font-broadcast tracking-wider transition-colors"
        >
          <ArrowLeft size={12} />
          BACK
        </button>
        <div className="text-center">
          <h2 className="font-broadcast font-black text-lg text-[#F3F7F4] tracking-wider">
            SELECT YOUR SQUAD
          </h2>
          <p className="text-[9px] text-[#7D9B8C] mt-0.5">
            {filledCount}/8 players selected
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Formation grid */}
      <div className="glass-panel-gold rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-[#D4AF37]" />
          <h3 className="text-[10px] font-semibold text-[#C59E30] uppercase tracking-wider">
            FORMATION
          </h3>
        </div>

        {/* GK */}
        <div className="mb-3">
          <SquadSlot
            position={details[0].position}
            stats={details[0].stats}
            tokenId={details[0].tokenId}
            onSelect={() => setPickerSlot(0)}
            onRemove={() => setSlot(0, undefined)}
          />
        </div>

        {/* DEF row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {details.slice(1, 5).map((slot) => (
            <SquadSlot
              key={slot.formationIndex}
              position={slot.position}
              stats={slot.stats}
              tokenId={slot.tokenId}
              onSelect={() => setPickerSlot(slot.formationIndex)}
              onRemove={() => setSlot(slot.formationIndex, undefined)}
            />
          ))}
        </div>

        {/* MID row */}
        <div className="grid grid-cols-3 gap-2">
          {details.slice(5, 8).map((slot) => (
            <SquadSlot
              key={slot.formationIndex}
              position={slot.position}
              stats={slot.stats}
              tokenId={slot.tokenId}
              onSelect={() => setPickerSlot(slot.formationIndex)}
              onRemove={() => setSlot(slot.formationIndex, undefined)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={autoFill}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[rgba(16,185,129,0.3)] text-[#10B981] text-[10px] font-broadcast font-bold uppercase tracking-widest hover:bg-[rgba(16,185,129,0.1)] transition-all"
        >
          <Wand2 size={12} />
          AUTO-FILL
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={clearSquad}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[rgba(239,68,68,0.3)] text-[#EF4444] text-[10px] font-broadcast font-bold uppercase tracking-widest hover:bg-[rgba(239,68,68,0.1)] transition-all"
        >
          <Trash2 size={12} />
          CLEAR
        </motion.button>

        <div className="flex-1" />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onConfirm}
          disabled={filledCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-broadcast font-bold text-xs tracking-widest text-[#040F08] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: filledCount > 0
              ? "linear-gradient(to right, #D4AF37, #C59E30)"
              : "#1a2a1f",
          }}
        >
          CONFIRM SQUAD
          <ArrowRight size={14} />
        </motion.button>
      </div>

      {/* NFT picker modal */}
      {pickerSlotInfo && (
        <NftPickerModal
          slotPosition={pickerSlotInfo.position}
          slotIndex={pickerSlotInfo.index}
          excludeTokenIds={excludeIds.filter((id) => id !== slots[pickerSlotInfo.index])}
          onSelect={handleSelect}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
