// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721}            from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage}  from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl}     from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}          from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title KickOff Player NFT
/// @notice ERC-721 representing a football player card usable in KickOff 3D.
/// @dev    Mirrors the engine model in `frontend/src/lib/game/engine.ts`:
///         two teams ("home" / "away") each fielding 8 players + 1 GK,
///         organised by position (GK / DEF / MID / FWD) with a numeric rating.
contract KickOffPlayerNFT is ERC721, ERC721URIStorage, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    enum TeamId   { HOME, AWAY }
    enum Position { GK, DEF, MID, FWD }

    /// @notice Passive perks auto-assigned by `mintPublic`. Index 0 is the
    ///         "no ability" bucket (~64% of mints). The other six drop at
    ///         ~6% each.
    enum Ability { NONE, SWIFT, POWER_SHOT, WALL, MAESTRO, CLUTCH, RUSH }

    struct PlayerAttributes {
        TeamId   team;
        Position position;
        uint8    jerseyNumber;   // 1..11
        uint8    rating;         // 40..99
        uint8    speedStat;      // 1..99
        uint8    shootStat;      // 1..99
        uint8    passing;        // 1..99
        uint8    defense;        // 1..99
        Ability  ability;        // passive perk, see `Ability` enum
    }

    uint256 public nextTokenId;
    uint256 public immutable maxSupply;

    string  public baseURI;

    // ─── Public sale config ────────────────────────────────────────────────
    /// @notice ETH cost (in wei) to call `mintPublic`. Set by admin.
    uint256 public mintPriceWei;

    /// @notice Address that receives ETH from `mintPublic`. Defaults to
    ///         the contract admin and can be rotated by admin.
    address public mintTreasury;

    // tokenId => attributes
    mapping(uint256 => PlayerAttributes) public attributes;

    // (team, jerseyNumber) => tokenId, to avoid duplicate cards
    mapping(bytes32 => uint256) public playerKeyToTokenId;

    /// @notice Returns a single player's attributes as a struct (the public
    ///         auto-getter returns a tuple which is awkward to consume off-chain).
    function getAttributes(uint256 tokenId) external view returns (PlayerAttributes memory) {
        return attributes[tokenId];
    }

    event PlayerMinted(
        uint256 indexed tokenId,
        address indexed to,
        TeamId   team,
        Position position,
        uint8    jerseyNumber,
        uint8    rating,
        Ability  ability
    );
    event BaseURISet(string baseURI);
    event PublicMint(
        uint256 indexed tokenId,
        address indexed to,
        uint256 pricePaid,
        uint256 excessRefunded
    );
    event MintPriceUpdated(uint256 priceWei);
    event MintTreasuryUpdated(address treasury);

    error MaxSupplyReached();
    error PlayerAlreadyMinted();
    error InvalidJerseyNumber();
    error InvalidRating();
    error InsufficientPayment();
    error NoSlotsAvailable();
    error TransferFailed();
    error ZeroTreasury();

    constructor(
        address admin,
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxSupply_
    ) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        baseURI        = baseURI_;
        maxSupply      = maxSupply_;
        mintTreasury   = admin;
        mintPriceWei   = 0.001 ether; // default: 0.001 ETH per public mint
    }

    /// @notice Mints a new player card. Restricted to MINTER_ROLE (game server / owner).
    function mintPlayerCard(
        address to,
        TeamId   team,
        Position position,
        uint8    jerseyNumber,
        uint8    rating,
        uint8    speedStat,
        uint8    shootStat,
        uint8    passing,
        uint8    defense,
        string calldata tokenURI_
    ) public onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        if (nextTokenId >= maxSupply) revert MaxSupplyReached();
        if (jerseyNumber < 1 || jerseyNumber > 11) revert InvalidJerseyNumber();
        if (rating < 40 || rating > 99)             revert InvalidRating();

        bytes32 key = keccak256(abi.encodePacked(team, jerseyNumber));
        if (playerKeyToTokenId[key] != 0) revert PlayerAlreadyMinted();

        tokenId = ++nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        attributes[tokenId] = PlayerAttributes({
            team:         team,
            position:     position,
            jerseyNumber: jerseyNumber,
            rating:       rating,
            speedStat:    speedStat,
            shootStat:    shootStat,
            passing:      passing,
            defense:      defense,
            ability:      Ability.NONE
        });
        playerKeyToTokenId[key] = tokenId;

        emit PlayerMinted(tokenId, to, team, position, jerseyNumber, rating, Ability.NONE);
    }

    /// @notice Batch-mint helper for the initial squad (home + away).
    function mintBatch(
        address to,
        PlayerAttributes[] calldata attrs,
        string[] calldata tokenURIs
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(attrs.length == tokenURIs.length, "length mismatch");
        for (uint256 i = 0; i < attrs.length; i++) {
            mintPlayerCard(
                to,
                attrs[i].team,
                attrs[i].position,
                attrs[i].jerseyNumber,
                attrs[i].rating,
                attrs[i].speedStat,
                attrs[i].shootStat,
                attrs[i].passing,
                attrs[i].defense,
                tokenURIs[i]
            );
        }
    }

    // ─── Admin ──────────────────────────────────────────────────────────────
    function setBaseURI(string calldata baseURI_) external onlyRole(ADMIN_ROLE) {
        baseURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    function setMintPrice(uint256 priceWei) external onlyRole(ADMIN_ROLE) {
        mintPriceWei = priceWei;
        emit MintPriceUpdated(priceWei);
    }

    function setMintTreasury(address treasury_) external onlyRole(ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroTreasury();
        mintTreasury = treasury_;
        emit MintTreasuryUpdated(treasury_);
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Public sale ────────────────────────────────────────────────────────
    /// @notice Public mint: the caller pays `mintPriceWei` ETH and receives
    ///         a randomly generated player card. Card stats are derived
    ///         from `block.prevrandao`, `msg.sender`, and the next token
    ///         id; the (team, jerseyNumber) slot is searched to avoid
    ///         collisions with previously minted cards.
    /// @dev    Any excess ETH over `mintPriceWei` is forwarded to the
    ///         treasury along with the price (no refunds — keeps the
    ///         function non-trivial gas-wise but simpler). If the caller
    ///         wants exact pricing, they should pass `mintPriceWei`.
    function mintPublic() external payable whenNotPaused returns (uint256 tokenId) {
        if (msg.value < mintPriceWei) revert InsufficientPayment();
        if (nextTokenId >= maxSupply) revert MaxSupplyReached();

        uint256 seed = uint256(keccak256(abi.encode(
            block.prevrandao,
            block.timestamp,
            msg.sender,
            nextTokenId
        )));
        RandomCard memory r = _rollRandomCard(seed);

        tokenId = ++nextTokenId;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, "");

        attributes[tokenId] = PlayerAttributes({
            team:         r.team,
            position:     r.position,
            jerseyNumber: r.jersey,
            rating:       r.rating,
            speedStat:    r.speed,
            shootStat:    r.shoot,
            passing:      r.passing,
            defense:      r.defense,
            ability:      r.ability
        });
        playerKeyToTokenId[r.slotKey] = tokenId;

        if (mintTreasury != address(0) && msg.value > 0) {
            (bool ok, ) = mintTreasury.call{value: msg.value}("");
            if (!ok) revert TransferFailed();
        }

        emit PlayerMinted(
            tokenId, msg.sender, r.team, r.position, r.jersey, r.rating, r.ability
        );
        emit PublicMint(tokenId, msg.sender, mintPriceWei, msg.value - mintPriceWei);
    }

    /// @dev Bundles the random outputs so the parent function stays
    ///      within the EVM stack-depth limit (16 slots).
    struct RandomCard {
        TeamId   team;
        Position position;
        Ability  ability;
        bytes32  slotKey;  // keccak256(abi.encodePacked(team, jersey))
        uint8    jersey;
        uint8    rating;
        uint8    speed;
        uint8    shoot;
        uint8    passing;
        uint8    defense;
    }

    function _rollRandomCard(uint256 seed) internal view returns (RandomCard memory r) {
        // (team, jersey) slot. 22 combinations; bounded linear scan.
        uint8 teamIdx  = uint8(seed % 2);
        uint8 jersey   = uint8((seed >> 8) % 11) + 1;
        for (uint256 attempts; attempts < 22; attempts++) {
            bytes32 key = keccak256(abi.encodePacked(TeamId(teamIdx), jersey));
            if (playerKeyToTokenId[key] == 0) {
                r.slotKey = key;
                r.team    = TeamId(teamIdx);
                r.jersey  = jersey;
                break;
            }
            jersey  = (jersey % 11) + 1;
            teamIdx = (teamIdx + 1) % 2;
        }
        if (r.slotKey == bytes32(0)) revert NoSlotsAvailable();

        r.rating  = uint8(55 + ((seed >> 16) % 38));
        r.speed   = uint8(40 + ((seed >> 24) % 60));
        r.shoot   = uint8(40 + ((seed >> 32) % 60));
        r.passing = uint8(40 + ((seed >> 40) % 60));
        r.defense = uint8(40 + ((seed >> 48) % 60));
        r.position = Position(uint8(seed >> 56) % 4);

        // 6 ability buckets of 6/100 each (~36% to drop one), else NONE.
        uint256 roll = (seed >> 64) % 100;
        if      (roll <  6) r.ability = Ability.SWIFT;
        else if (roll < 12) r.ability = Ability.POWER_SHOT;
        else if (roll < 18) r.ability = Ability.WALL;
        else if (roll < 24) r.ability = Ability.MAESTRO;
        else if (roll < 30) r.ability = Ability.CLUTCH;
        else if (roll < 36) r.ability = Ability.RUSH;
        else                r.ability = Ability.NONE;
    }

    /// @inheritdoc ERC721
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /// @inheritdoc ERC721
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /// @inheritdoc ERC721URIStorage
    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /// @inheritdoc ERC721
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Allow contract to receive ETH for treasury purposes.
    receive() external payable {}
}
