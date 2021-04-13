// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/** A heterogeneous, restricted, managed (heterogeneous) vault that targets ERC-1155 conforming contracts. */
contract Vault1155ERM_V01 is ERC20, IERC1155Receiver {
    /** @dev The address of the user that is currently depositing tokens. This will not be persisted, to reduce gas usage. */
    address private _depositor;

    /** @dev  The amount of mintable / burnable ERC-20 tokens for each action. */
    uint256 private _baseWrappedAmount;

    /** @dev The whitelist of contracts that can be vaulted. */
    address[] private _coreAddresses;
    /** @dev How many tokens are currently in the vault for a given contract. */
    uint256[] private _contractTokenCounts;
    /** @dev The index of a given contract, 1-based. We use 0 for the existance check. */
    mapping(address => uint256) private _coreAddressIndices;

    // The tokens stored in the vault and their contracts' address.
    address[] private _tokenContracts;
    uint256[] private _tokenIds;
    uint256[] private _tokenCounts;

    /**
     * @dev The mapping of token ids to their index, 1-based.
     * We merge together the index of the contract and the token id (`CONTRACT_INDEX_OFFSET`), which lets us support a larger vault.
     * Both the contract index the token index are 1-based, so that 0 can be used as an existance check.
     */
    mapping(uint256 => uint256) private _indices;
    uint256 private constant CONTRACT_INDEX_OFFSET = 200; // See `deposit()`. Supports 10^60 tokens for each of 10^16 contracts.

    // There are three role levels. We separate depositor and withdrawer as compared to "contributor" so we can whitelist other
    // vaults for parity swaps. Likewise, we also have global whitelists on depositor / withdrawer roles. We use a single mapping on
    // addresses along with bitmasks to reduce storage requirements. We also keep a count of the total number of admin addresses to
    // prevent the vault from being completely locked out.
    //
    //   Admin: Can add / remove any role for any address
    //   Depositor: Can deposit tokens
    //   Withdrawer: Can withdraw tokens
    //
    // The roles.
    uint256 private constant R_CAN_DEPOSIT  = 0x1; // 001
    uint256 private constant R_CAN_WITHDRAW = 0x2; // 010
    uint256 private constant R_IS_ADMIN     = 0x4; // 100
    mapping(address => uint256) _addressRoles;

    // We can choose to restrict deposits / withdrawals to only those addresses with the appropriate role (`_addressRoles`). We pack
    // this into one value to save on storage manipulation costs.
    uint256 private constant WL_RESTRICT_NONE        = 0x0; // 00
    uint256 private constant WL_RESTRICT_DEPOSITS    = 0x1; // 01
    uint256 private constant WL_RESTRICT_WITHDRAWALS = 0x2; // 10
    uint256 private constant WL_RESTRICT_ALL         = 0x3; // 11
    uint256 _roleRestrictions;

    // We include this here instead of the `nonReentrant` modifier to reduce gas costs. See OpenZeppelin - ReentrancyGuard for more.
    uint256 private constant S_NOT_ENTERED = 1;
    uint256 private constant S_ENTERED = 2;
    uint256 private constant S_FROZEN = 2;
    uint256 private _status;

    /**
     * @param name The name of the wrapped token.
     * @param symbol The symbol of the wrapped token.
     * @param baseWrappedAmount The price (in parity tokens) of an individual ERC-1155 token. Use '0' for the default of 10^18.
     * @param contractAddresses The addresses of the ERC-1155 contracts whose tokens will be stored in this vault.
     */
	constructor (
        string memory name,
        string memory symbol,
        uint256 baseWrappedAmount,
        address[] memory contractAddresses,
        address owner,
        bool restrictDeposits,
        bool restrictWithdrawals
    ) ERC20(name, symbol) public {
        // Set the token ratio, defaulting to 10^18.
        if (baseWrappedAmount == 0) {
            _baseWrappedAmount = uint256(10) ** decimals();
        } else {
            _baseWrappedAmount = baseWrappedAmount;
        }

        // Add the first set of contracts.
        uint256 contractsCount = contractAddresses.length;
        address contractAddress;
        for (uint256 i; i < contractsCount; i ++) {
            contractAddress = contractAddresses[i];
            _coreAddresses.push(contractAddress);
            _contractTokenCounts.push(0);
            _coreAddressIndices[contractAddress] = i + 1;
        }

        // Set up the caller with all permissions.
        _addressRoles[owner] = 0x7; // R_IS_ADMIN | R_CAN_WITHDRAW | R_CAN_DEPOSIT;

        // Set the global allows.
        if (restrictDeposits && restrictWithdrawals) {
            _roleRestrictions = WL_RESTRICT_ALL;
        } else if (restrictDeposits) {
            _roleRestrictions = WL_RESTRICT_DEPOSITS;
        } else if (restrictWithdrawals) {
            _roleRestrictions = WL_RESTRICT_WITHDRAWALS;
        } else {
            _roleRestrictions = WL_RESTRICT_NONE;
        }

        // Set us up for reentrancy guarding.
        _status = S_NOT_ENTERED;
    }

    /// Events ///

    /** Fired when token are deposited. */
    event TokensDeposited(address tokenContract, uint256 tokenId, uint256 tokenCount);

    /** Fired when token are withdrawn. */
    event TokensWithdrawn(address tokenContract, uint256 tokenId, uint256 tokenCount);

    /** Fired when a user's role has changed. */
    event RoleChanged(address user, uint256 newRole);

    /** Fired when a contract has been added. */
    event ContractAddressAdded(address contractAddress);

    /** Fired when a contract has been migrated. */
    event ContractAddressChanged(address oldAddress, address newAddress);

    /** Fired when a contract has been removed. */
    event ContractAddressRemoved(address contractAddress);

    /// Token Details ///

    /** Returns the details of a specific contract. */
    function contractAt(uint256 index) external view returns (uint256[3] memory) {
        address contractAddress = _coreAddresses[index];
        return [
            uint256(contractAddress),
            _contractTokenCounts[index],
            _coreAddressIndices[contractAddress]
        ];
    }

    /**
     * Check if a token can be withdrawn by its id and its deposit counter. Use `getDepositCounter()` to see the maximum value for
     * `depositCounter`, if it is unknown. Use `getCurrentDepositCounts()` to see how many of the token are currently deposited.
     */
    function getTokenIndex(address tokenContract, uint256 tokenId) external view returns (uint256) {
        uint256 index = _indices[(_coreAddressIndices[tokenContract] << CONTRACT_INDEX_OFFSET) | tokenId];
        require(index > 0, "Token not in vault");

        return index - 1;
    }

    /**
     * Returns the total number of whitelisted contracts and vaulted NFTs. There may be any number of removed contracts (set to the
     * zero address) at the end of the contract addresses array. Use `contractAt()` to verify the contract details.
     */
    function size() external view returns (uint256[2] memory) {
        return [
            _coreAddresses.length,
            _tokenIds.length
        ];
    }

    /** Returns the details of a specific token. */
    function tokenAt(uint256 index) external view returns (uint256[3] memory) {
        return [
            uint256(_tokenContracts[index]),
            _tokenIds[index],
            _tokenCounts[index]
        ];
    }

    /// Role Manipulation ///

    /** Change if we are restricting interaction according to the roles by type. */
    function changeRoleRestrictions(bool restrictDeposits, bool restrictWithdrawals) external {
        require(
               (_status == S_NOT_ENTERED || _status == S_FROZEN)      // Reentrancy guard.
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN // Not admin.
        , "Not authorized");

        if (restrictDeposits && restrictWithdrawals) {
            _roleRestrictions = WL_RESTRICT_ALL;
        } else if (restrictDeposits) {
            _roleRestrictions = WL_RESTRICT_DEPOSITS;
        } else if (restrictWithdrawals) {
            _roleRestrictions = WL_RESTRICT_WITHDRAWALS;
        } else {
            _roleRestrictions = WL_RESTRICT_NONE;
        }
    }

    /** Returns the roles a given user has. */
    function getRoles(address user) external view returns (uint256) {
        return _addressRoles[user];
    }

    /** Returns the current role restrictions the vault has. */
    function getRoleRestrictions() external view returns (uint256) {
        return _roleRestrictions;
    }

    /**
     * Set the role flags for a given set of users. It's possible, but not recommended, to remove all admins. This will lock out all
     * future role and contract management. Depositor and withdrawal flags will have no affect unless the vault is using this
     * whitelist to restrict those actions (see: `changeRoleRestrictions()`). It's possible, but not recommended, to set strip admins
     * of deposit/withdrawal permissions.
     */
    function setRoles(address[] calldata users, bool enableRoles, bool adminFlag, bool depositorFlag, bool withdrawerFlag) external {
        require(
               (_status == S_NOT_ENTERED || _status == S_FROZEN)      // Reentrancy guard.
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN // Not admin.
        , "Not authorized");

        // Build up the roles flag assuming that we'll be setting the roles. We'll negate this if we're clearing it.
        uint256 rolesFlag;
        if (depositorFlag) {
            rolesFlag |= R_CAN_DEPOSIT;
        }
        if (withdrawerFlag) {
            rolesFlag |= R_CAN_WITHDRAW;
        }
        if (adminFlag) {
            rolesFlag |= R_IS_ADMIN;
        }

        address user;
        uint256 count = users.length;
        uint256 i;
        for (; i < count; i ++) {
            user = users[i];
            if (enableRoles) {
                _addressRoles[user] |= rolesFlag;
            } else {
                _addressRoles[user] &= ~rolesFlag;
            }

            // Hello world!
            emit RoleChanged(user, _addressRoles[user]);
        }
    }

    /// Management ///

    /** Track a new contract. */
    function addContractAddress(address contractAddress) external {
        require(
            // Reentrancy guard.
            (_status == S_NOT_ENTERED || _status == S_FROZEN)

            // Caller must be an admin.
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN

            // Make sure the address is an external contract that is not being tracked. We don't do any validation on if the
            // target address is a contract, or even if it supports `IERC1155`, since all interactions will revert if either of
            // those are true.
            && contractAddress != address(0)
            && contractAddress != address(this)
            && _coreAddressIndices[contractAddress] == 0
        , "Invalid parameters");

        // Add the contract.
        _coreAddresses.push(contractAddress);
        _contractTokenCounts.push(0);
        _coreAddressIndices[contractAddress] = _coreAddresses.length;

        // Hello world!
        emit ContractAddressAdded(contractAddress);
    }

    /** Change the currently tracked contract. */
    function changeContractAddress(address oldContract, address newContract) external {
        uint256 index = _coreAddressIndices[oldContract];
        require(
            // Reentrancy guard.
            (_status == S_NOT_ENTERED || _status == S_FROZEN)

            // Caller must be an admin.
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN

            // Make sure the address is an external contract that is currently being tracked. We don't do any validation on if the
            // target address is a contract, or even if it supports `IERC1155`, since all interactions will revert if either of
            // those are true.
            && newContract != address(0)
            && newContract != address(this)
            && index > 0
            && _contractTokenCounts[index - 1] == 0
        , "Invalid parameters");

        // Change the contract.
        _coreAddresses[index - 1] = newContract;
        _coreAddressIndices[oldContract] = 0;
        _coreAddressIndices[newContract] = index;

        // Hello world!
        emit ContractAddressChanged(oldContract, newContract);
    }

    /** Lock out all non-management aspects of the contract. Token transfers are still allowed. */
    function freeze() external {
        require(
               _status == S_NOT_ENTERED                               // Must not be frozen
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN // Not admin.
        , "Not authorized");

        _status = S_FROZEN;
    }

    /** Remove a tracked contract from the vault. This will fail if there are any tokens vaulted for this contract. */
    function removeContractAddress(address contractAddress) external {
        uint256 contractIndex = _coreAddressIndices[contractAddress];
        require(
            // Reentrancy guard.
            (_status == S_NOT_ENTERED || _status == S_FROZEN)

            // Caller must be an admin.
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN

            // Make sure the contract is tracked and has no stored tokens.
            &&  contractIndex > 0
            && _contractTokenCounts[--contractIndex] == 0
        , "Invalid parameters");

        // Remove the contract. We can't do a pop and swap, or otherwise shrink the contract arrays, since that would require
        // updating the keys for all tokens whose contract indices are greater than the index we are clearing.
        _coreAddresses[contractIndex] = address(0);
        _coreAddressIndices[contractAddress] = 0;

        // Hello world!
        emit ContractAddressRemoved(contractAddress);
    }

    /** Restore all non-management aspects of the contract. */
    function unfreeze() external {
        require(
               _status == S_FROZEN                                    // Must be frozen
            && (_addressRoles[msg.sender] & R_IS_ADMIN) == R_IS_ADMIN // Not admin.
        , "Not authorized");

        _status = S_NOT_ENTERED;
    }

    /// ERC-1155 ///

    /**
     * Called when an ERC-1155 compliant contract is targeting this contract as the receiver in a `safeTransferFrom()` call. This
     * checks to make sure we are expecting a token to be transferred. This should only be called as a result of `deposit()`.
     *
     * @param operator Who (from the perspective of the ERC-1155 contract) called `safeTransferFrom()`. This must always be this Vault.
     * @param from Who is the owner of the ERC-1155 token. This must always be `_depositor`.
     * @dev Unused parameter: id - The ID of the token being transferred.
     * @dev Unused parameter: value - The amount of tokens being transferred.
     * @dev Unused parameter: data - Optional data sent from the ERC-1155 contract.
     */
    function onERC1155Received(address operator, address from, uint256, uint256, bytes calldata) override external returns (bytes4) {
        // We must be in the middle of a deposit. If this function is called as a side-effect of a withdrawal / parity swap, this will
        // have a false-negative. However, that is only the case if the underlying contract is not valid / malicious.
        require(_status == S_ENTERED, "Reentrancy: non-reentrant call");

        require(operator == address(this),                "Cannot call directly");
        require(from == _depositor && from != address(0), "Depositor mismatch");
        require(_coreAddressIndices[msg.sender] > 0,      "Token not allowed in vault");

        // Accept this transfer.
        return 0xf23a6e61; // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
         // TODO: Return as constant
    }

    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceID) override external view returns (bool) {
        return
            // ERC-165 support:
            //      bytes4(keccak256('supportsInterface(bytes4)'))
               interfaceID == 0x01ffc9a7

            // ERC-1155 `ERC1155TokenReceiver` support:
            //      bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
            //    ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
            || interfaceID == 0x4e2312e0;      
    }

    /** @dev We can't do batch transfers since this is a Heterogenous vault. */
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) override external returns (bytes4) {
        // Reject by reverting.
        revert("ERC1155 batch not supported");
    }

    /// Vault ///

    /**
     * Deposit any number of tokens into the vault, receiving ERC-20 wrapped tokens in response. Users can deposit tokens on behalf
     * of a third party (the one who would receive the parity tokens), so long as they are the owners of the token.
     *
     * @param depositor Who will be receiving the ERC-20 parity tokens.
     * @param tokenIds The ids of the tokens that will be deposited. All tokens must be approved for transfer first.
     */
    function deposit(address depositor, address[] calldata tokenContracts, uint256[] calldata tokenIds, uint256[] calldata tokenCounts) external {
        require(
            // Reentrancy guard.
            _status == S_NOT_ENTERED

            // Make sure the user is allowed to deposit. We use the sender instead of the provided depositor because this function
            // could be called via paritySwap (or some other contract). Plus `depositor` is just the user who receives the parity
            // token. We don't need to do any checking if the vault does not restrict depositing.
            && (
                   ((_roleRestrictions & WL_RESTRICT_DEPOSITS)  != WL_RESTRICT_DEPOSITS)
                || ((_addressRoles[msg.sender] & R_CAN_DEPOSIT) == R_CAN_DEPOSIT)
            )

            // We need to know who will be receiving the parity tokens. The depositor can't be one of the tracked contracts.
            && depositor != address(0)
            && depositor != address(this)
            && _coreAddressIndices[depositor] == 0

            // There are two additional guards that we are explicitly not doing. The first is ensuring that our arrays do not
            // exceed their theoretical bounds (e.g., overflow on `_tokenIds.length`). This is functionally impossible given the
            // limitations of our current technology, the design life of this vault, and the current ecosystem of smart contracts.
            //
            // The second check we are not doing is ensuring that the length of our three arrays are the same. The EVM will revert
            // ('invalid opcode'), so this is just unnecessary gas. It is self evident that the three arrays should be equal size.
        , "Invalid parameters");
        _status = S_ENTERED;

        // Preserve the user so we know who to receive tokens from.
        _depositor = msg.sender;

        // We don't want to keep reading the length from storage.
        uint256 _length = _tokenIds.length;

        // Try and deposit everything.
        IERC1155 tokenContract;
        uint256 contractIndex;
        uint256 mintCount;
        uint256 count = tokenIds.length;
        uint256 i;

        for (; i < count; i ++) {
            // Make sure that the vault can accept this token's contract. We skip any contracts that aren't whitelisted within
            // this vault. In principle, the vault's contract whitelist should not change frequently, and removals should be
            // especially rare. So it's up to the user to be aware of what the vault will accept before initiating a deposit.
            tokenContract = IERC1155(tokenContracts[i]);
            contractIndex = _coreAddressIndices[address(tokenContract)];
            if (contractIndex == 0) {
                continue;
            }

            // Check to see if we've already stored this token. If we have, then we only need to increase the tracked count.
            uint256 tokenId = tokenIds[i];
            uint256 tokenCount = tokenCounts[i];
            uint256 currentIndex__currentBalance = _indices[(contractIndex << CONTRACT_INDEX_OFFSET) | tokenId];
            _contractTokenCounts[contractIndex - 1] += tokenCount;
            if (currentIndex__currentBalance > 0) {
                _tokenCounts[currentIndex__currentBalance - 1] += tokenCount;
            } else {
                // Store it in the vault. We merge together the index of a token's contract with its token id to store in
                // `_indices`, left-shifting the index as much as we can. This works so long as an NFT id isn't >2^200. That is a
                // reasonable assumption, which is doubly assuming that all NFT ids start at 0 and the practical upper bound on
                // NFT ids is somewhere below 2^60 (10^18). If that doesn't hold true (probably because NFT ids are
                // non-conforming), then we run the risk of overwriting the lowest bits of the contract index with the highest
                // bits of the NFT id. At worst, this would prevent withdrawing an NFT with a specific id if it's collision has
                // already been withdrawn. This puts the hard limit of a vault at 70 quadrillion contracts with 1 novemdecillion
                // NFTs per contract. Have fun!
                _tokenIds.push(tokenId);
                _tokenContracts.push(address(tokenContract));
                _tokenCounts.push(tokenCount);
                _indices[(contractIndex << CONTRACT_INDEX_OFFSET) | tokenId] = ++_length;
            }

            // We need to know the prior balance in order to validate that the token contract did the full transfer. We will adjust
            // the intended token count value if they are trying to deposit more than they own. If they don't have any balance at all,
            // then we'll just move on to the next token.
            currentIndex__currentBalance = tokenContract.balanceOf(msg.sender, tokenId);
            uint256 currentVaultBalance = tokenContract.balanceOf(address(this), tokenId);
            if (currentIndex__currentBalance == 0) {
                continue;
            }
            if (tokenCount > currentIndex__currentBalance) {
                tokenCount = currentIndex__currentBalance;
            }

            // Track the true number to be minted.
            mintCount += tokenCount;

            // Attempt to transfer the token. If the sender hasn't approved this contract for this specific token then it will fail.
            tokenContract.safeTransferFrom(msg.sender, address(this), tokenId, tokenCount, bytes(""));

            // Validate the transfer balances.
            require(
                   tokenContract.balanceOf(msg.sender, tokenId)    == (currentIndex__currentBalance - tokenCount)
                && tokenContract.balanceOf(address(this), tokenId) == (currentVaultBalance + tokenCount)
            , "Transfer failed");

            // Hello world!
            emit TokensDeposited(address(tokenContract), tokenId, tokenCount);
        }

        // Give them the wrapped ERC-20 token.
        if (mintCount > 0) {
            _mint(depositor, mintCount * _baseWrappedAmount);
        }

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200).
        _depositor = address(0);
        _status = S_NOT_ENTERED;
    }

    /** Withdraw a token by its index within the vault. This is a failsafe if there is a collision on the contract index. */
    function withdrawTokenAtIndex(address destination, uint256 index, uint256 count) external {
        require(
            // Reentrancy guard.
            _status == S_NOT_ENTERED

            // Make sure the user is allowed to withdraw. We don't need check if the vault doesn't restrict withdrawals.
            && (
                   ((_roleRestrictions & WL_RESTRICT_WITHDRAWALS) != WL_RESTRICT_WITHDRAWALS)
                || ((_addressRoles[msg.sender] & R_CAN_WITHDRAW)  == R_CAN_WITHDRAW)
            )

            // We need to know who will be receiving the tokens. The destination can't be one of the tracked contracts.
            && destination != address(0)
            && destination != address(this)
            && _coreAddressIndices[destination] == 0

            // Make sure we have at least some tokens vaulted.
            && _tokenIds.length > 0
        
            //  We don't need to validate that the index is valid since the EVM will just revert ('invalid opcode'), so this is
            // just unnecessary gas.
        , "Invalid parameters");
        _status = S_ENTERED;

        // Attempt the withdrawal.
        uint256 burnCount = _withdrawTokens(destination, index, count);

        // Take the wrapped ERC-20 tokens.
        if (burnCount > 0) {
            _burn(msg.sender, burnCount * _baseWrappedAmount);
        }

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200).
        _status = S_NOT_ENTERED;
    }

    /**
     * Attempts to withdraw the tokens with the specified ids. Only the stored tokens will be withdrawn.
     *
     * @param destination Who will receive the ERC-1155 tokens.
     * @param tokenContracts The contracts of the tokens that will be withdrawn.
     * @param tokenIds The ids of the tokens that will be withdrawn.
     * @param tokenCounts The maximum number of tokens that will be withdrawn.
     */
    function withdrawTokens(address destination, address[] calldata tokenContracts, uint256[] calldata tokenIds, uint256[] calldata tokenCounts) external {
        require(
            // Reentrancy guard.
            _status == S_NOT_ENTERED

            // Make sure the user is allowed to withdraw. We don't need check if the vault doesn't restrict withdrawals.
            && (
                   ((_roleRestrictions & WL_RESTRICT_WITHDRAWALS) != WL_RESTRICT_WITHDRAWALS)
                || ((_addressRoles[msg.sender] & R_CAN_WITHDRAW)  == R_CAN_WITHDRAW)
            )

            // We need to know who will be receiving the tokens. The destination can't be one of the tracked contracts.
            && destination != address(0)
            && destination != address(this)
            && _coreAddressIndices[destination] == 0

            // Make sure we have at least some tokens vaulted.
            && _tokenIds.length > 0
        
            // We don't need to ensure that the length of our three arrays are the same. The EVM will revert ('invalid opcode'),
            // so this is just unnecessary gas. It is self evident that the three arrays should be equal size.
        , "Invalid parameters");
        _status = S_ENTERED;

        // We don't want to revert if this vault doesn't contain some of the tokens, so we are checking for existence and only
        // transferring those that this vault owns. Because of this, we can't burn the parity token up front since there's no way
        // to know how many will actually be transferred.
        uint256 burnCount;
        uint256 count = tokenIds.length;
        for (uint256 i; i < count; i ++) {
            // If we can't find it, we'll skip it. Index is off by 1 so that 0 = nonexistent. We also need to check to make sure
            // the token stored at that index matches what we want to withdraw (contract and id) since the mapping could have a
            // collision.
            address tokenContract = tokenContracts[i];
            uint256 tokenId = tokenIds[i];
            uint256 contractIndex = _coreAddressIndices[tokenContract];
            uint256 tokenIndex = _indices[(contractIndex << CONTRACT_INDEX_OFFSET) | tokenId];
            if (
                   contractIndex == 0 // Contract is not allowed in this vault.
                || tokenIndex == 0 // Token is not in this vault.
                || _tokenContracts[--tokenIndex] != tokenContract // Contract for token at that index does not match expected.
                || _tokenIds[tokenIndex] != tokenIds[i] // Token at that index does not match expected.
            ) {
                continue;
            }
            burnCount += _withdrawTokens(destination, tokenIndex, tokenCounts[i]);
        }

        // Take the wrapped ERC-20 tokens.
        if (burnCount > 0) {
            _burn(msg.sender, burnCount * _baseWrappedAmount);
        }

        // By storing the original value once again, a refund is triggered (see https://eips.ethereum.org/EIPS/eip-2200).
        _status = S_NOT_ENTERED;
    }

    /**
     * Executes a withdrawal.
     *
     * @param destination Who will be receiving the NFT.
     * @param index The index within the vault that will be withdrawn.
     * @param tokenCount How many of the token should be withdrawn. It will only withdraw as many as are vaulted.
     *
     * @return The number of withdrawn tokens.
     */
    function _withdrawTokens(address destination, uint256 index, uint256 tokenCount) internal returns (uint256) {
        IERC1155 tokenContract = IERC1155(_tokenContracts[index]);
        uint256 tokenId = _tokenIds[index];
        uint256 contractIndex = _coreAddressIndices[address(tokenContract)];

        // We can only withdraw as many as we have vaulted.
        if (_tokenCounts[index] <= tokenCount) {
            tokenCount = _tokenCounts[index];
            
            // Swap and pop the ids and counts.
            uint256 lastIndex = _tokenIds.length - 1;
            uint256 tailTokenId = _tokenIds[lastIndex];
            _tokenIds[index] = tailTokenId;
            _tokenIds.pop();
            _tokenCounts[index] = _tokenCounts[lastIndex];
            _tokenCounts.pop();

            // Swap and pop the contract.
            address tailTokenContract = _tokenContracts[lastIndex];
            _tokenContracts[index] = tailTokenContract;
            _tokenContracts.pop();

            // Update the index mapping.
            lastIndex = _coreAddressIndices[tailTokenContract]; // Reuse to reduce local stack size.
            _indices[(lastIndex << CONTRACT_INDEX_OFFSET) | tailTokenId] = index + 1;
            _indices[(contractIndex << CONTRACT_INDEX_OFFSET) | tokenId] = 0;
            
        } else {
            _tokenCounts[index] -= tokenCount;
        }

        // Update the count.
        _contractTokenCounts[contractIndex - 1] -= tokenCount;

        // Get the state prior to the transfer so we can do validation.
        uint256 currentDestinationBalance = tokenContract.balanceOf(destination,   tokenId);
        uint256 currentVaultBalance       = tokenContract.balanceOf(address(this), tokenId);

        // Attempt to transfer the tokens.
        tokenContract.safeTransferFrom(address(this), destination, tokenId, tokenCount, bytes(""));

        // Validate the transfer balances.
        require(
               tokenContract.balanceOf(destination, tokenId)   == (currentDestinationBalance + tokenCount)
            && tokenContract.balanceOf(address(this), tokenId) == (currentVaultBalance - tokenCount)
        , "Transfer failed");

        // Hello world!
        emit TokensWithdrawn(address(tokenContract), tokenId, tokenCount);

        return tokenCount;
    }
}
