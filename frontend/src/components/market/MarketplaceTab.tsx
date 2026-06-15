"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, X, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useMarketStore, Listing, PlayerAttributes } from "@/stores/useMarketStore";
import { marketService } from "@/lib/services/marketService";
import { isMarketDeployed } from "@/lib/config/contracts";
import { useWalletStore } from "@/stores/useWalletStore";
import { checkBalance } from "@/lib/utils/checkBalance";
import PlayerCard from "@/components/market/PlayerCard";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function truncateAddress(address: string): string {
  if (address.startsWith("0x") && address.length > 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}

type SortKey = "recent" | "price-asc" | "price-desc" | "rating-desc";

export default function MarketplaceTab() {
  const listings = useMarketStore((s) => s.listings);
  const { address, isConnected } = useWalletStore();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [busy, setBusy] = useState(false);

  const live = isMarketDeployed();

  const visibleListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = listings.filter((l) => {
      if (!q) return true;
      const id = String(l.tokenId);
      const seller = l.sellerName?.toLowerCase() ?? "";
      return id.includes(q) || seller.includes(q);
    });

    out = out.slice();
    if (sort === "price-asc") {
      out.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-desc") {
      out.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sort === "rating-desc") {
      out.sort((a, b) => {
        const aAttrs =
          a.attributes ?? marketService.getMockListingAttributes(a.tokenId);
        const bAttrs =
          b.attributes ?? marketService.getMockListingAttributes(b.tokenId);
        return (bAttrs?.rating ?? 0) - (aAttrs?.rating ?? 0);
      });
    } else {
      out.sort((a, b) => b.listedAt - a.listedAt);
    }
    return out;
  }, [listings, query, sort]);

  const handleBuy = async () => {
    if (!activeListing || !address) return;
    const priceWei = BigInt(Math.floor(Number(activeListing.price) * 1e18));
    if (!checkBalance(priceWei)) return;
    setBusy(true);
    try {
      await marketService.buyItem(activeListing.tokenId, address);
      toast.success("Card purchased!", {
        description: `Card #${activeListing.tokenId} added to your collection.`,
      });
      setActiveListing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Purchase failed";
      toast.error("Purchase failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const activeAttrs: PlayerAttributes | null = activeListing
    ? (() => {
        const attrs =
          activeListing.attributes ??
          marketService.getMockListingAttributes(activeListing.tokenId);
        if (!attrs) return null;
        return {
          ...attrs,
          tokenId: activeListing.tokenId,
          mintedAt: activeListing.listedAt,
        };
      })()
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel-gold rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase flex items-center gap-2">
            <ShoppingBag size={14} />
            MARKETPLACE
          </h3>
          <span className="text-[10px] text-[#7D9B8C] font-mono">
            {visibleListings.length} LISTED
          </span>
        </div>

        {!live && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.25)] mb-3">
            <AlertCircle size={13} className="text-[#3B82F6] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#7D9B8C] leading-relaxed">
              The marketplace contract is not deployed on this chain. Browse and
              buy in mock mode — purchases are simulated locally and the card
              is added to your in-browser collection.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7D9B8C]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by token ID or seller..."
              className="w-full pl-9 pr-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.2)] rounded-lg text-[#F3F7F4] text-xs focus:outline-none focus:border-[#D4AF37] placeholder:text-[#7D9B8C]/50"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.2)] rounded-lg text-[#F3F7F4] text-xs focus:outline-none focus:border-[#D4AF37] font-broadcast tracking-wider"
          >
            <option value="recent">RECENT</option>
            <option value="price-asc">PRICE ↑</option>
            <option value="price-desc">PRICE ↓</option>
            <option value="rating-desc">RATING ↓</option>
          </select>
        </div>

        {visibleListings.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-dashed border-[rgba(212,175,55,0.3)] flex items-center justify-center">
              <ShoppingBag size={26} className="text-[#D4AF37]/50" />
            </div>
            <p className="text-[#7D9B8C] text-xs font-broadcast tracking-widest">
              NO LISTINGS FOUND
            </p>
            <p className="text-[#7D9B8C] text-[10px] mt-1">
              Try a different search or check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {visibleListings.map((l) => {
              const attrs =
                l.attributes ?? marketService.getMockListingAttributes(l.tokenId);
              if (!attrs) return null;
              const card: PlayerAttributes = {
                ...attrs,
                tokenId: l.tokenId,
                mintedAt: l.listedAt,
              };
              const isOwner = l.seller === "you" || (address && l.seller.toLowerCase() === address.toLowerCase());
              return (
                <div key={l.tokenId} className="flex flex-col gap-1.5">
                  <PlayerCard
                    card={card}
                    variant="market"
                    price={l.price}
                    ownerName={l.sellerName ?? truncateAddress(l.seller)}
                    onPrimary={
                      isOwner || !isConnected
                        ? undefined
                        : () => setActiveListing(l)
                    }
                    primaryLabel={isOwner ? "YOUR LISTING" : "BUY NOW"}
                    busy={busy}
                  />
                  <p className="text-[9px] text-[#7D9B8C] text-right tracking-wider">
                    {timeAgo(l.listedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeListing && activeAttrs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,15,8,0.85)] backdrop-blur-sm p-4"
            onClick={() => !busy && setActiveListing(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 8 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel-gold rounded-xl p-5 max-w-sm w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase flex items-center gap-2">
                  <ShoppingCart size={14} />
                  CONFIRM PURCHASE
                </h3>
                <button
                  onClick={() => setActiveListing(null)}
                  disabled={busy}
                  className="text-[#7D9B8C] hover:text-[#F3F7F4]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex justify-center mb-4">
                <div className="w-44">
                  <PlayerCard card={activeAttrs} variant="market" price={activeListing.price} />
                </div>
              </div>

              <div className="space-y-1.5 text-[10px] text-[#7D9B8C]">
                <div className="flex justify-between">
                  <span>PRICE</span>
                  <span className="font-mono text-[#F3F7F4]">
                    {activeListing.price} ETH
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PROTOCOL FEE (2.5%)</span>
                  <span className="font-mono text-[#F3F7F4]">
                    {(Number(activeListing.price) * 0.025).toFixed(4)} ETH
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SELLER</span>
                  <span className="font-mono text-[#F3F7F4]">
                    {truncateAddress(activeListing.seller)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setActiveListing(null)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#7D9B8C] border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-50"
                >
                  CANCEL
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={handleBuy}
                  disabled={busy}
                  className="flex-1 py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#040F08] disabled:opacity-50"
                  style={{ background: "linear-gradient(to right, #10B981, #059669)" }}
                >
                  {busy ? "BUYING..." : "BUY NOW"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
