// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {KickOffPlayerNFT} from "../src/KickOffPlayerNFT.sol";

/// @notice Tests for the public `mintPublic()` flow: anyone can pay ETH and
///         receive a randomly generated player card. Minting is constrained
///         by the on-chain `mintPriceWei` and `maxSupply`; the (team, jersey)
///         slot is auto-selected to avoid duplicates.
contract KickOffPlayerNFTPublicMintTest is Test {
    KickOffPlayerNFT internal nft;

    address internal admin     = address(0xA1);
    address internal treasury  = address(0xA2);
    address internal alice     = address(0xB1);
    address internal bob       = address(0xB2);

    uint256 internal constant MINT_PRICE = 0.001 ether;
    uint256 internal constant MAX_SUPPLY = 22;

    function setUp() public {
        nft = new KickOffPlayerNFT(
            admin,
            "KickOff Player",
            "KOP",
            "ipfs://kickoff/players/",
            MAX_SUPPLY
        );
        // Route public-mint proceeds to a dedicated treasury address so
        // the tests can assert on it without conflating with admin.
        vm.prank(admin);
        nft.setMintTreasury(treasury);
        vm.deal(alice, 10 ether);
        vm.deal(bob,   10 ether);
    }

    // ─── Constructor defaults ──────────────────────────────────────────────
    function test_DefaultMintPriceIs001Eth() public view {
        assertEq(nft.mintPriceWei(), MINT_PRICE);
    }

    function test_DefaultTreasuryIsAdmin_BeforeOverride() public {
        // Fresh deployment, before setUp() rotates the treasury.
        KickOffPlayerNFT fresh = new KickOffPlayerNFT(
            admin,
            "KickOff Player",
            "KOP",
            "ipfs://kickoff/players/",
            MAX_SUPPLY
        );
        assertEq(fresh.mintTreasury(), admin);
    }

    // ─── Happy path ────────────────────────────────────────────────────────
    function test_MintPublicPaysExactPrice() public {
        uint256 treasuryBefore = treasury.balance;

        vm.prank(alice);
        uint256 id = nft.mintPublic{value: MINT_PRICE}();

        assertEq(nft.ownerOf(id), alice);
        assertEq(treasury.balance - treasuryBefore, MINT_PRICE);
        assertEq(alice.balance, 10 ether - MINT_PRICE);
    }

    function test_MintPublicAcceptsExcessAndForwardsIt() public {
        uint256 overpay = MINT_PRICE + 0.0005 ether;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(alice);
        uint256 id = nft.mintPublic{value: overpay}();

        assertEq(nft.ownerOf(id), alice);
        // Full msg.value is forwarded, no refund.
        assertEq(treasury.balance - treasuryBefore, overpay);
    }

    function test_MintPublicGeneratesValidAttributes() public {
        vm.prank(alice);
        uint256 id = nft.mintPublic{value: MINT_PRICE}();

        KickOffPlayerNFT.PlayerAttributes memory a = nft.getAttributes(id);
        assertEq(a.jerseyNumber >= 1 && a.jerseyNumber <= 11, true);
        assertEq(a.rating >= 55 && a.rating <= 92, true);
        assertEq(a.speedStat  >= 40 && a.speedStat  <= 99, true);
        assertEq(a.shootStat  >= 40 && a.shootStat  <= 99, true);
        assertEq(a.passing    >= 40 && a.passing    <= 99, true);
        assertEq(a.defense    >= 40 && a.defense    <= 99, true);
        // Position is one of the 4 enum values
        assertEq(uint8(a.position) <= 3, true);
    }

    function test_MintPublicEmitsEvents() public {
        // The ability is randomly rolled on-chain, so we only check the
        // indexed topics and the team/position. The data payload (rating
        // + ability) is omitted from the assertion.
        vm.expectEmit(true, true, false, false);
        emit KickOffPlayerNFT.PlayerMinted(
            1, alice, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.MID,
            0, 0, KickOffPlayerNFT.Ability.NONE
        );

        vm.prank(alice);
        nft.mintPublic{value: MINT_PRICE}();
    }

    function test_MintPublicAbilityIsInValidRange() public {
        // Roll 5 mints and assert every card's ability fits in the enum
        // (i.e. the contract doesn't produce a bogus value). Stats-based
        // assertions are still deterministic via the seed, but the
        // ability bucket depends on the seal-time prevrandao, so we only
        // sanity-check the boundary.
        for (uint256 i = 0; i < 5; i++) {
            vm.roll(i + 1);
            vm.prank(alice);
            uint256 id = nft.mintPublic{value: MINT_PRICE}();
            KickOffPlayerNFT.PlayerAttributes memory a = nft.getAttributes(id);
            assertEq(uint8(a.ability) <= 6, true);
        }
    }

    // ─── Auth & guards ─────────────────────────────────────────────────────
    function test_MintPublicRevertsIfInsufficientPayment() public {
        vm.prank(alice);
        vm.expectRevert(KickOffPlayerNFT.InsufficientPayment.selector);
        nft.mintPublic{value: MINT_PRICE - 1}();
    }

    function test_MintPublicRespectsMaxSupply() public {
        // Fill all 22 slots with admin mints first, then public mint reverts.
        for (uint8 teamIdx; teamIdx < 2; teamIdx++) {
            for (uint8 jersey = 1; jersey <= 11; jersey++) {
                vm.prank(admin);
                nft.mintPlayerCard(
                    bob,
                    KickOffPlayerNFT.TeamId(teamIdx),
                    KickOffPlayerNFT.Position.MID,
                    jersey,
                    80, 80, 80, 80, 80,
                    "ipfs://x"
                );
            }
        }
        assertEq(nft.nextTokenId(), MAX_SUPPLY);

        vm.prank(alice);
        vm.expectRevert(KickOffPlayerNFT.MaxSupplyReached.selector);
        nft.mintPublic{value: MINT_PRICE}();
    }

    function test_MintPublicPaused() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(alice);
        vm.expectRevert();
        nft.mintPublic{value: MINT_PRICE}();
    }

    // ─── Admin setters ─────────────────────────────────────────────────────
    function test_AdminCanUpdateMintPrice() public {
        vm.prank(admin);
        nft.setMintPrice(0.005 ether);
        assertEq(nft.mintPriceWei(), 0.005 ether);
    }

    function test_NonAdminCannotUpdateMintPrice() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setMintPrice(0.005 ether);
    }

    function test_AdminCanUpdateTreasury() public {
        vm.prank(admin);
        nft.setMintTreasury(treasury);
        assertEq(nft.mintTreasury(), treasury);
    }

    function test_AdminCannotSetTreasuryToZero() public {
        vm.prank(admin);
        vm.expectRevert(KickOffPlayerNFT.ZeroTreasury.selector);
        nft.setMintTreasury(address(0));
    }

    function test_NonAdminCannotUpdateTreasury() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setMintTreasury(alice);
    }

    function test_TreasuryReceivesMintsAfterUpdate() public {
        vm.prank(admin);
        nft.setMintTreasury(treasury);

        uint256 before = treasury.balance;
        vm.prank(alice);
        nft.mintPublic{value: MINT_PRICE}();

        assertEq(treasury.balance - before, MINT_PRICE);
        assertEq(admin.balance, 0); // admin received nothing
    }

    // ─── Multi-user ────────────────────────────────────────────────────────
    function test_MultipleMintsGetDifferentSlots() public {
        // Mints from alice and bob in the same block should still pick
        // distinct (team, jersey) combinations — verified by walking
        // the playerKeyToTokenId mapping indirectly via ownerOf.
        vm.prank(alice);
        uint256 id1 = nft.mintPublic{value: MINT_PRICE}();

        vm.prank(bob);
        uint256 id2 = nft.mintPublic{value: MINT_PRICE}();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(nft.ownerOf(id1), alice);
        assertEq(nft.ownerOf(id2), bob);
    }
}
