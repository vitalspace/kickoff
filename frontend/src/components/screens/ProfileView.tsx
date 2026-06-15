"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Save, Palette } from "lucide-react";
import { useWalletStore } from "@/stores/useWalletStore";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import WalletGuard from "@/components/guards/WalletGuard";

const PRESET_COLORS = [
  "#10B981", "#D4AF37", "#EC4899", "#3B82F6",
  "#EF4444", "#8B5CF6", "#F97316", "#06B6D4",
];

type ProfileTab = "player" | "team";

export default function ProfileView({
  initialTab = "player",
}: {
  initialTab?: ProfileTab;
}) {
  const { address } = useWalletStore();
  const user = useQuery(api.users.getByWallet, address ? { walletAddress: address } : "skip");
  const updateSettings = useMutation(api.users.updateTeamSettings);
  const upsertUser = useMutation(api.users.upsert);

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [playerName, setPlayerName] = useState("");
  const [bio, setBio] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#10B981");
  const [teamAccent, setTeamAccent] = useState("#D4AF37");
  const [profileSaved, setProfileSaved] = useState(false);
  const [teamSaved, setTeamSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const ensureUser = async () => {
    if (user) return user._id;
    if (!address) throw new Error("Wallet not connected");
    return await upsertUser({ walletAddress: address });
  };

  if (user && !initialized) {
    setPlayerName(user.playerName || "");
    setBio(user.bio || "");
    setTeamName(user.teamName || "");
    setTeamColor(user.teamColor || "#10B981");
    setTeamAccent(user.teamAccent || "#D4AF37");
    setInitialized(true);
  }

  const handleSaveProfile = async () => {
    if (!address) return;
    try {
      const userId = await ensureUser();
      await updateSettings({
        userId,
        playerName: playerName || undefined,
        bio: bio || undefined,
      });
      setProfileSaved(true);
      toast.success("Profile saved", { description: "Your profile has been updated." });
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      toast.error("Failed to save", { description: "Something went wrong. Try again." });
    }
  };

  const handleSaveTeam = async () => {
    if (!address) return;
    try {
      const userId = await ensureUser();
      await updateSettings({
        userId,
        teamName: teamName || undefined,
        teamColor,
        teamAccent,
      });
      setTeamSaved(true);
      toast.success("Team saved", { description: "Your team settings have been updated." });
      setTimeout(() => setTeamSaved(false), 2000);
    } catch {
      toast.error("Failed to save", { description: "Something went wrong. Try again." });
    }
  };

  const tabs: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: "player", label: "PLAYER", icon: User },
    { id: "team", label: "TEAM", icon: Palette },
  ];

  return (
    <WalletGuard fullScreen={false}>
      <div className="flex flex-col gap-4 flex-1">
      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(4,15,8,0.85)] border border-[rgba(212,175,55,0.25)] rounded-lg px-1 py-1">
        {tabs.map((tab) => {
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
                  layoutId="profile-tab"
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

      {/* Player Tab */}
      {activeTab === "player" && (
        <motion.div
          key="player"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="glass-panel-gold rounded-xl p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.15)]">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold font-broadcast text-sm text-white border-2"
                  style={{ backgroundColor: teamColor, borderColor: teamAccent }}
                >
                  {playerName ? playerName.charAt(0).toUpperCase() : "P"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#7D9B8C] tracking-wider">WALLET</p>
                  <p className="font-mono text-xs text-[#F3F7F4] truncate">{address}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#7D9B8C] tracking-wider block mb-1.5">PLAYER NAME</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  className="w-full px-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.3)] rounded-lg text-[#F3F7F4] font-broadcast text-xs tracking-wider focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#7D9B8C] tracking-wider block mb-1.5">BIO</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  maxLength={150}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.3)] rounded-lg text-[#F3F7F4] font-broadcast text-xs tracking-wider focus:outline-none focus:border-[#D4AF37] resize-none"
                />
                <p className="text-[9px] text-[#7D9B8C] mt-1">{bio.length}/150</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleSaveProfile}
                className="w-full py-2.5 font-broadcast font-bold text-xs tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all"
                style={{ background: profileSaved ? "#10B981" : "linear-gradient(to right, #D4AF37, #C59E30)" }}
              >
                {profileSaved ? "SAVED!" : <><Save size={14} /> SAVE PROFILE</>}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <motion.div
          key="team"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="glass-panel-gold rounded-xl p-5">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#7D9B8C] tracking-wider block mb-1.5">TEAM NAME</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name"
                  maxLength={20}
                  className="w-full px-3 py-2 bg-[#040F08] border border-[rgba(212,175,55,0.3)] rounded-lg text-[#F3F7F4] font-broadcast text-xs tracking-wider focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#7D9B8C] tracking-wider block mb-1.5">PRIMARY COLOR</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTeamColor(color)}
                      className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: teamColor === color ? "#F3F7F4" : "transparent",
                        boxShadow: teamColor === color ? `0 0 12px ${color}40` : "none",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={teamColor}
                    onChange={(e) => setTeamColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#7D9B8C] tracking-wider block mb-1.5">ACCENT COLOR</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTeamAccent(color)}
                      className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: teamAccent === color ? "#F3F7F4" : "transparent",
                        boxShadow: teamAccent === color ? `0 0 12px ${color}40` : "none",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={teamAccent}
                    onChange={(e) => setTeamAccent(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#040F08]/60 border border-[rgba(212,175,55,0.1)]">
                <p className="text-[9px] text-[#7D9B8C] tracking-wider mb-2">PREVIEW</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold font-broadcast text-xs text-white"
                    style={{ backgroundColor: teamColor }}
                  >
                    {teamName ? teamName.charAt(0).toUpperCase() : "T"}
                  </div>
                  <div>
                    <p className="font-broadcast font-bold text-xs text-[#F3F7F4]">{teamName || "YOUR TEAM"}</p>
                    <p className="text-[9px] font-mono" style={{ color: teamAccent }}>
                      {teamColor} + {teamAccent}
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleSaveTeam}
                className="w-full py-2.5 font-broadcast font-bold text-xs tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all"
                style={{ background: teamSaved ? "#10B981" : "linear-gradient(to right, #D4AF37, #C59E30)" }}
              >
                {teamSaved ? "SAVED!" : <><Save size={14} /> SAVE TEAM</>}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
    </WalletGuard>
  );
}
