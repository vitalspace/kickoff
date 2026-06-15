// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {KickOffToken}      from "../src/KickOffToken.sol";
import {KickOffPlayerNFT}  from "../src/KickOffPlayerNFT.sol";
import {KickOffMatch}      from "../src/KickOffMatch.sol";
import {KickOffMarket}     from "../src/KickOffMarket.sol";
import {KickOffBet}        from "../src/KickOffBet.sol";
import {KickOffMatchBet}   from "../src/KickOffMatchBet.sol";

/// @notice Deploys the full KickOff 3D contract suite to the configured
///         network (default: local Anvil at http://127.0.0.1:8545).
/// @dev    Reads:
///           - `PRIVATE_KEY`  : admin/deployer PK (default anvil account #0)
///           - `ADMIN_ADDR`   : optional, defaults to the deployer
///           - `PREMINT_AMOUNT`: KO3D premint to deployer (default 1M KO3D)
///         The script also wires up roles between contracts:
///           - Match contract is granted ORACLE_ROLE on the admin
///           - Match contract is granted MINTER_ROLE on the token (optional)
contract DeployAll is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address admin    = vm.envOr("ADMIN_ADDR", deployer);
        uint256 premint  = vm.envOr("PREMINT_AMOUNT", uint256(1_000_000) * 1e18);

        vm.startBroadcast(pk);

        // 1. ERC20 (KO3D)
        KickOffToken token = new KickOffToken(admin, admin, premint);
        console2.log("KickOffToken (KO3D):", address(token));

        // 2. ERC721 player cards
        KickOffPlayerNFT nft = new KickOffPlayerNFT(
            admin,
            "KickOff Player",
            "KOP",
            "ipfs://kickoff/players/",
            // 22 cards (11 home + 11 away)
            22
        );
        console2.log("KickOffPlayerNFT:    ", address(nft));

        // 3. Match escrow
        KickOffMatch match_ = new KickOffMatch(
            admin,
            address(token),
            admin,        // fee recipient
            250           // 2.5% fee
        );
        console2.log("KickOffMatch:        ", address(match_));

        // 4. Marketplace (NFT <-> ETH) — 2.5% fee
        KickOffMarket market = new KickOffMarket(
            admin,
            address(nft),
            admin,        // fee recipient
            250           // 2.5% protocol fee
        );
        console2.log("KickOffMarket:       ", address(market));

        // 5. Single-player vs CPU betting (native ETH)
        KickOffBet bet = new KickOffBet(
            admin,
            admin,        // fee recipient (house revenue)
            250           // 2.5% fee on winnings
        );
        console2.log("KickOffBet:          ", address(bet));

        // 6. Multiplayer 1v1 betting (native ETH, 0.001 ETH per side)
        KickOffMatchBet matchBet = new KickOffMatchBet(
            admin,
            admin,        // fee recipient (house revenue)
            500           // 5% fee on the pot (draw → house keeps everything)
        );
        console2.log("KickOffMatchBet:     ", address(matchBet));

        vm.stopBroadcast();

        // Write addresses for the frontend to consume
        _writeFrontendJson(address(token), address(nft), address(match_), address(market), address(bet), address(matchBet));
    }

    function _writeFrontendJson(address token, address nft, address match_, address market, address bet, address matchBet) internal {
        string memory json = string.concat(
            "{\n",
            '  "kickOffToken":     "', vm.toString(token),    '",\n',
            '  "kickOffPlayerNFT": "', vm.toString(nft),      '",\n',
            '  "kickOffMatch":     "', vm.toString(match_),   '",\n',
            '  "kickOffMarket":    "', vm.toString(market),   '",\n',
            '  "kickOffBet":       "', vm.toString(bet),      '",\n',
            '  "kickOffMatchBet":  "', vm.toString(matchBet), '"\n',
            "}\n"
        );
        string memory network = vm.envOr("NETWORK", string("anvil"));
        string memory out = string.concat("deployments/", network, ".json");
        vm.writeFile(out, json);
        console2.log("Wrote deployment JSON to", out);
    }
}
