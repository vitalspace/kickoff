"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";
import { useMarketStore, ABILITIES } from "@/stores/useMarketStore";

const POSITION_COLORS: Record<string, string> = {
  GK: "#F59E0B",
  DEF: "#3B82F6",
  MID: "#10B981",
  FWD: "#EF4444",
};

function StatMini({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "#10B981" : value >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-1">
      <span className="text-[7px] text-[#7D9B8C] w-5 uppercase">{label}</span>
      <div className="flex-1 h-0.5 bg-[#040F08] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[7px] font-mono text-[#F3F7F4] w-3 text-right">{value}</span>
    </div>
  );
}

export default function NftPickerModal({
  slotPosition,
  slotIndex,
  excludeTokenIds,
  onSelect,
  onClose,
}: {
  slotPosition: string;
  slotIndex: number;
  excludeTokenIds: number[];
  onSelect: (tokenId: number) => void;
  onClose: () => void;
}) {
  const myNfts = useMarketStore((s) => s.myNfts);
  const [filter, setFilter] = useState<string>(slotPosition);

  const matches = myNfts.filter(
    (nft) =>
      !excludeTokenIds.includes(nft.tokenId) &&
      (filter === "ALL" || nft.position === filter || (nft.position === "FWD" && filter === "MID")),
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg glass-panel-gold rounded-xl p-4 max-h-[80vh] flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase">
                SELECT PLAYER
              </h3>
              <p className="text-[9px] text-[#7D9B8C] mt-0.5">
                Slot {slotIndex + 1} · {slotPosition} position
              </p>
            </div>
            <button onClick={onClose} className="text-[#7D9B8C] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Position filter tabs */}
          <div className="flex gap-1 mb-3 p-1 bg-[#040F08] rounded-lg">
            {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
              <button
                key={pos}
                onClick={() => setFilter(pos)}
                className={`flex-1 py-1 text-[8px] font-broadcast font-bold uppercase tracking-wider rounded transition-all ${
                  filter === pos
                    ? "bg-[#D4AF37] text-[#040F08]"
                    : "text-[#7D9B8C] hover:text-white"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* NFT list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Star size={24} className="text-[#D4AF37]/30 mb-2" />
                <p className="text-[10px] text-[#7D9B8C]">
                  {myNfts.length === 0
                    ? "No NFTs in your collection. Mint some first!"
                    : "No matching NFTs for this slot."}
                </p>
              </div>
            ) : (
              matches.map((nft) => {
                const posColor = POSITION_COLORS[nft.position] || "#7D9B8C";
                const ovr = Math.round((nft.speed + nft.shooting + nft.passing + nft.defense) / 4);
                return (
                  <motion.button
                    key={nft.tokenId}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(nft.tokenId)}
                    className="w-full p-3 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.15)] hover:border-[#D4AF37]/50 hover:bg-[#0F2A1D]/50 transition-all text-left flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: posColor }}
                    >
                      #{nft.tokenId}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-[#F3F7F4]">
                          Player #{nft.tokenId}
                        </span>
                        <span className="text-[8px] text-[#7D9B8C]">
                          OVR <span className="text-[#D4AF37] font-bold">{ovr}</span>
                        </span>
                        {nft.ability && (
                          <span
                            className="text-[7px] font-bold px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: `${ABILITIES[nft.ability].color}20`,
                              color: ABILITIES[nft.ability].color,
                            }}
                          >
                            {ABILITIES[nft.ability].label}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <StatMini label="SPD" value={nft.speed} />
                        <StatMini label="SHT" value={nft.shooting} />
                        <StatMini label="PAS" value={nft.passing} />
                        <StatMini label="DEF" value={nft.defense} />
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
