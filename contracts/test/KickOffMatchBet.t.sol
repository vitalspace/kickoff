// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}            from "forge-std/Test.sol";
import {KickOffMatchBet} from "../src/KickOffMatchBet.sol";

/// @notice Happy + sad paths for the multiplayer 0.001 ETH escrow.
contract KickOffMatchBetTest is Test {
    KickOffMatchBet internal bet;

    address internal admin    = address(0xA1);
    address internal home     = address(0xB1);
    address internal away     = address(0xC1);
    address internal feeVault = address(0xD1);

    uint256 internal constant STAKE = 0.001 ether;

    function setUp() public {
        bet = new KickOffMatchBet(admin, feeVault, 500); // 5% fee

        vm.deal(home, 1 ether);
        vm.deal(away, 1 ether);
    }

    function test_StakeIsExactly_001Eth() public view {
        assertEq(bet.stakeWei(), STAKE);
        assertEq(STAKE, 1_000_000_000_000_000); // sanity: 0.001 ETH in wei
    }

    function test_CreateAndJoin_LiveState() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        assertEq(id, 1);

        KickOffMatchBet.MatchBet memory m = bet.getMatch(id);
        assertEq(uint8(m.state), uint8(KickOffMatchBet.State.OPEN));
        assertEq(m.home, home);
        assertEq(m.stake, STAKE);

        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        m = bet.getMatch(id);
        assertEq(uint8(m.state), uint8(KickOffMatchBet.State.LIVE));
        assertEq(m.away, away);
        assertEq(address(bet).balance, STAKE * 2);
    }

    function test_CreateReverts_WrongStake() public {
        vm.prank(home);
        vm.expectRevert(KickOffMatchBet.InvalidStake.selector);
        bet.createMatch{value: 0.002 ether}();

        vm.prank(home);
        vm.expectRevert(KickOffMatchBet.InvalidStake.selector);
        bet.createMatch{value: 0.0005 ether}();
    }

    function test_JoinReverts_WrongStake() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        vm.expectRevert(KickOffMatchBet.InvalidStake.selector);
        bet.joinMatch{value: 0.0005 ether}(id);
    }

    function test_JoinReverts_NotOpen() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        // Second join should fail (already LIVE)
        address otherAway = address(0xC2);
        vm.deal(otherAway, 1 ether);
        vm.prank(otherAway);
        vm.expectRevert(KickOffMatchBet.InvalidState.selector);
        bet.joinMatch{value: STAKE}(id);
    }

    function test_CreatorCannotJoinOwnMatch() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(home);
        vm.expectRevert(KickOffMatchBet.NotParticipant.selector);
        bet.joinMatch{value: STAKE}(id);
    }

    function test_HomeWinsFlow() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        // Oracle (admin has ORACLE_ROLE by default) reports
        vm.prank(admin);
        bet.reportResult(id, KickOffMatchBet.Winner.HOME);

        uint256 pot     = STAKE * 2;
        uint256 fee     = (pot * 500) / 10_000; // 5%
        uint256 payout  = pot - fee;
        uint256 homeBal = home.balance;
        uint256 feeBal  = feeVault.balance;

        // Anyone can settle — call from the home addr (could be anyone)
        bet.claim(id);

        assertEq(home.balance - homeBal,    payout);
        assertEq(feeVault.balance - feeBal, fee);

        // State is SETTLED — claiming again reverts
        vm.expectRevert(KickOffMatchBet.InvalidState.selector);
        bet.claim(id);
    }

    function test_AwayWinsFlow() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        vm.prank(admin);
        bet.reportResult(id, KickOffMatchBet.Winner.AWAY);

        uint256 pot    = STAKE * 2;
        uint256 fee    = (pot * 500) / 10_000; // 5%
        uint256 payout = pot - fee;
        uint256 awayBal = away.balance;

        bet.claim(id);

        assertEq(away.balance - awayBal, payout);
    }

    function test_DrawHouseTakesEverything() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        vm.prank(admin);
        bet.reportResult(id, KickOffMatchBet.Winner.NONE);

        uint256 homeBal = home.balance;
        uint256 awayBal = away.balance;
        uint256 feeBal  = feeVault.balance;

        bet.claim(id);

        // Draw → house keeps the entire pot, neither player gets anything.
        uint256 pot = STAKE * 2;
        assertEq(home.balance - homeBal,    0);
        assertEq(away.balance - awayBal,    0);
        assertEq(feeVault.balance - feeBal, pot);
    }

    function test_CancelOpenRefundsCreator() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        uint256 homeBal = home.balance;

        vm.prank(home);
        bet.cancelOpenMatch(id);

        assertEq(home.balance - homeBal, STAKE);
        KickOffMatchBet.MatchBet memory m = bet.getMatch(id);
        assertEq(uint8(m.state), uint8(KickOffMatchBet.State.CANCELLED));
    }

    function test_CancelReverts_NotCreator() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        vm.expectRevert(KickOffMatchBet.NotCreator.selector);
        bet.cancelOpenMatch(id);
    }

    function test_CancelReverts_AfterJoin() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);
        vm.prank(home);
        vm.expectRevert(KickOffMatchBet.InvalidState.selector);
        bet.cancelOpenMatch(id);
    }

    function test_ReportReverts_NotOracle() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        vm.prank(home);
        vm.expectRevert(); // AccessControl revert
        bet.reportResult(id, KickOffMatchBet.Winner.HOME);
    }

    function test_ClaimReverts_BeforeReport() public {
        vm.prank(home);
        uint64 id = bet.createMatch{value: STAKE}();
        vm.prank(away);
        bet.joinMatch{value: STAKE}(id);

        vm.expectRevert(KickOffMatchBet.InvalidState.selector);
        bet.claim(id);
    }

    function test_TotalMatchesIncrements() public {
        assertEq(bet.totalMatches(), 0);
        vm.prank(home);
        bet.createMatch{value: STAKE}();
        assertEq(bet.totalMatches(), 1);
        address h2 = address(0xB2);
        vm.deal(h2, 1 ether);
        vm.prank(h2);
        bet.createMatch{value: STAKE}();
        assertEq(bet.totalMatches(), 2);
    }
}
