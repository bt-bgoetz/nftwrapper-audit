(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../../utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTokenIndexCount = exports.withdraw1155E = exports.withdraw721E = exports.deposit1155E = exports.deposit721E = void 0;
    const utils_1 = require("../../utils");
    /**
     * Checks to make sure that the tracked vault state matches the real vault state. We don't care about the position of a given
     * token within the vault, since that is an implementation specific constraint. We only want to make sure that the following
     * predicates are true:
     *    - The number of vaulted tokens is correct.
     *    - The holders of the parity token have the correct amounts.
     *    - The owner of the NFTs are correct.
     *    - Every vaulted NFT is withdrawable.
    */
    async function checkState721E(vaultState, errorPrefix) {
        const { instance, holderCounts, vaultTokenMap, } = vaultState;
        // Make sure the vault has the correct number of stored tokens.
        assert.strictEqual((await instance.size())[1].toNumber(), vaultTokenMap.size, "Chain tokens count mismatch");
        // Get all the tokens as the exist on the chain.
        const rawChainTokens = await Promise.all(new Array(vaultTokenMap.size).fill(0).map((_, i) => instance.tokenAt(i)));
        // Build a map of their unique keys.
        const chainTokenMap = new Map();
        rawChainTokens.map((rawChainToken) => {
            const chainToken = extract155ChainToken(rawChainToken);
            const key = `${chainToken.contract.toLowerCase()}-${chainToken.id.toString()}`;
            assert.isNotOk(chainTokenMap.has(key), "Duplicate chain token key");
            chainTokenMap.set(key, chainToken);
        });
        // Make sure it all matches up.
        const vaultTokenPromises = Array.from(vaultTokenMap.entries()).map(async ([key, vaultToken]) => {
            // Make sure the chain token exists.
            const chainToken = chainTokenMap.get(key);
            assert.notStrictEqual(chainToken, undefined, `Chain token missing: |${key}|`);
            // Make sure the vault has the NFT.
            assert.equal(await vaultToken.contract.ownerOf(vaultToken.id), instance.address);
        });
        await Promise.all(vaultTokenPromises);
        // Make sure there aren't any chain tokens that should not exist.
        chainTokenMap.forEach((_, key) => assert.isOk(vaultTokenMap.has(key)));
        // Make sure the parity token holder counts are correct.
        const holderPromises = Array.from(holderCounts.entries()).map(async ([holder, balance], i) => utils_1.numberIs(instance, balance, `${errorPrefix}: holder count mismatch (${i})`, "balanceOf", holder));
        await Promise.all(holderPromises);
    }
    /**
     * Checks to make sure that the tracked vault state matches the real vault state. We don't care about the position of a given
     * token within the vault, since that is an implementation specific constraint. We only want to make sure that the following
     * predicates are true:
     *    - The number of vaulted tokens is correct.
     *    - The holders of the parity token have the correct amounts.
     *    - The owner of the NFTs are correct.
     *    - Every vaulted NFT is withdrawable.
    */
    async function checkState1155E(vaultState, errorPrefix) {
        const { instance, holderCounts, vaultTokenMap, } = vaultState;
        // Make sure the vault has the correct number of stored tokens.
        assert.strictEqual((await instance.size())[1].toNumber(), vaultTokenMap.size, "Chain tokens count mismatch");
        // Get all the tokens as the exist on the chain.
        const rawChainTokens = await Promise.all(new Array(vaultTokenMap.size).fill(0).map((_, i) => instance.tokenAt(i)));
        // Build a map of their unique keys.
        const chainTokenMap = new Map();
        rawChainTokens.map((rawChainToken) => {
            const chainToken = extract155ChainToken(rawChainToken);
            const key = `${chainToken.contract.toLowerCase()}-${chainToken.id.toString()}`;
            assert.isNotOk(chainTokenMap.has(key), "Duplicate chain token key");
            chainTokenMap.set(key, chainToken);
        });
        // Make sure it all matches up.
        const vaultTokenPromises = Array.from(vaultTokenMap.entries()).map(async ([key, vaultToken], i) => {
            // Make sure the chain token exists.
            const chainToken = chainTokenMap.get(key);
            assert.notStrictEqual(chainToken, undefined, `Chain token missing: |${key}|`);
            // Make sure the count is accurate.
            assert.strictEqual(chainToken.count.toNumber(), vaultToken.count);
            // Make sure the vault has the correct balance of the NFT.
            await utils_1.numberIs(vaultToken.contract, chainToken.count.toNumber(), `${errorPrefix}: parity balance mismatch (${i})`, "balanceOf", instance.address, vaultToken.id);
        });
        await Promise.all(vaultTokenPromises);
        // Make sure there aren't any chain tokens that should not exist.
        chainTokenMap.forEach((_, key) => assert.isOk(vaultTokenMap.has(key)));
        // Make sure the parity token holder counts are correct.
        const holderPromises = Array.from(holderCounts.entries()).map(async ([holder, balance], i) => utils_1.numberIs(instance, balance, `${errorPrefix}: holder count mismatch (${i})`, "balanceOf", holder));
        await Promise.all(holderPromises);
    }
    async function deposit721E(vaultState, depositor, tokenContracts, tokenIds) {
        if (tokenContracts.length !== tokenIds.length) {
            throw new Error("Token contracts and ids must have same length");
        }
        const { holderCounts, instance, vaultTokenMap, } = vaultState;
        // Make sure the state matches our expected values.
        // await checkState721E(vaultState, "pre-deposit");
        // Update the state to match our expected values.
        const uniqueTokens = new Set();
        tokenContracts.map((tokenContract, i) => {
            const tokenId = tokenIds[i];
            const tokenKey = `${tokenContract.address.toLowerCase()}-${tokenId}`;
            if (!vaultTokenMap.has(tokenKey)) {
                const vaultToken = {
                    contract: tokenContract,
                    id: tokenId,
                };
                vaultTokenMap.set(tokenKey, vaultToken);
                // Update the holder count.
                let holderCount = holderCounts.get(depositor);
                if (holderCount === undefined) {
                    holderCount = 0;
                }
                holderCount++;
                holderCounts.set(depositor, holderCount);
            }
            uniqueTokens.add(tokenKey);
        });
        // Do the deposit.
        // console.log("Depositing", tokenContracts.map((contract) => contract.address), tokenIds);
        await instance.deposit(depositor, tokenIds, tokenContracts.map((contract) => contract.address), { from: depositor });
        // console.log("deposit gas:", uniqueTokens.size, result.receipt.gasUsed);
        // Make sure the state matches our expected values.
        await checkState721E(vaultState, "post-deposit");
    }
    exports.deposit721E = deposit721E;
    async function deposit1155E(vaultState, depositor, tokenContracts, tokenIds, tokenCounts) {
        if (tokenContracts.length !== tokenIds.length || tokenIds.length !== tokenCounts.length) {
            throw new Error("Token contracts, ids, and counts must have same length");
        }
        const { holderCounts, instance, vaultTokenMap, } = vaultState;
        // Make sure the state matches our expected values.
        // await checkState1155E(vaultState, "pre-deposit");
        // Update the state to match our expected values.
        const uniqueTokens = new Set();
        tokenContracts.map((tokenContract, i) => {
            const tokenId = tokenIds[i];
            let tokenCount = tokenCounts[i];
            const tokenKey = `${tokenContract.address.toLowerCase()}-${tokenId}`;
            // We will update the state to the maximum possible depositable value, without changing the amount requested to deposit.
            let vaultToken = vaultTokenMap.get(tokenKey);
            let previousTokenCount = 0;
            if (vaultToken !== undefined) {
                previousTokenCount = vaultToken.count;
                vaultToken.count += tokenCount;
            }
            else {
                vaultToken = {
                    contract: tokenContract,
                    id: tokenId,
                    count: tokenCount,
                };
                vaultTokenMap.set(tokenKey, vaultToken);
            }
            vaultToken.count = Math.min(vaultToken.count, vaultState.MAX_TOKEN_COUNT);
            uniqueTokens.add(tokenKey);
            // Update the holder count.
            let previousHolderCount = holderCounts.get(depositor);
            if (previousHolderCount === undefined) {
                previousHolderCount = 0;
            }
            const newHolderCount = previousHolderCount + (vaultToken.count - previousTokenCount);
            holderCounts.set(depositor, newHolderCount);
        });
        // Do the deposit.
        // console.log("Depositing", tokenContracts.map((contract) => contract.address), tokenIds, tokenCounts);
        await instance.deposit(depositor, tokenContracts.map((contract) => contract.address), tokenIds, tokenCounts, { from: depositor });
        // console.log("deposit gas:", uniqueTokens.size, result.receipt.gasUsed);
        // Make sure the state matches our expected values.
        await checkState1155E(vaultState, "post-deposit");
    }
    exports.deposit1155E = deposit1155E;
    function extract155ChainToken(chainToken) {
        return {
            contract: utils_1.normalizeAddress(chainToken[0]),
            id: chainToken[1],
            count: chainToken[2],
        };
    }
    async function withdraw721E(vaultState, withdrawer, tokenContracts, tokenIds) {
        if (tokenContracts.length !== tokenIds.length) {
            throw new Error("Token contracts and ids must have same length");
        }
        const { holderCounts, instance, vaultTokenMap, } = vaultState;
        // Make sure the state matches our expected values.
        // await checkState721E(vaultState, "pre-withdrawal");
        // Update the state to match our expected values.
        // const uniqueTokens = new Set();
        tokenContracts.map((tokenContract, i) => {
            const tokenId = tokenIds[i];
            const tokenKey = `${tokenContract.address.toLowerCase()}-${tokenId}`;
            if (!vaultTokenMap.has(tokenKey)) {
                // It's allowed to try and withdraw tokens that don't exist in the vault, it'll just be a silent fail.
                return;
            }
            vaultTokenMap.delete(tokenKey);
            // Update the holder count.
            holderCounts.set(withdrawer, holderCounts.get(withdrawer) - 1);
        });
        // Do the withdrawal.
        // console.log("Withdrawing", tokenContracts.map((contract) => contract.address), tokenIds);
        await instance.withdrawTokens(withdrawer, tokenIds, tokenContracts.map((erc) => erc.address), { from: withdrawer });
        // console.log("withdraw gas:", uniqueTokens.size, result.receipt.gasUsed);
        // Make sure the state matches our expected values.
        await checkState721E(vaultState, "post-deposit");
    }
    exports.withdraw721E = withdraw721E;
    async function withdraw1155E(vaultState, withdrawer, tokenContracts, tokenIds, tokenCounts) {
        if (tokenContracts.length !== tokenIds.length || tokenIds.length !== tokenCounts.length) {
            throw new Error("Token contracts, ids, and counts must have same length");
        }
        const { holderCounts, instance, vaultTokenMap, } = vaultState;
        // Make sure the state matches our expected values.
        // await checkState1155E(vaultState, "pre-withdrawal");
        // Update the state to match our expected values.
        const uniqueTokens = new Set();
        tokenContracts.map((tokenContract, i) => {
            const tokenId = tokenIds[i];
            let tokenCount = tokenCounts[i];
            const tokenKey = `${tokenContract.address.toLowerCase()}-${tokenId}`;
            // We will update the state to the maximum possible depositable value, without changing the amount requested to deposit.
            const vaultToken = vaultTokenMap.get(tokenKey);
            if (vaultToken === undefined) {
                // It's allowed to try and withdraw tokens that don't exist in the vault, it'll just be a silent fail.
                return;
            }
            const previousTokenCount = vaultToken.count;
            vaultToken.count = Math.max(vaultToken.count - tokenCount, 0);
            uniqueTokens.add(tokenKey);
            // Update the holder count.
            const previousHolderCount = holderCounts.get(withdrawer);
            assert.notStrictEqual(previousHolderCount, undefined, `Missing holder count: ${tokenKey}`);
            const newHolderCount = previousHolderCount - (previousTokenCount - vaultToken.count);
            holderCounts.set(withdrawer, newHolderCount);
        });
        // Remove all fully withdrawn tokens.
        Array.from(vaultTokenMap.keys()).map((tokenKey) => {
            const vaultToken = vaultTokenMap.get(tokenKey);
            if (vaultToken.count === 0) {
                vaultTokenMap.delete(tokenKey);
            }
        });
        // Do the withdrawal.
        // console.log("Withdrawing", tokenContracts.map((contract) => contract.address), tokenIds, tokenCounts);
        await instance.withdrawTokens(withdrawer, tokenContracts.map((erc) => erc.address), tokenIds, tokenCounts, { from: withdrawer });
        // console.log("withdraw gas:", uniqueTokens.size, result.receipt.gasUsed);
        // Make sure the state matches our expected values.
        await checkState1155E(vaultState, "post-deposit");
    }
    exports.withdraw1155E = withdraw1155E;
    function getTokenIndexCount(skips, badCount, tokenDetails) {
        // Find a random index for [contract, counts] and count.
        const contractIndex = Math.floor(Math.random() * tokenDetails.length);
        const tokenIndex = Math.floor(Math.random() * tokenDetails[contractIndex].length);
        if (skips.has(`${contractIndex},${tokenIndex}`)) {
            return {
                skip: true,
                newBadCount: badCount,
                contractIndex: NaN,
                tokenIndex: NaN,
                tokenCount: NaN,
            };
        }
        if (tokenDetails[contractIndex][tokenIndex] <= 0) {
            skips.add(`${contractIndex},${tokenIndex}`);
            return {
                skip: true,
                newBadCount: badCount,
                contractIndex: NaN,
                tokenIndex: NaN,
                tokenCount: NaN,
            };
        }
        let tokenCount = Math.floor(Math.random() * tokenDetails[contractIndex][tokenIndex] + 1);
        // Try to do min 3 if we can.
        tokenCount = Math.min(tokenCount, tokenDetails[contractIndex][tokenIndex]);
        tokenCount = Math.max(tokenCount, Math.min(3, tokenDetails[contractIndex][tokenIndex]));
        if (tokenCount < 0) {
            console.log("K is negative!", tokenDetails[contractIndex][tokenIndex], skips.has(`${contractIndex},${tokenIndex}`));
            return {
                skip: true,
                newBadCount: badCount + 1,
                contractIndex: NaN,
                tokenIndex: NaN,
                tokenCount: NaN,
            };
        }
        if (tokenCount == 0) {
            console.log("K is zero!", tokenDetails[contractIndex][tokenIndex], skips.has(`${contractIndex},${tokenIndex}`));
            return {
                skip: true,
                newBadCount: badCount + 1,
                contractIndex: NaN,
                tokenIndex: NaN,
                tokenCount: NaN,
            };
        }
        tokenDetails[contractIndex][tokenIndex] -= tokenCount;
        return {
            skip: false,
            newBadCount: badCount,
            contractIndex,
            tokenIndex,
            tokenCount,
        };
    }
    exports.getTokenIndexCount = getTokenIndexCount;
});
//# sourceMappingURL=utils.js.map