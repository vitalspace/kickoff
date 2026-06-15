# KickOff 3D

3D browser-based soccer/football game with multiplayer, NFTs, and on-chain betting.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **3D Engine:** Three.js + React Three Fiber + Rapier physics
- **State:** Zustand + Convex (leaderboard, profiles, NFT data)
- **Blockchain:** Solidity (Foundry), ethers v6, Anvil dev chain
- **Multiplayer:** Bun WebSocket server
- **UI:** shadcn/ui, framer-motion, lucide-react

## Features

- **8v8 soccer match** with physics-based gameplay (Rapier)
- **Play vs AI** — single-player mode with difficulty selection
- **Play Online** — real-time multiplayer via WebSocket rooms, server-authoritative game loop
- **NFT players** — mint, buy, sell on-chain; NFT stats (speed, shooting, passing, defense, ability) inject into gameplay
- **Squad system** — assign NFTs to GK/DEF/MID slots, auto-fill, stat multipliers
- **Leaderboard** — Convex-backed, tracks wins/draws/losses with points
- **Profile** — player name, bio, team customization with colors
- **Market** — NFT marketplace with ETH payments, house fee
- **Betting** — PvCPU bets with native ETH (0.001 ETH entry), house-edge model
- **Wallet** — MetaMask integration, chain switching, network validation
- **i18n** — English/Chinese locale support

## Smart Contracts

| Contract | Purpose |
|---|---|
| `KickOffPlayerNFT` | ERC-721 NFT players with on-chain stats |
| `KickOffToken` | KO3D ERC-20 token |
| `KickOffMatch` | Match staking with KO3D |
| `KickOffMarket` | NFT marketplace (ETH payments) |
| `KickOffBet` | PvCPU betting (native ETH) |

## Getting Started

```bash
# Install dependencies
bun install

# Start Anvil (dev blockchain)
anvil --state /home/vital/.anvil-state

# Deploy contracts (in contracts/ directory)
forge script script/DeployAll.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Start dev server (runs Convex + Next.js)
cd frontend && bun dev

# Start WS server (for multiplayer)
cd ws && bun run index.ts
```

## Project Structure

```
kickoff-3d/
├── frontend/          # Next.js app
│   ├── src/
│   │   ├── app/       # App Router pages
│   │   ├── components/# UI, game screens, market, squad
│   │   ├── lib/       # Game logic, services, config
│   │   ├── stores/    # Zustand stores
│   │   └── hooks/     # Custom React hooks
│   └── convex/        # Convex schema, functions
├── contracts/         # Solidity (Foundry)
│   ├── src/           # Contract sources
│   ├── script/        # Deploy scripts
│   └── test/          # Contract tests
└── ws/                # WebSocket multiplayer server
```

## Dev Commands

```bash
bun dev          # Start Convex + Next.js
bun run lint     # Lint
bun run build    # Build
```
