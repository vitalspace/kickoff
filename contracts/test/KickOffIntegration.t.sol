// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}            from "forge-std/Test.sol";
import {KickOffToken}    from "../src/KickOffToken.sol";
import {KickOffPlayerNFT} from "../src/KickOffPlayerNFT.sol";
import {KickOffMatch}    from "../src/KickOffMatch.sol";

/// @notice End-to-end happy-path test: token premint, NFT mint, match create →
///         join → report → claim winnings.
contract KickOffIntegrationTest is Test {
    KickOffToken     internal token;
    KickOffPlayerNFT internal nft;
    KickOffMatch     internal matchC;

    address internal admin     = address(0xA1);
    address internal home      = address(0xB1);
    address internal away      = address(0xC1);
    address internal oracle    = address(0xD1);
    address internal feeVault  = address(0xE1);

    uint256 internal constant PREMINT = 1_000_000 ether;
    uint256 internal constant STAKE   = 100 ether;

    function setUp() public {
        token = new KickOffToken(admin, admin, PREMINT);
        nft   = new KickOffPlayerNFT(
            admin,
            "KickOff Player", "KOP",
            "ipfs://kickoff/players/", 100
        );
        matchC = new KickOffMatch(admin, address(token), feeVault, 250); // 2.5%

        // Wire up
        bytes32 oracleRole = matchC.ORACLE_ROLE();
        vm.prank(admin);
        matchC.grantRole(oracleRole, oracle);

        // Fund players with KO3D (admin has MINTER_ROLE on the token)
        vm.startPrank(admin);
        token.mint(home, 10_000 ether);
        token.mint(away, 10_000 ether);
        vm.stopPrank();

        vm.prank(home);
        token.approve(address(matchC), type(uint256).max);
        vm.prank(away);
        token.approve(address(matchC), type(uint256).max);
    }

    // ─── Token ─────────────────────────────────────────────────────────────
    function test_TokenMetadata() public view {
        assertEq(token.name(),   "KickOff 3D");
        assertEq(token.symbol(), "KO3D");
        assertEq(token.decimals(), 18);
    }

    function test_TokenPremint() public view {
        assertEq(token.balanceOf(admin), PREMINT);
    }

    function test_TokenCapRespected() public {
        uint256 remaining = token.MAX_SUPPLY() - token.totalSupply();
        vm.prank(admin);
        // Cannot mint over cap
        vm.expectRevert(KickOffToken.CapExceeded.selector);
        token.mint(address(0xF1), remaining + 1);
    }

    function test_NonMinterCannotMint() public {
        vm.prank(home);
        vm.expectRevert();
        token.mint(away, 1 ether);
    }

    // ─── NFT ───────────────────────────────────────────────────────────────
    function test_NftMintPlayer() public {
        vm.prank(admin);
        uint256 id = nft.mintPlayerCard(
            home,
            KickOffPlayerNFT.TeamId.HOME,
            KickOffPlayerNFT.Position.FWD,
            9, 91, 95, 88, 70, 40,
            "ipfs://kickoff/players/9.json"
        );
        assertEq(nft.ownerOf(id), home);
        KickOffPlayerNFT.PlayerAttributes memory a = nft.getAttributes(id);
        assertEq(uint8(a.team),     uint8(KickOffPlayerNFT.TeamId.HOME));
        assertEq(uint8(a.position), uint8(KickOffPlayerNFT.Position.FWD));
        assertEq(a.jerseyNumber, 9);
        assertEq(a.rating, 91);
    }

    function test_NftRejectsDuplicate() public {
        vm.startPrank(admin);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 80, 80, 80, 80, 80, "ipfs://x"
        );
        vm.expectRevert(KickOffPlayerNFT.PlayerAlreadyMinted.selector);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.MID,
            9, 80, 80, 80, 80, 80, "ipfs://y"
        );
        vm.stopPrank();
    }

    function test_NftNonMinterCannotMint() public {
        vm.prank(home);
        vm.expectRevert();
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.GK,
            1, 70, 50, 40, 50, 60, "ipfs://z"
        );
    }

    // ─── Match ─────────────────────────────────────────────────────────────
    function test_MatchFullFlow_HomeWins() public {
        // 1. Create
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.OPEN));

        // 2. Join
        vm.prank(away);
        matchC.joinMatch(id);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.LIVE));

        // 3. Warp past 90 min
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        // 4. Report: home 3 – 2 away, 60% home possession
        vm.prank(oracle);
        matchC.reportResult(id, 3, 2, 6000);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.REPORTED));

        // 5. Claim
        uint256 homeBalBefore = token.balanceOf(home);
        uint256 feeVaultBefore = token.balanceOf(feeVault);
        matchC.claim(id);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.SETTLED));

        // Winner takes pot (2 * stake) minus 2.5% fee
        uint256 pot       = STAKE * 2;
        uint256 fee       = (pot * 250) / 10_000;
        uint256 payout    = pot - fee;
        assertEq(token.balanceOf(home) - homeBalBefore,    payout);
        assertEq(token.balanceOf(feeVault) - feeVaultBefore, fee);
    }

    function test_MatchFullFlow_DrawRefunds() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);

        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(oracle);
        matchC.reportResult(id, 1, 1, 5000);

        uint256 homeBalBefore = token.balanceOf(home);
        uint256 awayBalBefore = token.balanceOf(away);
        matchC.claim(id);

        // pot = 200, fee = (200 * 250) / 10000 = 5, payout = 195 (even)
        // each side gets payout/2 = 97.5 KO3D
        uint256 payout = (STAKE * 2) - ((STAKE * 2 * 250) / 10_000);
        uint256 refund = payout / 2;
        assertEq(token.balanceOf(home) - homeBalBefore, refund);
        assertEq(token.balanceOf(away) - awayBalBefore, refund);
    }

    function test_MatchCannotReportTooEarly() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);

        vm.prank(oracle);
        vm.expectRevert(KickOffMatch.MatchNotFinished.selector);
        matchC.reportResult(id, 1, 0, 5000);
    }

    function test_MatchCreatorCanCancelOpen() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.LEGENDARY);

        uint256 balBefore = token.balanceOf(home);
        vm.prank(home);
        matchC.cancelOpenMatch(id);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.CANCELLED));
        assertEq(token.balanceOf(home) - balBefore, STAKE);
    }

    function test_MatchNonOracleCannotReport() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(home); // not oracle
        vm.expectRevert();
        matchC.reportResult(id, 1, 0, 5000);
    }
}
