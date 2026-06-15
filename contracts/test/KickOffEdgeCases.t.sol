// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}              from "forge-std/Test.sol";
import {ERC721}            from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20}            from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}         from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {KickOffToken}      from "../src/KickOffToken.sol";
import {KickOffPlayerNFT}  from "../src/KickOffPlayerNFT.sol";
import {KickOffMatch}      from "../src/KickOffMatch.sol";

/// @notice Edge-case, access-control, pause, fuzz, and invariant-ish tests
///         for the KickOff contract suite. Companion to KickOffIntegration.t.sol.
contract KickOffEdgeCases is Test {
    KickOffToken     internal token;
    KickOffPlayerNFT internal nft;
    KickOffMatch     internal matchC;

    address internal admin     = address(0xA1);
    address internal home      = address(0xB1);
    address internal away      = address(0xC1);
    address internal away2     = address(0xC2);
    address internal oracle    = address(0xD1);
    address internal feeVault  = address(0xE1);
    address internal stranger  = address(0xF1);

    uint256 internal constant PREMINT = 1_000_000 ether;
    uint256 internal constant STAKE   = 100 ether;

    function setUp() public {
        token = new KickOffToken(admin, admin, PREMINT);
        nft   = new KickOffPlayerNFT(
            admin, "KickOff Player", "KOP", "ipfs://kickoff/players/", 100
        );
        matchC = new KickOffMatch(admin, address(token), feeVault, 250);

        bytes32 oracleRole = matchC.ORACLE_ROLE();
        vm.prank(admin);
        matchC.grantRole(oracleRole, oracle);

        // Pre-fund the players
        vm.startPrank(admin);
        token.mint(home, 100_000 ether);
        token.mint(away, 100_000 ether);
        token.mint(away2, 100_000 ether);
        token.mint(stranger, 100_000 ether);
        vm.stopPrank();

        // Approve match contract
        vm.prank(home);     token.approve(address(matchC), type(uint256).max);
        vm.prank(away);     token.approve(address(matchC), type(uint256).max);
        vm.prank(away2);    token.approve(address(matchC), type(uint256).max);
        vm.prank(stranger); token.approve(address(matchC), type(uint256).max);
    }

    // ════════════════════════════════════════════════════════════════════════
    // KickOffToken — edge cases
    // ════════════════════════════════════════════════════════════════════════

    function test_Token_PremintToZeroAddress_Reverts() public {
        vm.expectRevert(KickOffToken.MintToZeroAddress.selector);
        new KickOffToken(admin, address(0), 1 ether);
    }

    function test_Token_AdminCanGrantAndRevokeMinter() public {
        bytes32 minterRole = token.MINTER_ROLE();

        vm.prank(admin);
        token.grantRole(minterRole, stranger);

        vm.prank(stranger);
        token.mint(home, 1 ether);
        assertEq(token.balanceOf(home), 100_000 ether + 1 ether);

        vm.prank(admin);
        token.revokeRole(minterRole, stranger);

        vm.prank(stranger);
        vm.expectRevert();
        token.mint(home, 1 ether);
    }

    function test_Token_TransferWorksNormally() public {
        vm.prank(home);
        token.transfer(away, 50 ether);
        assertEq(token.balanceOf(away), 100_050 ether);
    }

    function test_Token_BurnReducesSupply() public {
        uint256 supplyBefore = token.totalSupply();
        vm.prank(home);
        token.burn(10 ether);
        assertEq(token.totalSupply(), supplyBefore - 10 ether);
    }

    function test_Token_PauseBlocksTransfers() public {
        vm.prank(admin);
        token.pause();

        vm.prank(home);
        vm.expectRevert();
        token.transfer(away, 1 ether);
    }

    function test_Token_PauseBlocksMints() public {
        vm.prank(admin);
        token.pause();

        vm.prank(admin);
        vm.expectRevert();
        token.mint(home, 1 ether);
    }

    function test_Token_UnpauseRestoresTransfers() public {
        vm.startPrank(admin);
        token.pause();
        token.unpause();
        vm.stopPrank();

        vm.prank(home);
        token.transfer(away, 1 ether);
        assertEq(token.balanceOf(away), 100_001 ether);
    }

    function test_Token_DefaultAdminCanManageRoles() public {
        // The DEFAULT_ADMIN_ROLE holder is the only one that can grant it
        bytes32 defaultRole = token.DEFAULT_ADMIN_ROLE();
        assertTrue(token.hasRole(defaultRole, admin));

        vm.prank(stranger);
        vm.expectRevert();
        token.grantRole(defaultRole, stranger);
    }

    function test_Token_MaxSupplyBoundary() public {
        uint256 remaining = token.MAX_SUPPLY() - token.totalSupply();

        vm.prank(admin);
        token.mint(home, remaining); // exactly at cap
        assertEq(token.totalSupply(), token.MAX_SUPPLY());

        // One wei more should fail
        vm.prank(admin);
        vm.expectRevert(KickOffToken.CapExceeded.selector);
        token.mint(home, 1);
    }

    // ════════════════════════════════════════════════════════════════════════
    // KickOffPlayerNFT — edge cases
    // ════════════════════════════════════════════════════════════════════════

    function test_Nft_MintBoundary_Jersey1_11() public {
        vm.startPrank(admin);
        for (uint8 j = 1; j <= 11; j++) {
            nft.mintPlayerCard(
                home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
                j, 80, 80, 80, 80, 80, "ipfs://x"
            );
        }
        vm.stopPrank();
        assertEq(nft.balanceOf(home), 11);
    }

    function test_Nft_RejectsJerseyZero() public {
        vm.prank(admin);
        vm.expectRevert(KickOffPlayerNFT.InvalidJerseyNumber.selector);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            0, 80, 80, 80, 80, 80, "ipfs://x"
        );
    }

    function test_Nft_RejectsJerseyTwelve() public {
        vm.prank(admin);
        vm.expectRevert(KickOffPlayerNFT.InvalidJerseyNumber.selector);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            12, 80, 80, 80, 80, 80, "ipfs://x"
        );
    }

    function test_Nft_RejectsRatingTooLow() public {
        vm.prank(admin);
        vm.expectRevert(KickOffPlayerNFT.InvalidRating.selector);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            1, 39, 80, 80, 80, 80, "ipfs://x"
        );
    }

    function test_Nft_RejectsRatingTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(KickOffPlayerNFT.InvalidRating.selector);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            1, 100, 80, 80, 80, 80, "ipfs://x"
        );
    }

    function test_Nft_MaxSupplyEnforced() public {
        // Re-deploy NFT with cap=1
        KickOffPlayerNFT tiny = new KickOffPlayerNFT(
            admin, "Tiny", "TINY", "ipfs://x/", 1
        );

        vm.startPrank(admin);
        tiny.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            1, 80, 80, 80, 80, 80, "ipfs://1"
        );
        vm.expectRevert(KickOffPlayerNFT.MaxSupplyReached.selector);
        tiny.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.AWAY, KickOffPlayerNFT.Position.GK,
            1, 80, 80, 80, 80, 80, "ipfs://2"
        );
        vm.stopPrank();
    }

    function test_Nft_TransferBetweenOwners() public {
        vm.prank(admin);
        uint256 id = nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 91, 95, 88, 70, 40, "ipfs://9"
        );

        vm.prank(home);
        nft.transferFrom(home, away, id);
        assertEq(nft.ownerOf(id), away);
    }

    function test_Nft_ApproveAndTransfer() public {
        vm.prank(admin);
        uint256 id = nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.MID,
            8, 85, 80, 90, 75, 60, "ipfs://8"
        );

        vm.prank(home);
        nft.approve(away, id);

        vm.prank(away);
        nft.transferFrom(home, stranger, id);
        assertEq(nft.ownerOf(id), stranger);
    }

    function test_Nft_SupportsERC721Interface() public view {
        // 0x80ac58cd = ERC721
        assertTrue(nft.supportsInterface(0x80ac58cd));
        // 0x01ffc9a7 = ERC165
        assertTrue(nft.supportsInterface(0x01ffc9a7));
    }

    function test_Nft_BatchMintAllPositions() public {
        KickOffPlayerNFT.PlayerAttributes[]
            memory attrs = new KickOffPlayerNFT.PlayerAttributes[](4);
        attrs[0] = KickOffPlayerNFT.PlayerAttributes({
            team: KickOffPlayerNFT.TeamId.HOME, position: KickOffPlayerNFT.Position.GK,
            jerseyNumber: 1, rating: 80, speedStat: 50, shootStat: 40, passing: 60, defense: 70,
            ability: KickOffPlayerNFT.Ability.NONE
        });
        attrs[1] = KickOffPlayerNFT.PlayerAttributes({
            team: KickOffPlayerNFT.TeamId.HOME, position: KickOffPlayerNFT.Position.DEF,
            jerseyNumber: 2, rating: 82, speedStat: 70, shootStat: 50, passing: 65, defense: 90,
            ability: KickOffPlayerNFT.Ability.NONE
        });
        attrs[2] = KickOffPlayerNFT.PlayerAttributes({
            team: KickOffPlayerNFT.TeamId.HOME, position: KickOffPlayerNFT.Position.MID,
            jerseyNumber: 8, rating: 86, speedStat: 80, shootStat: 78, passing: 90, defense: 75,
            ability: KickOffPlayerNFT.Ability.NONE
        });
        attrs[3] = KickOffPlayerNFT.PlayerAttributes({
            team: KickOffPlayerNFT.TeamId.HOME, position: KickOffPlayerNFT.Position.FWD,
            jerseyNumber: 9, rating: 91, speedStat: 95, shootStat: 88, passing: 70, defense: 40,
            ability: KickOffPlayerNFT.Ability.NONE
        });

        string[] memory uris = new string[](4);
        uris[0] = "ipfs://gk";
        uris[1] = "ipfs://def";
        uris[2] = "ipfs://mid";
        uris[3] = "ipfs://fwd";

        vm.prank(admin);
        nft.mintBatch(home, attrs, uris);
        assertEq(nft.balanceOf(home), 4);
    }

    function test_Nft_BatchRejectsLengthMismatch() public {
        KickOffPlayerNFT.PlayerAttributes[]
            memory attrs = new KickOffPlayerNFT.PlayerAttributes[](1);
        attrs[0] = KickOffPlayerNFT.PlayerAttributes({
            team: KickOffPlayerNFT.TeamId.HOME, position: KickOffPlayerNFT.Position.FWD,
            jerseyNumber: 9, rating: 80, speedStat: 80, shootStat: 80, passing: 80, defense: 80,
            ability: KickOffPlayerNFT.Ability.NONE
        });
        string[] memory uris = new string[](2);

        vm.prank(admin);
        vm.expectRevert("length mismatch");
        nft.mintBatch(home, attrs, uris);
    }

    function test_Nft_DuplicateAcrossTeamsAllowed() public {
        // Same jersey number on home and away should be allowed (different teams)
        vm.startPrank(admin);
        uint256 idHome = nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 80, 80, 80, 80, 80, "ipfs://home"
        );
        uint256 idAway = nft.mintPlayerCard(
            away, KickOffPlayerNFT.TeamId.AWAY, KickOffPlayerNFT.Position.FWD,
            9, 80, 80, 80, 80, 80, "ipfs://away"
        );
        vm.stopPrank();
        assertEq(nft.ownerOf(idHome), home);
        assertEq(nft.ownerOf(idAway), away);
        assertTrue(idHome != idAway);
    }

    function test_Nft_BaseURIUpdate() public {
        vm.prank(admin);
        nft.setBaseURI("ipfs://newuri/");
        assertEq(nft.baseURI(), "ipfs://newuri/");
        // tokenURI is set per-mint and stored; we only check baseURI here
    }

    function test_Nft_NonAdminCannotSetBaseURI() public {
        vm.prank(stranger);
        vm.expectRevert();
        nft.setBaseURI("ipfs://hacked/");
    }

    function test_Nft_PauseBlocksMints() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(admin);
        vm.expectRevert();
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 80, 80, 80, 80, 80, "ipfs://x"
        );

        vm.prank(admin);
        nft.unpause();

        vm.prank(admin);
        nft.mintPlayerCard(
            home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 80, 80, 80, 80, 80, "ipfs://x"
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // KickOffMatch — edge cases
    // ════════════════════════════════════════════════════════════════════════

    function test_Match_RejectsZeroStake() public {
        vm.prank(home);
        vm.expectRevert(KickOffMatch.InvalidStake.selector);
        matchC.createMatch(0, KickOffMatch.Difficulty.AMATEUR);
    }

    function test_Match_CreatorCannotJoinOwnMatch() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        vm.prank(home);
        vm.expectRevert(KickOffMatch.NotParticipant.selector);
        matchC.joinMatch(id);
    }

    function test_Match_CannotJoinNonOpen() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        // First join succeeds
        vm.prank(away);
        matchC.joinMatch(id);

        // Second join (by a third party) reverts
        vm.prank(away2);
        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.joinMatch(id);
    }

    function test_Match_OnlyCreatorCanCancel() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        vm.prank(away);
        vm.expectRevert(KickOffMatch.NotCreator.selector);
        matchC.cancelOpenMatch(id);
    }

    function test_Match_CannotCancelAfterJoin() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);

        vm.prank(home);
        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.cancelOpenMatch(id);
    }

    function test_Match_ReportAtExactDurationBoundary_Succeeds() public {
        // Report should succeed at exactly liveAt + duration (use >=
        // so the boundary is inclusive).
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);

        vm.warp(block.timestamp + matchC.defaultDuration()); // exact boundary
        vm.prank(oracle);
        matchC.reportResult(id, 1, 0, 5000);
        assertEq(uint8(matchC.getMatch(id).state), uint8(KickOffMatch.State.REPORTED));
    }

    function test_Match_ReportOneSecondEarly_Reverts() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);

        vm.warp(block.timestamp + matchC.defaultDuration() - 1);
        vm.prank(oracle);
        vm.expectRevert(KickOffMatch.MatchNotFinished.selector);
        matchC.reportResult(id, 1, 0, 5000);
    }

    function test_Match_ReportTwice_Reverts() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(oracle);
        matchC.reportResult(id, 1, 0, 5000);

        vm.prank(oracle);
        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.reportResult(id, 2, 0, 5000);
    }

    function test_Match_ReportOpenMatch_Reverts() public {
        // No opponent joined
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.reportResult(id, 1, 0, 5000);
    }

    function test_Match_ReportRejectsInvalidBps() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(oracle);
        vm.expectRevert(KickOffMatch.InvalidBps.selector);
        matchC.reportResult(id, 1, 0, 10_001);
    }

    function test_Match_ClaimOpen_Reverts() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.claim(id);
    }

    function test_Match_ClaimSettled_Reverts() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        matchC.reportResult(id, 2, 1, 5000);

        matchC.claim(id); // first claim succeeds
        vm.expectRevert(KickOffMatch.InvalidState.selector);
        matchC.claim(id); // second reverts
    }

    function test_Match_AwayWins() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.LEGENDARY);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(oracle);
        matchC.reportResult(id, 0, 5, 3000); // away wins

        uint256 awayBalBefore = token.balanceOf(away);
        matchC.claim(id);

        // 200 - 2.5% = 195
        assertEq(token.balanceOf(away) - awayBalBefore, 195 ether);
    }

    function test_Match_DrawZeroZero_Refunds() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);

        vm.prank(oracle);
        matchC.reportResult(id, 0, 0, 5000);

        uint256 homeBefore = token.balanceOf(home);
        uint256 awayBefore = token.balanceOf(away);
        matchC.claim(id);

        // pot = 200, fee = (200 * 250) / 10000 = 5
        // payout = 200 - 5 = 195 (even), so each side gets 97.5 (no dust)
        assertEq(token.balanceOf(home) - homeBefore, 97.5 ether);
        assertEq(token.balanceOf(away) - awayBefore, 97.5 ether);
    }

    function test_Match_PotConservation_AfterHomeWin() public {
        // Sum of all balances before == after (only fees are taken out of the
        // ecosystem, but in this test the fee recipient is the admin who already
        // had KO3D, so the only movement is the 2.5% fee).
        uint256 totalBefore = token.balanceOf(home) + token.balanceOf(away)
                            + token.balanceOf(feeVault) + token.balanceOf(address(matchC));

        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        matchC.reportResult(id, 3, 1, 5000);
        matchC.claim(id);

        uint256 totalAfter = token.balanceOf(home) + token.balanceOf(away)
                           + token.balanceOf(feeVault) + token.balanceOf(address(matchC));
        assertEq(totalBefore, totalAfter);
    }

    function test_Match_MultipleMatchesInParallel() public {
        vm.startPrank(home);
        uint64 id1 = matchC.createMatch(STAKE,   KickOffMatch.Difficulty.AMATEUR);
        uint64 id2 = matchC.createMatch(STAKE*2, KickOffMatch.Difficulty.PRO);
        uint64 id3 = matchC.createMatch(STAKE*3, KickOffMatch.Difficulty.LEGENDARY);
        vm.stopPrank();

        vm.prank(away);    matchC.joinMatch(id1);
        vm.prank(away2);   matchC.joinMatch(id2);
        vm.prank(stranger);matchC.joinMatch(id3);

        assertEq(uint8(matchC.getMatch(id1).state), uint8(KickOffMatch.State.LIVE));
        assertEq(uint8(matchC.getMatch(id2).state), uint8(KickOffMatch.State.LIVE));
        assertEq(uint8(matchC.getMatch(id3).state), uint8(KickOffMatch.State.LIVE));

        assertEq(matchC.getMatch(id1).stake, STAKE);
        assertEq(matchC.getMatch(id2).stake, STAKE * 2);
        assertEq(matchC.getMatch(id3).stake, STAKE * 3);

        // Settle them all at once
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.startPrank(oracle);
        matchC.reportResult(id1, 1, 0, 5000);
        matchC.reportResult(id2, 0, 1, 5000);
        matchC.reportResult(id3, 2, 2, 5000);
        vm.stopPrank();

        matchC.claim(id1);
        matchC.claim(id2);
        matchC.claim(id3);
    }

    function test_Match_NextMatchIdIncrements() public {
        assertEq(matchC.nextMatchId(), 0);
        vm.prank(home);
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        assertEq(matchC.nextMatchId(), 1);
        vm.prank(home);
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        assertEq(matchC.nextMatchId(), 2);
    }

    function test_Match_PauseBlocksCreate() public {
        vm.prank(admin);
        matchC.pause();

        vm.prank(home);
        vm.expectRevert();
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
    }

    function test_Match_PauseBlocksJoin() public {
        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);

        vm.prank(admin);
        matchC.pause();

        vm.prank(away);
        vm.expectRevert();
        matchC.joinMatch(id);
    }

    function test_Match_AdminCanSetDuration() public {
        vm.prank(admin);
        matchC.setDefaultDuration(30 minutes);
        assertEq(matchC.defaultDuration(), 30 minutes);

        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);
        assertEq(matchC.getMatch(id).duration, 30 minutes);
    }

    function test_Match_RejectsDurationTooShort() public {
        vm.prank(admin);
        vm.expectRevert(KickOffMatch.InvalidDuration.selector);
        matchC.setDefaultDuration(30); // < 60 seconds
    }

    function test_Match_RejectsDurationTooLong() public {
        vm.prank(admin);
        vm.expectRevert(KickOffMatch.InvalidDuration.selector);
        matchC.setDefaultDuration(7 days); // > 6 hours
    }

    function test_Match_AdminCanSetFee() public {
        vm.prank(admin);
        matchC.setFeeConfig(admin, 500); // 5%
        (address recipient, /*uint16 bps*/) = (matchC.feeRecipient(), matchC.feeBps());
        // (function returns both via getter pair below)
        assertEq(recipient, admin);
        assertEq(matchC.feeBps(), 500);
    }

    function test_Match_RejectsFeeAbove20Percent() public {
        vm.prank(admin);
        vm.expectRevert("fee>20%");
        matchC.setFeeConfig(admin, 2_001);
    }

    function test_Match_FeeZeroWorks() public {
        vm.prank(admin);
        matchC.setFeeConfig(address(0), 0); // no fee

        vm.prank(home);
        uint64 id = matchC.createMatch(STAKE, KickOffMatch.Difficulty.PRO);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        matchC.reportResult(id, 1, 0, 5000);

        uint256 homeBefore = token.balanceOf(home);
        matchC.claim(id);
        assertEq(token.balanceOf(home) - homeBefore, 200 ether); // full pot
    }

    function test_Match_NonAdminCannotSetFee() public {
        vm.prank(stranger);
        vm.expectRevert();
        matchC.setFeeConfig(stranger, 100);
    }

    function test_Match_NonAdminCannotGrantOracle() public {
        bytes32 oracleRole = matchC.ORACLE_ROLE();
        vm.prank(stranger);
        vm.expectRevert();
        matchC.grantRole(oracleRole, stranger);
    }

    function test_Match_ListOpenMatches() public {
        // Create 3, join 1, leave 2 open
        vm.startPrank(home);
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        matchC.createMatch(STAKE, KickOffMatch.Difficulty.AMATEUR);
        vm.stopPrank();

        vm.prank(away);
        matchC.joinMatch(2);

        (uint64[] memory ids, address[] memory creators, uint256[] memory stakes) =
            matchC.listOpenMatches(0, 10);

        assertEq(ids.length, 2);
        assertEq(creators.length, 2);
        assertEq(stakes.length, 2);
        // Should contain match 1 and 3, NOT match 2
        assertTrue(ids[0] == 1 || ids[0] == 3);
        assertTrue(ids[1] == 1 || ids[1] == 3);
        assertTrue(ids[0] != ids[1]);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Fuzz tests
    // ════════════════════════════════════════════════════════════════════════

    function testFuzz_TokenMintRespectsCap(uint256 amount) public {
        // Cap the fuzz input to a reasonable range to keep the test fast
        amount = bound(amount, 0, token.MAX_SUPPLY() * 2);

        uint256 remaining = token.MAX_SUPPLY() - token.totalSupply();

        if (amount > remaining) {
            vm.prank(admin);
            vm.expectRevert(KickOffToken.CapExceeded.selector);
            token.mint(home, amount);
        } else {
            vm.prank(admin);
            token.mint(home, amount);
            assertEq(token.totalSupply(), token.totalSupply()); // no-op sanity
        }
    }

    function test_Match_DrawWithOddPayout_DustGoesToCreator() public {
        // Choose a stake so that (2*stake - fee) is ODD in wei.
        // With feeBps=250, fee = (2*stake*250)/10000. We want the
        // post-fee payout to be odd, which happens when (2*stake) mod 10000
        // is divisible by 40 (a small non-zero such remainder).
        // 2*stake = 10040 → stake = 5020
        uint256 stake = 5020;

        vm.prank(home);
        uint64 id = matchC.createMatch(stake, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        matchC.reportResult(id, 1, 1, 5000);

        uint256 homeBefore = token.balanceOf(home);
        uint256 awayBefore = token.balanceOf(away);
        matchC.claim(id);

        // Verify pot is fully distributed (contract holds 0)
        assertEq(token.balanceOf(address(matchC)), 0);
        // Verify home got one more wei than away (the dust)
        assertEq(token.balanceOf(home) - homeBefore, (token.balanceOf(away) - awayBefore) + 1);
    }

    function testFuzz_MatchStakeAlwaysReturned_OnDraw(uint256 stake) public {
        stake = bound(stake, 1 ether, 1_000 ether);

        vm.prank(home);
        uint64 id = matchC.createMatch(stake, KickOffMatch.Difficulty.AMATEUR);
        vm.prank(away);
        matchC.joinMatch(id);
        vm.warp(block.timestamp + matchC.defaultDuration() + 1);
        vm.prank(oracle);
        matchC.reportResult(id, 0, 0, 5000);

        // Conservation must hold across the whole system (players + escrow
        // + fee vault). The fee is the only amount that can change.
        uint256 totalBefore = token.balanceOf(home) + token.balanceOf(away)
                            + token.balanceOf(feeVault) + token.balanceOf(address(matchC));

        matchC.claim(id);

        uint256 totalAfter = token.balanceOf(home) + token.balanceOf(away)
                           + token.balanceOf(feeVault) + token.balanceOf(address(matchC));
        assertEq(totalBefore, totalAfter);

        // Each player should get at least (payout / 2), with the dust going
        // to the creator.
        uint256 pot     = stake * 2;
        uint256 fee     = (pot * 250) / 10_000;
        uint256 payout  = pot - fee;
        uint256 refund  = payout / 2;
        uint256 dust    = payout - refund * 2;
        assertEq(token.balanceOf(home), 100_000 ether - stake + refund + dust);
        assertEq(token.balanceOf(away), 100_000 ether - stake + refund);
        assertEq(token.balanceOf(feeVault), fee);
    }

    function testFuzz_NftRejectsInvalidRating(uint8 rating) public {
        // Anything outside [40, 99] must revert
        if (rating < 40 || rating > 99) {
            vm.prank(admin);
            vm.expectRevert(KickOffPlayerNFT.InvalidRating.selector);
            nft.mintPlayerCard(
                home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
                1, rating, 50, 50, 50, 50, "ipfs://x"
            );
        } else {
            vm.prank(admin);
            nft.mintPlayerCard(
                home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
                1, rating, 50, 50, 50, 50, "ipfs://x"
            );
        }
    }

    function testFuzz_NftRejectsInvalidJersey(uint8 jersey) public {
        if (jersey < 1 || jersey > 11) {
            vm.prank(admin);
            vm.expectRevert(KickOffPlayerNFT.InvalidJerseyNumber.selector);
            nft.mintPlayerCard(
                home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
                jersey, 80, 50, 50, 50, 50, "ipfs://x"
            );
        } else {
            vm.prank(admin);
            nft.mintPlayerCard(
                home, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
                jersey, 80, 50, 50, 50, 50, "ipfs://x"
            );
        }
    }
}
