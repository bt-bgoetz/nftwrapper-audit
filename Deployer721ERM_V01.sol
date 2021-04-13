// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import "./Vault721ERM_V01.sol";

/** Deployer for a heterogeneous, restricted, managed (heterogeneous) vault that targets ERC-721 conforming contracts. */
contract Deployer721ERM_V01 {
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
     * @param baseWrappedAmount The price (in parity tokens) of an individual ERC-721 token. Use '0' for the default of 10^18.
     * @param contractAddresses The addresses of the ERC-721 contracts whose tokens will be stored in this vault.
     * @param restrictDeposits Restricts deposits to those wallets that have been previously authorized (enables whitelist).
     * @param restrictWithdrawals Restricts withdrawals to those wallets that have been previously authorized (enables whitelist).
     *
     * @return The address of the newly created vault.
     */
    function deploy(
        string memory name,
        string memory symbol,
        uint256 baseWrappedAmount,
        address[] calldata contractAddresses,
        bool restrictDeposits,
        bool restrictWithdrawals
    ) external returns (address) {
        // We don't validate the addresses to see if they are ERC721 contracts, because A) we want to be able to interact with
        // partially/non-conforming contracts (e.g., USDT), and B) because any interactions with non-compatible / non-contract
        // addresses will revert.

        // Create the vault
        Vault721ERM_V01 vault = new Vault721ERM_V01(
            name,
            symbol,
            baseWrappedAmount,
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
