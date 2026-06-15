// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KickOff Match Bet
/// @notice Multiplayer 1v1 escrow in native ETH. Each player deposits a fixed
///         stake of 0.001 ETH. Winner takes the pot minus a 5% house fee.
///         On a draw the house keeps the entire pot.
/// @dev    Flow:
///           1. Player A calls `createMatch{value: 0.001 ETH}()` — escrows the stake.
///           2. Player B calls `joinMatch{value: 0.001 ETH}(matchId)` — escrows
///              the matching stake. Match becomes LIVE.
///           3. ORACLE_ROLE (WS server / Convex backend) calls
///              `reportResult(matchId, winner)` where winner ∈ {NONE, HOME, AWAY}.
///           4. `claim(matchId)` — anyone can call. Winner takes pot - 5% fee.
///              On a draw the entire pot is forfeited to `feeRecipient`.
///
///         Mirrors the structure of `KickOffBet` (single-player) but with the
///         two-sided join/winner-take-all semantics.
contract KickOffMatchBet is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Winner { NONE, HOME, AWAY }
    enum State  { OPEN, LIVE, REPORTED, SETTLED, CANCELLED }

    struct MatchBet {
        uint64   id;
        address  home;       // creator
        address  away;       // opponent (zero until joined)
        uint256  stake;      // per-side stake in wei
        State    state;
        Winner   winner;
        uint64   createdAt;
        uint64   joinedAt;
        uint64   reportedAt;
    }

    uint256 public constant STAKE_WEI = 0.001 ether;

    address public feeRecipient;
    uint16  public feeBps; // 0..2000 (max 20%)

    uint64  public nextMatchId;

    mapping(uint64 => MatchBet) private _matches;

    event MatchBetCreated  (uint64 indexed id, address indexed home, uint256 stake, uint64 createdAt);
    event MatchBetJoined   (uint64 indexed id, address indexed away, uint64 joinedAt);
    event MatchBetReported (uint64 indexed id, Winner winner, address reporter);
    event MatchBetSettled  (uint64 indexed id, address indexed winner, uint256 payout, uint256 fee);
    event MatchBetCancelled(uint64 indexed id, address by);
    event FeeConfigUpdated (address feeRecipient, uint16 feeBps);

    error InvalidState();
    error InvalidStake();
    error NotCreator();
    error NotParticipant();
    error AlreadyJoined();
    error InvalidWinner();

    constructor(address admin, address feeRecipient_, uint16 feeBps_) {
        require(admin != address(0), "admin=0");
        require(feeBps_ <= 2_000, "fee>20%");

        feeRecipient = feeRecipient_;
        feeBps       = feeBps_;

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

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Lifecycle ─────────────────────────────────────────────────────────
    /// @notice Create a new multiplayer match. Escrows 0.001 ETH from the creator (home).
    function createMatch()
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint64 matchId)
    {
        if (msg.value != STAKE_WEI) revert InvalidStake();

        matchId = ++nextMatchId;
        MatchBet storage m = _matches[matchId];
        m.id        = matchId;
        m.home      = msg.sender;
        m.stake     = msg.value;
        m.state     = State.OPEN;
        m.createdAt = uint64(block.timestamp);

        emit MatchBetCreated(matchId, msg.sender, msg.value, m.createdAt);
    }

    /// @notice Join an OPEN match. Escrows 0.001 ETH from the joiner (away).
    function joinMatch(uint64 matchId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        MatchBet storage m = _matches[matchId];
        if (m.state != State.OPEN) revert InvalidState();
        if (m.home == msg.sender) revert NotParticipant();
        if (m.away != address(0)) revert AlreadyJoined();
        if (msg.value != STAKE_WEI) revert InvalidStake();

        m.away     = msg.sender;
        m.state    = State.LIVE;
        m.joinedAt = uint64(block.timestamp);

        emit MatchBetJoined(matchId, msg.sender, m.joinedAt);
    }

    /// @notice Cancel an OPEN match (no opponent yet) and refund the creator.
    function cancelOpenMatch(uint64 matchId) external nonReentrant {
        MatchBet storage m = _matches[matchId];
        if (m.state != State.OPEN) revert InvalidState();
        if (m.home != msg.sender) revert NotCreator();

        m.state = State.CANCELLED;
        (bool ok,) = payable(m.home).call{value: m.stake}("");
        require(ok, "refund failed");

        emit MatchBetCancelled(matchId, msg.sender);
    }

    /// @notice Oracle reports the winner of a LIVE match.
    function reportResult(uint64 matchId, Winner winner)
        external
        onlyRole(ORACLE_ROLE)
    {
        MatchBet storage m = _matches[matchId];
        if (m.state != State.LIVE) revert InvalidState();

        m.state      = State.REPORTED;
        m.winner     = winner;
        m.reportedAt = uint64(block.timestamp);

        emit MatchBetReported(matchId, winner, msg.sender);
    }

    /// @notice Settle a reported match.
    ///         - Win: winner takes pot - fee (5%); house gets fee.
    ///         - Draw: house keeps the entire pot (both players forfeit).
    /// @dev    Anyone can call this once `reportResult` has been recorded.
    function claim(uint64 matchId) external nonReentrant {
        MatchBet storage m = _matches[matchId];
        if (m.state != State.REPORTED) revert InvalidState();

        m.state = State.SETTLED;

        uint256 pot = m.stake * 2;

        if (m.winner == Winner.NONE) {
            // Draw → house takes the entire pot, both players forfeit.
            if (feeRecipient != address(0)) {
                (bool okF,) = payable(feeRecipient).call{value: pot}("");
                require(okF, "fee transfer failed");
            }
            emit MatchBetSettled(matchId, address(0), 0, pot);
            return;
        }

        // Win → winner takes pot - fee, house gets fee.
        uint256 fee    = (pot * feeBps) / 10_000;
        uint256 payout = pot - fee;
        address winnerAddr = m.winner == Winner.HOME ? m.home : m.away;

        (bool ok,) = payable(winnerAddr).call{value: payout}("");
        require(ok, "payout failed");

        if (fee > 0 && feeRecipient != address(0)) {
            (bool okF,) = payable(feeRecipient).call{value: fee}("");
            require(okF, "fee transfer failed");
        }

        emit MatchBetSettled(matchId, winnerAddr, payout, fee);
    }

    // ─── Views ─────────────────────────────────────────────────────────────
    function getMatch(uint64 matchId) external view returns (MatchBet memory) {
        return _matches[matchId];
    }

    function stakeWei() external pure returns (uint256) {
        return STAKE_WEI;
    }

    function totalMatches() external view returns (uint64) {
        return nextMatchId;
    }
}
