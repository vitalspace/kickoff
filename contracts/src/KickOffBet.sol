// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title KickOff Bet
/// @notice Single-player vs CPU betting: deposit 0.001 ETH, if you win you
///         get your stake back, if you lose the house keeps it.
/// @dev    Flow:
///           1. Player calls `deposit{value: STAKE}()` — escrows ETH.
///           2. Player plays a single-player match against the CPU.
///           3. ORACLE_ROLE (Convex backend) calls `reportResult(betId, playerWon)`.
///           4. Player calls `claim(betId)` — receives payout if they won.
///              On a draw, the stake is refunded.
contract KickOffBet is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Difficulty { AMATEUR, PRO, LEGENDARY }
    enum State      { PENDING, LIVE, REPORTED, SETTLED, CANCELLED }

    struct Bet {
        uint64    id;
        address   player;
        uint256   stake;
        Difficulty difficulty;
        State     state;
        uint64    createdAt;
        uint64    reportedAt;
        bool      playerWon;
        bool      isDraw;
    }

    uint256 public constant STAKE_WEI = 0.001 ether;

    address public feeRecipient;
    uint16  public feeBps; // 0..2000 (max 20%)

    uint64  public nextBetId;

    mapping(uint64 => Bet) private _bets;

    event BetCreated(uint64 indexed id, address indexed player, uint256 stake, Difficulty difficulty, uint64 createdAt);
    event BetReported(uint64 indexed id, bool playerWon, bool isDraw, address reporter);
    event BetSettled(uint64 indexed id, address indexed player, uint256 payout, uint256 fee, bool won);
    event BetCancelled(uint64 indexed id, address by);
    event FeeConfigUpdated(address feeRecipient, uint16 feeBps);

    error InvalidState();
    error NotPlayer();
    error NotOracle();
    error BetNotFinished();
    error NoPayout();
    error TransferFailed();
    error InvalidStake();
    error InvalidBps();

    constructor(address admin, address feeRecipient_, uint16 feeBps_) {
        require(admin != address(0), "admin=0");
        require(feeBps_ <= 2_000, "fee>20%");

        feeRecipient = feeRecipient_;
        feeBps       = feeBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
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

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── Bet lifecycle ─────────────────────────────────────────────────────
    /// @notice Deposit 0.001 ETH to start a single-player bet.
    function deposit(Difficulty difficulty)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint64 betId)
    {
        if (msg.value != STAKE_WEI) revert InvalidStake();

        betId = ++nextBetId;
        Bet storage b = _bets[betId];
        b.id         = betId;
        b.player     = msg.sender;
        b.stake      = msg.value;
        b.difficulty = difficulty;
        b.createdAt  = uint64(block.timestamp);
        b.state      = State.LIVE;

        emit BetCreated(betId, msg.sender, msg.value, difficulty, b.createdAt);
    }

    /// @notice Cancel a pending bet (only before oracle reports). Refunds stake.
    function cancelBet(uint64 betId) external nonReentrant {
        Bet storage b = _bets[betId];
        if (b.state != State.LIVE) revert InvalidState();
        if (b.player != msg.sender) revert NotPlayer();

        b.state = State.CANCELLED;
        (bool ok,) = payable(b.player).call{value: b.stake}("");
        require(ok, "refund failed");

        emit BetCancelled(betId, msg.sender);
    }

    /// @notice Oracle reports whether the player won or lost.
    function reportResult(uint64 betId, bool playerWon, bool isDraw)
        external
        onlyRole(ORACLE_ROLE)
    {
        Bet storage b = _bets[betId];
        if (b.state != State.LIVE) revert InvalidState();

        b.state      = State.REPORTED;
        b.playerWon  = playerWon;
        b.isDraw     = isDraw;
        b.reportedAt = uint64(block.timestamp);

        emit BetReported(betId, playerWon, isDraw, msg.sender);
    }

    /// @notice Claim payout after result is reported.
    function claim(uint64 betId) external nonReentrant {
        Bet storage b = _bets[betId];
        if (b.state != State.REPORTED) revert InvalidState();

        b.state = State.SETTLED;

        uint256 payout;
        uint256 fee = 0;

        if (b.playerWon) {
            // Player wins: gets full stake back
            payout = b.stake;
        } else {
            // Player loses or draw: house keeps everything (no payout)
            payout = 0;
            fee = b.stake; // entire stake goes to feeRecipient as house revenue
        }

        if (payout > 0) {
            (bool ok,) = payable(b.player).call{value: payout}("");
            require(ok, "payout failed");
        }

        if (fee > 0 && feeRecipient != address(0)) {
            (bool ok,) = payable(feeRecipient).call{value: fee}("");
            require(ok, "fee transfer failed");
        }

        emit BetSettled(betId, b.player, payout, fee, b.playerWon);
    }

    // ─── Views ─────────────────────────────────────────────────────────────
    function getBet(uint64 betId) external view returns (Bet memory) {
        return _bets[betId];
    }

    function stakeWei() external pure returns (uint256) {
        return STAKE_WEI;
    }

    function totalBets() external view returns (uint64) {
        return nextBetId;
    }
}
