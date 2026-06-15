// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20}          from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title KickOff Token (KO3D)
/// @notice In-game ERC-20 used for match stakes, rewards, and marketplace
///         activity across KickOff 3D.
/// @dev    Owner-controlled minting with a hard cap, role-based minters for
///         the Match contract and reward engine, pausable in case of incidents.
contract KickOffToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B tokens

    error CapExceeded();
    error MintToZeroAddress();

    /// @param admin The initial admin/owner of the token.
    /// @param premintRecipient Address that will receive the premint supply.
    /// @param premintAmount     Amount of tokens to mint at deployment (18 decimals).
    constructor(
        address admin,
        address premintRecipient,
        uint256 premintAmount
    ) ERC20("KickOff 3D", "KO3D") {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        if (premintAmount > 0) {
            if (premintRecipient == address(0)) revert MintToZeroAddress();
            _mint(premintRecipient, premintAmount);
        }
    }

    /// @notice Mints new tokens. Only callable by MINTER_ROLE.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();
        _mint(to, amount);
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    /// @inheritdoc ERC20
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
