// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721}        from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}       from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  KickOff Market
/// @notice Peer-to-peer marketplace for `KickOffPlayerNFT` cards.
///         Sellers escrow the NFT with the contract; buyers pay in ETH.
///         A protocol fee in basis points is skimmed off the top of every
///         sale and routed to `feeRecipient`.
/// @dev    Lifecycle:
///             listItem(tokenId, price)   — seller escrows NFT, sets ETH price
///             updatePrice(tokenId, newPrice)
///             cancelListing(tokenId)     — seller reclaims NFT
///             buyItem(tokenId)           — buyer pays ETH, receives NFT
///         ETH is not held by the contract beyond a single transaction —
///         seller payouts and protocol fees are settled inside `buyItem`.
contract KickOffMarket is AccessControl, Pausable, ReentrancyGuard {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice The KickOff player NFT contract (immutable after deploy).
    IERC721 public immutable nft;

    /// @notice Protocol fee recipient.
    address public feeRecipient;

    /// @notice Protocol fee in basis points (0..2000 = 0%..20%).
    uint16  public feeBps;

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;       // ETH amount in wei
        uint64  listedAt;
        bool    active;
    }

    // tokenId => listing
    mapping(uint256 => Listing) public listings;

    // running counter of active listings
    uint256 public listingCount;

    // ─── Events ────────────────────────────────────────────────────────────
    event ItemListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint64  listedAt
    );
    event ItemDelisted(uint256 indexed tokenId, address indexed seller);
    event ItemSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 fee,
        uint256 payout
    );
    event PriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    event FeeConfigUpdated(address feeRecipient, uint16 feeBps);

    // ─── Errors ────────────────────────────────────────────────────────────
    error NotSeller();
    error NotListed();
    error AlreadyListed();
    error InvalidPrice();
    error InvalidBps();
    error ZeroAddress();
    error NotNFTOwner();
    error NotApproved();
    error SelfPurchase();
    error InsufficientPayment();

    constructor(
        address admin,
        address nft_,
        address feeRecipient_,
        uint16  feeBps_
    ) {
        if (admin == address(0) || nft_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeBps_ > 2_000) revert InvalidBps();

        nft          = IERC721(nft_);
        feeRecipient = feeRecipient_;
        feeBps       = feeBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ─── Configuration ─────────────────────────────────────────────────────
    function setFeeConfig(address recipient_, uint16 bps_) external onlyRole(ADMIN_ROLE) {
        if (bps_ > 2_000) revert InvalidBps();
        feeRecipient = recipient_;
        feeBps       = bps_;
        emit FeeConfigUpdated(recipient_, bps_);
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Seller actions ────────────────────────────────────────────────────
    /// @notice List an NFT the caller owns. The NFT is transferred into
    ///         contract escrow until sold or cancelled.
    function listItem(uint256 tokenId, uint256 price)
        external
        whenNotPaused
        nonReentrant
    {
        if (price == 0) revert InvalidPrice();
        if (listings[tokenId].active) revert AlreadyListed();

        address owner = nft.ownerOf(tokenId);
        if (owner != msg.sender) revert NotNFTOwner();
        if (
            nft.getApproved(tokenId) != address(this) &&
            !nft.isApprovedForAll(msg.sender, address(this))
        ) revert NotApproved();

        listings[tokenId] = Listing({
            tokenId:  tokenId,
            seller:   msg.sender,
            price:    price,
            listedAt: uint64(block.timestamp),
            active:   true
        });
        unchecked { listingCount++; }

        nft.transferFrom(msg.sender, address(this), tokenId);

        emit ItemListed(tokenId, msg.sender, price, uint64(block.timestamp));
    }

    /// @notice Cancel a live listing and return the NFT to the seller.
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotListed();
        if (l.seller != msg.sender) revert NotSeller();

        address seller = l.seller;
        l.active = false;
        delete listings[tokenId];
        unchecked { listingCount--; }

        nft.transferFrom(address(this), seller, tokenId);

        emit ItemDelisted(tokenId, seller);
    }

    /// @notice Update the price of an active listing.
    function updatePrice(uint256 tokenId, uint256 newPrice) external whenNotPaused {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotListed();
        if (l.seller != msg.sender) revert NotSeller();
        if (newPrice == 0) revert InvalidPrice();

        uint256 oldPrice = l.price;
        l.price = newPrice;
        emit PriceUpdated(tokenId, oldPrice, newPrice);
    }

    // ─── Buyer action ──────────────────────────────────────────────────────
    /// @notice Purchase a listed NFT. Buyer sends ETH with the transaction.
    ///         Pays the seller (minus fee), and transfers the NFT to the buyer.
    /// @dev    Settlement math:
    ///             fee    = price * feeBps / 10_000
    ///             seller gets the remainder.
    function buyItem(uint256 tokenId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotListed();
        if (l.seller == msg.sender) revert SelfPurchase();

        address seller = l.seller;
        address buyer  = msg.sender;
        uint256 price  = l.price;

        if (msg.value < price) revert InsufficientPayment();

        // Deactivate the listing before any external calls (CEI).
        l.active = false;
        delete listings[tokenId];
        unchecked { listingCount--; }

        uint256 fee    = (price * feeBps) / 10_000;
        uint256 payout = price - fee;

        // Pay seller
        if (payout > 0) {
            (bool sent,) = seller.call{value: payout}("");
            require(sent, "ETH transfer failed");
        }

        // Protocol fee
        if (fee > 0 && feeRecipient != address(0)) {
            (bool sent,) = feeRecipient.call{value: fee}("");
            require(sent, "ETH transfer failed");
        }

        // Refund overpayment
        if (msg.value > price) {
            (bool sent,) = buyer.call{value: msg.value - price}("");
            require(sent, "ETH refund failed");
        }

        // Hand the NFT to the buyer.
        nft.transferFrom(address(this), buyer, tokenId);

        emit ItemSold(tokenId, seller, buyer, price, fee, payout);
    }

    // ─── Views ─────────────────────────────────────────────────────────────
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function isListed(uint256 tokenId) external view returns (bool) {
        return listings[tokenId].active;
    }
}
