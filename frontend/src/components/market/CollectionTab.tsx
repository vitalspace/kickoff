"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, Tag, X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useMarketStore, PlayerAttributes, Listing } from "@/stores/useMarketStore";
import { marketService } from "@/lib/services/marketService";
import { useWalletStore } from "@/stores/useWalletStore";
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

export default function CollectionTab() {
  const myNfts = useMarketStore((s) => s.myNfts);
  const listings = useMarketStore((s) => s.listings);
  const { address, isConnected } = useWalletStore();

  const [listingToken, setListingToken] = useState<PlayerAttributes | null>(null);
  const [price, setPrice] = useState("150");
  const [busy, setBusy] = useState(false);

  const listedTokenIds = useMemo(
    () => new Set(listings.map((l) => l.tokenId)),
    [listings],
  );

  const myListings = useMemo(() => {
    return listings.filter(
      (l) => l.seller === "you" || (address && l.seller.toLowerCase() === address.toLowerCase()),
    );
  }, [listings, address]);

  const myListingByToken = useMemo(() => {
    const map = new Map<number, Listing>();
    myListings.forEach((l) => map.set(l.tokenId, l));
    return map;
  }, [myListings]);

  const handleOpenList = (card: PlayerAttributes) => {
    setListingToken(card);
    setPrice("150");
  };

  const handleConfirmList = async () => {
    if (!listingToken) return;
    if (Number(price) <= 0) {
      toast.error("Invalid price", { description: "Price must be greater than 0." });
      return;
    }
    setBusy(true);
    try {
      await marketService.listItem(listingToken.tokenId, price);
      toast.success("Listed for sale", {
        description: `Card #${listingToken.tokenId} is live on the marketplace.`,
      });
      setListingToken(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Listing failed";
      toast.error("Listing failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (tokenId: number) => {
    setBusy(true);
    try {
      await marketService.cancelListing(tokenId);
      toast.success("Listing cancelled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cancel failed";
      toast.error("Cancel failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="glass-panel-gold rounded-xl p-8 text-center">
        <Wallet size={28} className="text-[#D4AF37] mx-auto mb-3" />
        <p className="font-broadcast font-bold text-sm text-[#F3F7F4] tracking-widest">
          WALLET REQUIRED
        </p>
        <p className="text-[10px] text-[#7D9B8C] mt-1">
          Connect your wallet to view your collection.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel-gold rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase flex items-center gap-2">
            <Inbox size={14} />
            MY COLLECTION
          </h3>
          <span className="text-[10px] text-[#7D9B8C] font-mono">
            {myNfts.length} CARDS
          </span>
        </div>

        {myNfts.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-dashed border-[rgba(212,175,55,0.3)] flex items-center justify-center">
              <Inbox size={26} className="text-[#D4AF37]/50" />
            </div>
            <p className="text-[#7D9B8C] text-xs font-broadcast tracking-widest">
              NO CARDS YET
            </p>
            <p className="text-[#7D9B8C] text-[10px] mt-1">
              Head to the MINT tab to roll your first player.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {myNfts.map((card) => {
              const isListed = listedTokenIds.has(card.tokenId);
              const myListing = myListingByToken.get(card.tokenId);
              return (
                <PlayerCard
                  key={card.tokenId}
                  card={card}
                  variant="collection"
                  primaryLabel={isListed ? "ALREADY LISTED" : "LIST FOR SALE"}
                  secondaryLabel={
                    isListed && myListing ? "CANCEL LISTING" : undefined
                  }
                  busy={busy}
                  onPrimary={isListed ? undefined : () => handleOpenList(card)}
                  onSecondary={
                    isListed && myListing
                      ? () => handleCancel(card.tokenId)
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {myListings.length > 0 && (
        <div className="glass-panel rounded-xl p-4">
          <h4 className="font-broadcast font-bold text-xs text-[#C59E30] uppercase tracking-wider mb-2 flex items-center gap-2">
            <Tag size={12} />
            ACTIVE LISTINGS
          </h4>
          <div className="space-y-1.5">
            {myListings.map((l) => (
              <div
                key={l.tokenId}
                className="flex items-center justify-between p-2 rounded bg-[#040F08]/60 border border-[rgba(212,175,55,0.1)] text-[10px]"
              >
                <span className="font-mono text-[#F3F7F4]">#{l.tokenId}</span>
                <span className="font-mono text-[#D4AF37]">{l.price} ETH</span>
                <span className="text-[#7D9B8C]">{timeAgo(l.listedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {listingToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,15,8,0.85)] backdrop-blur-sm p-4"
            onClick={() => !busy && setListingToken(null)}
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
                <h3 className="font-broadcast font-bold text-sm text-[#D4AF37] tracking-widest uppercase">
                  LIST FOR SALE
                </h3>
                <button
                  onClick={() => setListingToken(null)}
                  disabled={busy}
                  className="text-[#7D9B8C] hover:text-[#F3F7F4]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex justify-center mb-4">
                <div className="w-44">
                  <PlayerCard card={listingToken} variant="collection" />
                </div>
              </div>

              <label className="block text-[10px] text-[#7D9B8C] tracking-wider mb-1.5 font-broadcast">
                PRICE (ETH)
              </label>
              <input
                type="number"
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={busy}
                className="w-full px-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.3)] rounded-lg text-[#F3F7F4] font-mono text-sm focus:outline-none focus:border-[#D4AF37]"
              />
              <p className="text-[9px] text-[#7D9B8C] mt-1">
                A 2.5% protocol fee applies on sale.
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setListingToken(null)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#7D9B8C] border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-50"
                >
                  CANCEL
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={handleConfirmList}
                  disabled={busy}
                  className="flex-1 py-2 rounded-md font-broadcast font-bold text-[10px] tracking-widest text-[#040F08] disabled:opacity-50"
                  style={{ background: "linear-gradient(to right, #D4AF37, #C59E30)" }}
                >
                  {busy ? "LISTING..." : "CONFIRM"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
