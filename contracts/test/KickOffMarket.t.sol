// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}             from "forge-std/Test.sol";
import {KickOffPlayerNFT} from "../src/KickOffPlayerNFT.sol";
import {KickOffMarket}    from "../src/KickOffMarket.sol";

/// @notice End-to-end tests for the marketplace: list, update price,
///         cancel, buy, fee math, authorisation, and edge cases.
contract KickOffMarketTest is Test {
    KickOffPlayerNFT internal nft;
    KickOffMarket    internal market;

    address internal admin     = address(0xA1);
    address internal feeVault  = address(0xE1);
    address internal seller    = address(0xB1);
    address internal buyer     = address(0xC1);

    uint256 internal constant LIST_PRICE = 500 ether;
    uint16  internal constant FEE_BPS    = 250;   // 2.5%

    function setUp() public {
        nft = new KickOffPlayerNFT(
            admin, "KickOff Player", "KOP", "ipfs://kickoff/players/", 100
        );
        market = new KickOffMarket(
            admin, address(nft), feeVault, FEE_BPS
        );

        // Mint a single card to the seller so we can list it.
        vm.startPrank(admin);
        nft.mintPlayerCard(
            seller, KickOffPlayerNFT.TeamId.HOME, KickOffPlayerNFT.Position.FWD,
            9, 88, 92, 80, 75, 40, "ipfs://kickoff/players/9.json"
        );
        vm.stopPrank();

        // Fund the buyer with ETH.
        vm.deal(buyer, 10_000 ether);

        // Seller approves the market to move their NFT.
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
    }

    // ─── Happy path ────────────────────────────────────────────────────────
    function test_ListItemEscrowsNFT() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        assertEq(market.listingCount(), 1);
        assertTrue(market.isListed(1));
        assertEq(nft.ownerOf(1), address(market));

        KickOffMarket.Listing memory l = market.getListing(1);
        assertEq(l.seller, seller);
        assertEq(l.price,  LIST_PRICE);
        assertTrue(l.active);
    }

    function test_BuyItemTransfersNFTAndPaysSeller() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        uint256 sellerBefore = seller.balance;
        uint256 feeBefore    = feeVault.balance;

        vm.prank(buyer);
        market.buyItem{value: LIST_PRICE}(1);

        // NFT landed in buyer's wallet
        assertEq(nft.ownerOf(1), buyer);
        // Listing cleared
        assertFalse(market.isListed(1));
        assertEq(market.listingCount(), 0);

        // Math: fee    = 500 * 250 / 10000 = 12.5
        //       payout = 500 - 12.5       = 487.5
        uint256 expectedFee    = (LIST_PRICE * FEE_BPS) / 10_000;
        uint256 expectedPayout = LIST_PRICE - expectedFee;

        assertEq(seller.balance - sellerBefore, expectedPayout);
        assertEq(feeVault.balance - feeBefore,  expectedFee);
    }

    function test_BuyItemRefundsOverpayment() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        uint256 buyerBefore = buyer.balance;
        uint256 overpay     = LIST_PRICE + 100 ether;

        vm.prank(buyer);
        market.buyItem{value: overpay}(1);

        // Buyer paid LIST_PRICE and got refund of 100 ether
        assertEq(buyerBefore - buyer.balance, LIST_PRICE);
        assertEq(nft.ownerOf(1), buyer);
    }

    function test_UpdatePriceBySeller() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(seller);
        market.updatePrice(1, 750 ether);

        assertEq(market.getListing(1).price, 750 ether);
    }

    function test_CancelListingReturnsNFT() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(seller);
        market.cancelListing(1);

        assertFalse(market.isListed(1));
        assertEq(nft.ownerOf(1), seller);
    }

    // ─── Authorisation ─────────────────────────────────────────────────────
    function test_NonSellerCannotCancel() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(buyer);
        vm.expectRevert(KickOffMarket.NotSeller.selector);
        market.cancelListing(1);
    }

    function test_NonSellerCannotUpdatePrice() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(buyer);
        vm.expectRevert(KickOffMarket.NotSeller.selector);
        market.updatePrice(1, 1 ether);
    }

    function test_NonOwnerCannotList() public {
        vm.prank(admin);
        nft.mintPlayerCard(
            admin, KickOffPlayerNFT.TeamId.AWAY, KickOffPlayerNFT.Position.GK,
            1, 70, 50, 40, 50, 60, "ipfs://kickoff/players/1.json"
        );

        vm.prank(seller);
        vm.expectRevert(KickOffMarket.NotNFTOwner.selector);
        market.listItem(2, 100 ether);
    }

    function test_SellerWithoutApprovalCannotList() public {
        address newSeller = address(0xF1);
        vm.prank(admin);
        nft.mintPlayerCard(
            newSeller, KickOffPlayerNFT.TeamId.AWAY, KickOffPlayerNFT.Position.DEF,
            2, 75, 60, 60, 60, 80, "ipfs://kickoff/players/2.json"
        );

        vm.prank(newSeller);
        vm.expectRevert(KickOffMarket.NotApproved.selector);
        market.listItem(2, 100 ether);
    }

    function test_SellerCannotBuyOwnListing() public {
        vm.deal(seller, 10_000 ether);
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(seller);
        vm.expectRevert(KickOffMarket.SelfPurchase.selector);
        market.buyItem{value: LIST_PRICE}(1);
    }

    function test_BuyerMustSendEnoughETH() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(buyer);
        vm.expectRevert(KickOffMarket.InsufficientPayment.selector);
        market.buyItem{value: LIST_PRICE - 1}(1);
    }

    // ─── Edge cases ────────────────────────────────────────────────────────
    function test_CannotListTwice() public {
        vm.startPrank(seller);
        market.listItem(1, LIST_PRICE);
        vm.expectRevert(KickOffMarket.AlreadyListed.selector);
        market.listItem(1, LIST_PRICE + 1);
        vm.stopPrank();
    }

    function test_CannotBuyUnlisted() public {
        vm.prank(buyer);
        vm.expectRevert(KickOffMarket.NotListed.selector);
        market.buyItem{value: LIST_PRICE}(1);
    }

    function test_CannotCancelUnlisted() public {
        vm.prank(seller);
        vm.expectRevert(KickOffMarket.NotListed.selector);
        market.cancelListing(1);
    }

    function test_CannotListWithZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(KickOffMarket.InvalidPrice.selector);
        market.listItem(1, 0);
    }

    function test_CannotUpdatePriceToZero() public {
        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(seller);
        vm.expectRevert(KickOffMarket.InvalidPrice.selector);
        market.updatePrice(1, 0);
    }

    function test_ConstructorRejectsInvalidBps() public {
        vm.expectRevert(KickOffMarket.InvalidBps.selector);
        new KickOffMarket(
            admin, address(nft), feeVault, 2_001
        );
    }

    function test_AdminCanUpdateFeeConfig() public {
        vm.prank(admin);
        market.setFeeConfig(admin, 500); // 5%
        assertEq(market.feeBps(), 500);
        assertEq(market.feeRecipient(), admin);
    }

    function test_NonAdminCannotUpdateFeeConfig() public {
        vm.prank(seller);
        vm.expectRevert();
        market.setFeeConfig(seller, 500);
    }

    function test_PauseBlocksListingsAndBuys() public {
        vm.prank(admin);
        market.pause();

        vm.prank(seller);
        vm.expectRevert();
        market.listItem(1, LIST_PRICE);

        // Unpause and verify it works again
        vm.prank(admin);
        market.unpause();

        vm.prank(seller);
        market.listItem(1, LIST_PRICE);

        vm.prank(admin);
        market.pause();
        vm.prank(buyer);
        vm.expectRevert();
        market.buyItem{value: LIST_PRICE}(1);
    }
}
