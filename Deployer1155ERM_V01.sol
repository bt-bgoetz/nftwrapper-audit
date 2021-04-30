// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.0;

import "./Vault1155ERM_V01.sol";

/** Deployer for a heterogeneous, restricted, managed (heterogeneous) vault that targets ERC-1155 conforming contracts. */
contract Deployer1155ERM_V01 {
    /** Fired when a vault is created. */
    event VaultCreated(address vaultAddress);

    /**
     * Deploy a new vault.
     *
     * Features:
     *     - Heterogeneous: Multiple types of ERC-1155 token can be stored.
     *     - Restricted: Role-restricted withdrawers / depositers.
     *     - Managed: Tokens can be added / modified / removed after deployment.
     *
     * @param name The name of the wrapped token.
     * @param symbol The symbol of the wrapped token.
     * @param parityDepositAmount The amount of parity tokens received when depositing each NFT. Use '0' for the default of 10^18.
     * @param parityWithdrawalAmount The amount of parity tokens spent when withdrawing each NFT. Use '0' for the default of 10^18.
     * @param contractAddresses The addresses of the ERC-1155 contracts whose tokens will be stored in this vault.
     * @param restrictDeposits Restricts deposits to those wallets that have been previously authorized (enables whitelist).
     * @param restrictWithdrawals Restricts withdrawals to those wallets that have been previously authorized (enables whitelist).
     *
     * @return The address of the newly created vault.
     */
    function deploy(
        string memory name,
        string memory symbol,
        uint256 parityDepositAmount,
        uint256 parityWithdrawalAmount,
        address[] calldata contractAddresses,
        bool restrictDeposits,
        bool restrictWithdrawals
    ) external returns (address) {
        // We don't validate the addresses to see if they are ERC721 contracts, because A) we want to be able to interact with
        // partially/non-conforming contracts (e.g., USDT), and B) because any interactions with non-compatible / non-contract
        // addresses will revert.

        // Create the vault
        Vault1155ERM_V01 vault = new Vault1155ERM_V01(
            name,
            symbol,
            parityDepositAmount,
            parityWithdrawalAmount,
            contractAddresses,
            msg.sender,
            restrictDeposits,
            restrictWithdrawals
        );
        address vaultAddress = address(vault);

        // Hello world!
        emit VaultCreated(vaultAddress);

        return vaultAddress;
    }
}
