"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Inbox, ShoppingBag, Store, Info } from "lucide-react";
import { useWalletStore } from "@/stores/useWalletStore";
import { isMarketDeployed } from "@/lib/config/contracts";
import { useMarketStore } from "@/stores/useMarketStore";
import { useSyncNfts } from "@/hooks/useSyncNfts";
import MintTab from "@/components/market/MintTab";
import CollectionTab from "@/components/market/CollectionTab";
import MarketplaceTab from "@/components/market/MarketplaceTab";

type MarketTab = "mint" | "collection" | "marketplace";

const TABS: { id: MarketTab; label: string; icon: typeof Sparkles }[] = [
  { id: "mint", label: "MINT", icon: Sparkles },
  { id: "collection", label: "MY COLLECTION", icon: Inbox },
  { id: "marketplace", label: "MARKETPLACE", icon: ShoppingBag },
];

export default function MarketScreen() {
  const { isConnected, address } = useWalletStore();
  const mintedCount = useMarketStore((s) => s.myNfts.length);
  const listedCount = useMarketStore((s) => s.listings.length);
  const [activeTab, setActiveTab] = useState<MarketTab>("mint");
  const live = isMarketDeployed();

  useSyncNfts();

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="glass-panel-gold rounded-xl p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-[#D4AF37]" />
          <div>
            <h2 className="font-broadcast font-bold text-base text-[#F3F7F4] tracking-widest uppercase">
              PLAYER MARKET
            </h2>
            <p className="text-[10px] text-[#7D9B8C] font-broadcast tracking-wider">
              MINT · TRADE · BUILD YOUR SQUAD
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-broadcast tracking-widest font-bold ${
              live
                ? "bg-[rgba(16,185,129,0.15)] text-[#10B981]"
                : "bg-[rgba(59,130,246,0.15)] text-[#3B82F6]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                live ? "bg-[#10B981]" : "bg-[#3B82F6]"
              }`}
            />
            {live ? "LIVE" : "MOCK"}
          </div>
          <div className="text-right text-[9px] text-[#7D9B8C] tracking-widest font-broadcast">
            {address ? (
              <>
                <div>OWNED · {mintedCount}</div>
                <div>LISTED · {listedCount}</div>
              </>
            ) : (
              <div>CONNECT TO TRADE</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-[rgba(4,15,8,0.85)] border border-[rgba(212,175,55,0.25)] rounded-lg px-1 py-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-broadcast font-bold uppercase tracking-widest transition-all ${
                active ? "text-[#040F08]" : "text-[#7D9B8C] hover:text-[#D4AF37]"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="market-tab"
                  className="absolute inset-0 rounded-md"
                  style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon size={12} />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {activeTab === "mint" && <MintTab />}
          {activeTab === "collection" && <CollectionTab />}
          {activeTab === "marketplace" && <MarketplaceTab />}
        </motion.div>
      </AnimatePresence>

      {isConnected && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#040F08]/40 border border-[rgba(212,175,55,0.08)] text-[9px] text-[#7D9B8C]">
          <Info size={11} className="text-[#D4AF37] mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Settlements use ETH. The 2.5% protocol fee funds the treasury.
            Listings are escrowed by the contract until sold or cancelled.
          </p>
        </div>
      )}
    </div>
  );
}
