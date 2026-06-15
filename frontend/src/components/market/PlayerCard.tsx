"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Shirt,
  Zap,
  Target,
  Activity,
  Shield,
  Wind,
  Crosshair,
  Castle,
  Share2,
  Flame,
  Rocket,
} from "lucide-react";
import {
  ABILITIES,
  PlayerAttributes,
  StatKey,
} from "@/stores/useMarketStore";
import { cn } from "@/utils/utils";

type Variant = "mint" | "collection" | "market";

const POSITION_COLOR: Record<PlayerAttributes["position"], string> = {
  GK: "from-[#F59E0B] to-[#B45309]",
  DEF: "from-[#3B82F6] to-[#1E3A8A]",
  MID: "from-[#10B981] to-[#065F46]",
  FWD: "from-[#EF4444] to-[#7F1D1D]",
};

const POSITION_LABEL: Record<PlayerAttributes["position"], string> = {
  GK: "GOALKEEPER",
  DEF: "DEFENDER",
  MID: "MIDFIELDER",
  FWD: "FORWARD",
};

const RARITY_BAR: Record<string, string> = {
  bronze: "from-[#A16207] to-[#713F12]",
  silver: "from-[#9CA3AF] to-[#4B5563]",
  gold: "from-[#FACC15] to-[#A16207]",
  diamond: "from-[#22D3EE] to-[#0E7490]",
};

function rarityFor(rating: number): keyof typeof RARITY_BAR {
  if (rating >= 88) return "diamond";
  if (rating >= 78) return "gold";
  if (rating >= 68) return "silver";
  return "bronze";
}

const ABILITY_ICON = {
  SWIFT: Wind,
  POWER_SHOT: Crosshair,
  WALL: Castle,
  MAESTRO: Share2,
  CLUTCH: Flame,
  RUSH: Rocket,
} as const;

export interface PlayerCardProps {
  card: PlayerAttributes;
  variant?: Variant;
  ownerName?: string;
  price?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  busy?: boolean;
}

function applyAbility(base: number, stat: StatKey, card: PlayerAttributes): number {
  if (!card.ability) return base;
  const bonus = ABILITIES[card.ability].bonuses[stat] ?? 0;
  return Math.min(99, base + bonus);
}

function StatBar({
  icon: Icon,
  label,
  value,
  bonus,
  max = 99,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  bonus?: number;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[9px] text-[#7D9B8C] tracking-wider">
        <span className="flex items-center gap-1">
          <Icon size={9} className="text-[#D4AF37]" />
          {label}
        </span>
        <span className="font-mono font-bold text-[#F3F7F4]">
          {value}
          {bonus !== undefined && bonus > 0 && (
            <span className="ml-1 text-[#10B981]">+{bonus}</span>
          )}
        </span>
      </div>
      <div className="h-1 rounded-full bg-[#040F08]/80 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15]"
        />
      </div>
    </div>
  );
}

export default function PlayerCard({
  card,
  variant = "collection",
  ownerName,
  price,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
  busy = false,
}: PlayerCardProps) {
  const rarity = rarityFor(card.rating);
  const accent = POSITION_COLOR[card.position];
  const isMarket = variant === "market";
  const isMint = variant === "mint";

  const ability = card.ability ? ABILITIES[card.ability] : null;
  const AbilityIcon = ability ? ABILITY_ICON[ability.id] : null;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="relative flex flex-col rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#040F08]/80 overflow-hidden"
    >
      {ability && (
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-broadcast font-bold tracking-widest text-white shadow-md"
          style={{ background: ability.color }}
          title={ability.description}
        >
          {AbilityIcon && <AbilityIcon size={9} />}
          {ability.label}
        </div>
      )}

      <div
        className={cn(
          "p-3 flex items-start justify-between bg-gradient-to-br",
          accent,
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-[rgba(4,15,8,0.7)] flex items-center justify-center font-broadcast font-black text-base text-white border border-white/20">
            {card.jerseyNumber}
          </div>
          <div>
            <p className="text-[9px] font-broadcast tracking-widest text-white/80">
              {POSITION_LABEL[card.position]}
            </p>
            <p className="font-broadcast font-black text-base text-white leading-none">
              {card.team === "HOME" ? "HOM" : "AWY"} · #{card.tokenId}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[8px] tracking-widest text-white/80 font-broadcast">
            RATING
          </p>
          <p className="font-broadcast font-black text-2xl text-white leading-none">
            {card.rating}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "h-1 w-full bg-gradient-to-r",
          RARITY_BAR[rarity],
        )}
      />

      <div className="p-3 flex flex-col gap-2 flex-1">
        {ability && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-broadcast tracking-wider"
            style={{
              background: `${ability.color}15`,
              color: ability.color,
              border: `1px solid ${ability.color}40`,
            }}
          >
            {AbilityIcon && <AbilityIcon size={10} />}
            <span className="font-bold">{ability.label}</span>
            <span className="text-[#7D9B8C] truncate">— {ability.description}</span>
          </div>
        )}

        {ownerName && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#7D9B8C]">
            <Shirt size={11} className="text-[#D4AF37]" />
            <span className="font-broadcast tracking-wider truncate">
              {ownerName}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <StatBar
            icon={Zap}
            label="SPD"
            value={applyAbility(card.speed, "speed", card)}
            bonus={ability?.bonuses.speed}
          />
          <StatBar
            icon={Target}
            label="SHO"
            value={applyAbility(card.shooting, "shooting", card)}
            bonus={ability?.bonuses.shooting}
          />
          <StatBar
            icon={Activity}
            label="PAS"
            value={applyAbility(card.passing, "passing", card)}
            bonus={ability?.bonuses.passing}
          />
          <StatBar
            icon={Shield}
            label="DEF"
            value={applyAbility(card.defense, "defense", card)}
            bonus={ability?.bonuses.defense}
          />
        </div>

        {isMarket && price && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)]">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#D4AF37]" />
              <span className="text-[9px] text-[#7D9B8C] tracking-widest font-broadcast">
                PRICE
              </span>
            </div>
            <span className="font-mono font-bold text-sm text-[#D4AF37]">
              {price} ETH
            </span>
          </div>
        )}

        {(onPrimary || onSecondary) && (
          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            {onPrimary && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={onPrimary}
                disabled={busy}
                className="w-full py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#040F08] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
              >
                {busy ? "PROCESSING..." : primaryLabel}
              </motion.button>
            )}
            {onSecondary && (
              <button
                onClick={onSecondary}
                disabled={busy}
                className="w-full py-1.5 rounded-md font-broadcast font-bold text-[9px] tracking-widest text-[#7D9B8C] border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        )}

        {isMint && (
          <div className="mt-auto flex items-center gap-1.5 text-[9px] text-[#C59E30] font-broadcast tracking-widest">
            <Sparkles size={10} />
            RANDOM ROLL
          </div>
        )}
      </div>
    </motion.div>
  );
}
