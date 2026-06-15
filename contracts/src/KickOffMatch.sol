// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}     from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}      from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KickOff Match
/// @notice 1v1 football match escrow + result reporting, inspired by
///         `frontend/src/lib/game/engine.ts` (90-minute match, home/away teams,
///         score, possession %, 3 difficulty levels).
/// @dev    Flow:
///           1. Player A calls `createMatch(stake, difficulty)` — escrows `stake` KO3D.
///           2. Player B calls `joinMatch(matchId)` — escrows matching `stake` KO3D.
///              Match is now LIVE (90 min timer starts).
///           3. After the timer elapses, the ORACLE_ROLE (game server) calls
///              `reportResult(matchId, homeScore, awayScore, possessionHomeBps)`.
///           4. Anyone calls `claim(matchId)` — winner takes the pot minus fee,
///              or both get refunded in a draw.
contract KickOffMatch is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Difficulty { AMATEUR, PRO, LEGENDARY }
    enum Team       { HOME, AWAY }
    enum State      { OPEN, LIVE, REPORTED, SETTLED, CANCELLED }

    struct Match {
        uint64    id;             // monotonic id
        address   creator;        // home team
        address   opponent;       // away team (zero until joined)
        uint256   stake;          // KO3D wager per side
        uint64    createdAt;
        uint64    liveAt;         // when opponent joined
        uint64    duration;       // match length (seconds)
        Difficulty difficulty;
        State     state;
        // Result — populated when state == REPORTED
        uint8     homeScore;
        uint8     awayScore;
        uint16    possessionHomeBps;   // 0..10000 (basis points)
    }

    IERC20  public immutable stakeToken;     // KO3D
    address public feeRecipient;
    uint16  public feeBps;                  // 0..2000 (max 20%)

    uint64  public nextMatchId;
    uint64  public defaultDuration = 90 minutes;

    mapping(uint64 => Match) private _matches;

    // creator => open match ids (for off-chain indexing)
    mapping(address => uint64[]) public openMatchesByCreator;
    // opponent => joined match ids
    mapping(address => uint64[]) public liveMatchesByOpponent;

    event MatchCreated (
        uint64 indexed id, address indexed creator, uint256 stake, Difficulty difficulty, uint64 createdAt
    );
    event MatchJoined  (
        uint64 indexed id, address indexed opponent, uint64 liveAt
    );
    event MatchReported(
        uint64 indexed id, uint8 homeScore, uint8 awayScore, uint16 possessionHomeBps, address reporter
    );
    event MatchSettled (
        uint64 indexed id, address winner, uint256 payout, uint256 fee
    );
    event MatchCancelled(uint64 indexed id, address by);
    event FeeConfigUpdated(address feeRecipient, uint16 feeBps);

    error NotCreator();
    error NotParticipant();
    error InvalidState();
    error InvalidStake();
    error InvalidDuration();
    error InvalidBps();
    error NotOracle();
    error MatchNotFinished();
    error NoWinner();
    error TransferFailed();

    constructor(
        address admin,
        address stakeToken_,
        address feeRecipient_,
        uint16  feeBps_
    ) {
        require(admin != address(0),         "admin=0");
        require(stakeToken_ != address(0),   "token=0");
        require(feeBps_ <= 2_000,            "fee>20%");

        stakeToken    = IERC20(stakeToken_);
        feeRecipient  = feeRecipient_;
        feeBps        = feeBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE,  admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // ─── Configuration ─────────────────────────────────────────────────────
    function setFeeConfig(address recipient_, uint16 bps_)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(bps_ <= 2_000, "fee>20%");
        feeRecipient = recipient_;
        feeBps       = bps_;
        emit FeeConfigUpdated(recipient_, bps_);
    }

    function setDefaultDuration(uint64 seconds_) external onlyRole(ADMIN_ROLE) {
        if (seconds_ < 60 seconds || seconds_ > 6 hours) revert InvalidDuration();
        defaultDuration = seconds_;
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Match lifecycle ───────────────────────────────────────────────────
    /// @notice Create a new match and escrow `stake` KO3D from the caller (home).
    function createMatch(uint256 stake, Difficulty difficulty)
        external
        whenNotPaused
        nonReentrant
        returns (uint64 matchId)
    {
        if (stake == 0) revert InvalidStake();
        matchId = ++nextMatchId;

        Match storage m = _matches[matchId];
        m.id         = matchId;
        m.creator    = msg.sender;
        m.stake      = stake;
        m.createdAt  = uint64(block.timestamp);
        m.duration   = defaultDuration;
        m.difficulty = difficulty;
        m.state      = State.OPEN;

        openMatchesByCreator[msg.sender].push(matchId);
        stakeToken.safeTransferFrom(msg.sender, address(this), stake);

        emit MatchCreated(matchId, msg.sender, stake, difficulty, m.createdAt);
    }

    /// @notice Join an open match and escrow a matching stake.
    function joinMatch(uint64 matchId)
        external
        whenNotPaused
        nonReentrant
    {
        Match storage m = _matches[matchId];
        if (m.state != State.OPEN) revert InvalidState();
        if (m.creator == msg.sender) revert NotParticipant();
        if (m.creator == address(0)) revert InvalidState();

        m.opponent = msg.sender;
        m.liveAt   = uint64(block.timestamp);
        m.state    = State.LIVE;

        liveMatchesByOpponent[msg.sender].push(matchId);
        stakeToken.safeTransferFrom(msg.sender, address(this), m.stake);

        emit MatchJoined(matchId, msg.sender, m.liveAt);
    }

    /// @notice Cancel an OPEN match if no opponent has joined yet.
    function cancelOpenMatch(uint64 matchId) external nonReentrant {
        Match storage m = _matches[matchId];
        if (m.state != State.OPEN) revert InvalidState();
        if (m.creator != msg.sender) revert NotCreator();
        m.state = State.CANCELLED;
        stakeToken.safeTransfer(m.creator, m.stake);
        emit MatchCancelled(matchId, msg.sender);
    }

    /// @notice Submit the final result. Only callable by the game-server oracle
    ///         after the match duration has elapsed.
    function reportResult(
        uint64 matchId,
        uint8  homeScore,
        uint8  awayScore,
        uint16 possessionHomeBps
    ) external onlyRole(ORACLE_ROLE) {
        Match storage m = _matches[matchId];
        if (m.state != State.LIVE) revert InvalidState();
        if (block.timestamp < m.liveAt + m.duration) revert MatchNotFinished();
        if (possessionHomeBps > 10_000) revert InvalidBps();

        m.state              = State.REPORTED;
        m.homeScore          = homeScore;
        m.awayScore          = awayScore;
        m.possessionHomeBps  = possessionHomeBps;

        emit MatchReported(matchId, homeScore, awayScore, possessionHomeBps, msg.sender);
    }

    /// @notice Settle a reported match and pay the winner (or refund on draw).
    function claim(uint64 matchId) external nonReentrant {
        Match storage m = _matches[matchId];
        if (m.state != State.REPORTED) revert InvalidState();

        m.state = State.SETTLED;

        uint256 pot   = m.stake * 2;
        uint256 fee   = (pot * feeBps) / 10_000;
        uint256 payout = pot - fee;

        address winner;
        if (m.homeScore > m.awayScore)      winner = m.creator;
        else if (m.awayScore > m.homeScore) winner = m.opponent;
        else                                winner = address(0); // draw

        if (winner == address(0)) {
            // Draw: split the post-fee pot evenly. If the split is uneven
            // (i.e. `payout` is odd in wei), the 1-wei dust goes to the
            // creator so the total payout never exceeds the on-hand pot.
            uint256 refund    = payout / 2;
            uint256 dust      = payout - refund * 2; // 0 or 1
            stakeToken.safeTransfer(m.creator,  refund + dust);
            stakeToken.safeTransfer(m.opponent, refund);
        } else {
            stakeToken.safeTransfer(winner, payout);
        }

        if (fee > 0 && feeRecipient != address(0)) {
            stakeToken.safeTransfer(feeRecipient, fee);
        }

        emit MatchSettled(matchId, winner, payout, fee);
    }

    // ─── Views ─────────────────────────────────────────────────────────────
    function getMatch(uint64 matchId) external view returns (Match memory) {
        return _matches[matchId];
    }

    function openMatchCount() external view returns (uint64) { return nextMatchId; }

    /// @notice Convenience: list currently OPEN match ids (state == OPEN).
    /// @dev    Off-chain indexers should consume `MatchCreated` events; this is
    ///         a fallback for small-scale clients.
    function listOpenMatches(uint64 offset, uint64 limit)
        external
        view
        returns (uint64[] memory ids, address[] memory creators, uint256[] memory stakes)
    {
        uint64 total = nextMatchId;
        if (offset >= total) {
            return (new uint64[](0), new address[](0), new uint256[](0));
        }
        uint64 end = offset + limit;
        if (end > total) end = total;

        // Two-pass: count OPEN matches in window, then populate.
        uint64 n;
        for (uint64 i = offset; i < end; i++) {
            if (_matches[i + 1].state == State.OPEN) n++;
        }

        ids      = new uint64[](n);
        creators = new address[](n);
        stakes   = new uint256[](n);

        uint64 j;
        for (uint64 i = offset; i < end; i++) {
            Match storage m = _matches[i + 1];
            if (m.state != State.OPEN) continue;
            ids[j]      = m.id;
            creators[j] = m.creator;
            stakes[j]   = m.stake;
            j++;
        }
    }
}
