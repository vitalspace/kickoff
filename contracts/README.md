# KickOff 3D — Smart Contracts

Solidity contracts backing the KickOff 3D browser game, built with [Foundry](https://book.getfoundry.sh/).

The contracts mirror the gameplay model in `frontend/src/lib/game/engine.ts`
(90-minute match, home/away teams, score, possession %, three difficulty
levels) and extend it with on-chain ownership, escrowed stakes, and NFT
player cards.

## Contracts

| Contract            | Type   | Purpose |
|---------------------|--------|---------|
| `KickOffToken.sol`  | ERC20  | `KO3D` in-game currency (1B max supply, mintable, pausable, role-based access). |
| `KickOffPlayerNFT.sol` | ERC721 | Player cards with team/position/rating/stats. Admin + minter roles. |
| `KickOffMatch.sol`  | Custom | 1v1 match escrow. `createMatch` → `joinMatch` → `reportResult` → `claim`. |

## Layout

```
contracts/
├── src/                ← contract sources
├── script/             ← deployment scripts
├── test/               ← forge tests
├── lib/                ← dependencies (forge-std, openzeppelin-contracts)
├── deployments/        ← artefacts written by the deploy script (gitignored)
├── broadcast/           ← forge broadcast logs
└── foundry.toml
```

## Local Anvil workflow

```bash
# 1. Start Anvil (default chainId 31337, RPC at http://127.0.0.1:8545)
anvil

# 2. Build + test
forge build
forge test

# 3. Deploy everything (writes addresses to ./deployments/anvil.json)
forge script script/DeployAll.s.sol:DeployAll \
    --rpc-url local --broadcast
```

The deploy script:
- deploys the token with a 1,000,000 KO3D premint to the admin
- deploys the NFT with capacity 22 (one per starter for both squads)
- deploys the match contract (2.5% fee, admin as fee recipient)

Wire the resulting addresses into the frontend by either copying
`deployments/anvil.json` into the Next.js project or pointing your wallet
service at the `NEXT_PUBLIC_*` env vars it expects.

## Configuration

Environment variables read by `DeployAll.s.sol`:

| Var | Default | Description |
|---|---|---|
| `PRIVATE_KEY`     | anvil account #0 | deployer / admin key |
| `ADMIN_ADDR`      | = deployer        | recipient of admin roles & premint |
| `PREMINT_AMOUNT`  | `1000000e18`      | KO3D premint (wei) |

## Match lifecycle

```
                createMatch(stake, difficulty)
home ───────────────────────────────────────▶  OPEN
                                                  │
                                                  │ joinMatch(matchId)
                                                  ▼
                                away ────────  LIVE  (90-minute timer starts)
                                                  │
                                  reportResult(homeScore, awayScore, possession)
                                                  │  ← ORACLE_ROLE
                                                  ▼
                                              REPORTED
                                                  │
                                  claim(matchId) │  ← anyone
                                                  ▼
                                               SETTLED
```

Cancel path: `cancelOpenMatch(matchId)` reverts the stake to the creator
while the match is still `OPEN`.

## Tests

`forge test` runs 12 integration tests covering:
- token metadata, premint, supply cap, role-gated mint
- NFT minting, duplicate-card rejection, role-gated mint
- match full-flow (home wins, draw refunds), cancel, time-gate, oracle
  authorisation

## Network config (frontend alignment)

The frontend `frontend/src/lib/config/network.ts` already targets Anvil
(chainId 31337, RPC `http://127.0.0.1:8545`), so no extra wiring is
required for local development. For a public testnet, change
`--rpc-url` in the deploy command and set `NEXT_PUBLIC_*` env vars.
