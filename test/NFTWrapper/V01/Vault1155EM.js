(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../../utils", "./utils", "./_Managed"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runTests = void 0;
    const utils_1 = require("../../utils");
    const utils_2 = require("./utils");
    const Managed = require("./_Managed");
    const TEST_GROUP = "Vault1155EM";
    function label(string) {
        return `${TEST_GROUP} - ${string}`;
    }
    function runTests(instanceGetter) {
        Managed.runTests(instanceGetter);
        utils_1.CONTRACT(label("manage contracts"), instanceGetter, test_manageAContracts);
        utils_1.CONTRACT(label("deposit, withdraw single"), instanceGetter, test_depositWithdrawSingle);
        utils_1.CONTRACT(label("deposit, withdraw multiple"), instanceGetter, test_depositWithdrawMultiple);
        utils_1.CONTRACT(label("token filtering"), instanceGetter, test_tokenFiltering);
    }
    exports.runTests = runTests;
    async function test_manageAContracts(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        const erc1155 = [];
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            // Get some contracts.
            for (let i = 0; i < 4; i++) {
                erc1155.push(await artifacts.require(`StubERC1155_${i}`).deployed());
            }
        });
        utils_1.IT("Should have first contract", async () => {
            assert.equal((await instance.size())[0], 1, "Should have one contract");
            utils_1.addressIs((await instance.contractAt(0))[0], erc1155[0]);
        });
        utils_1.IT("Should be able to add a contract", async () => {
            assert.equal((await instance.size())[0], 1, "Should have one contract");
            await instance.addContractAddress(erc1155[1].address, FROM[0]);
            utils_1.addressIs((await instance.contractAt(1))[0], erc1155[1]);
            assert.equal((await instance.size())[0], 2, "Should have two contracts");
        });
        utils_1.IT("Should not be able to add a contract", async () => {
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[0], "addContractAddress", erc1155[1].address);
        });
        utils_1.IT("Should be able to remove a contract", async () => {
            assert.equal((await instance.size())[0], 2, "Should have two contracts");
            await instance.removeContractAddress(erc1155[1].address, FROM[0]);
            assert.equal((await instance.size())[0], 2, "Should have two contracts");
            utils_1.addressIs((await instance.contractAt(0))[1], "0");
        });
        utils_1.IT("Should not be able to remove a contract", async () => {
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[0], "removeContractAddress", erc1155[1].address);
        });
        utils_1.IT("Should be able to mint and deposit tokens", async () => {
            assert.equal((await instance.size())[0], 2, "Should have two contract");
            await instance.addContractAddress(erc1155[2].address, FROM[0]);
            utils_1.addressIs((await instance.contractAt(2))[0], erc1155[2]);
            assert.equal((await instance.size())[0], 3, "Should have three contracts");
            await utils_1.numberIs(erc1155[2], 0, "", "balanceOf", accounts[0], 1);
            await erc1155[2].mint(accounts[0], 1, 10);
            await utils_1.numberIs(erc1155[2], 10, "", "balanceOf", accounts[0], 1);
            // Do initial deposit.
            await erc1155[2].setApprovalForAll(instance.address, true, FROM[0]);
            await utils_1.numberIs(instance, 0, "", "balanceOf", accounts[0]);
            await instance.deposit(accounts[0], [erc1155[2].address], [1], [5], FROM[0]);
            await utils_1.numberIs(instance, 5, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155[2], 5, "", "balanceOf", accounts[0], 1);
            assert.equal((await instance.size())[1], 1, "Should have one unique token");
            // Check the token details.
            const [fakeAddress, id, tokenCount] = await instance.tokenAt(0);
            utils_1.addressIs(fakeAddress, erc1155[2], "Contract should match");
            assert.equal(id.toNumber(), 1, "ID should match");
            assert.equal(tokenCount.toNumber(), 5, "Count should be five");
            // Check the contract details.
            const [address, contractTokenCount] = await instance.contractAt(2);
            utils_1.addressIs(address, erc1155[2]);
            assert.equal(contractTokenCount.toNumber(), 5, "Count should match");
        });
        utils_1.IT("Should be able to withdraw", async () => {
            await utils_1.numberIs(instance, 0, "", "getTokenIndex", erc1155[2].address, 1);
            await utils_1.numberIs(instance, 5, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155[2], 5, "", "balanceOf", accounts[0], 1);
            await instance.withdrawTokens(accounts[0], [erc1155[2].address], [1], [5], FROM[0]);
            await utils_1.numberIs(instance, 0, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155[2], 10, "", "balanceOf", accounts[0], 1);
            assert.equal((await instance.size())[1], 0, "Should have no unique tokens");
            // Check the contract details
            const [address, contractTokenCount] = await instance.contractAt(2);
            utils_1.addressIs(address, erc1155[2]);
            assert.equal((await instance.size())[0], 3, "Should have three contracts");
            assert.equal(contractTokenCount.toNumber(), 0, "Count should match");
        });
        utils_1.IT("Should be able to add a contract", async () => {
            assert.equal((await instance.size())[0], 3, "Should have three contracts");
            await instance.addContractAddress(erc1155[3].address, FROM[0]);
            assert.equal((await instance.size())[0], 4, "Should have four contracts");
            utils_1.addressIs((await instance.contractAt(3))[0], erc1155[3]);
        });
    }
    async function test_depositWithdrawSingle(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        const erc1155 = [];
        const contractsCount = 2;
        const tokensPerContract = 4;
        const countPerToken = 5;
        let vaultState;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            vaultState = {
                instance,
                holderCounts: new Map(),
                vaultTokenMap: new Map(),
                MAX_TOKEN_COUNT: countPerToken,
            };
            // Get some contracts.
            const postDeployPromises = [];
            const deployPromises = await new Array(contractsCount).fill(0).map(async (_, i) => {
                // Grab, add, mint, approve.
                const _1155 = await artifacts.require(`StubERC1155_${i}`).deployed();
                erc1155.push(_1155);
                if (i > 0) {
                    postDeployPromises.push(instance.addContractAddress(_1155.address, FROM[0]));
                }
                postDeployPromises.push(_1155.setApprovalForAll(instance.address, true, FROM[0]));
                for (let j = 0; j < tokensPerContract; j++) {
                    postDeployPromises.push(_1155.mint(accounts[0], j + 1, countPerToken, FROM[0]));
                }
            });
            await Promise.all(deployPromises);
            await Promise.all(postDeployPromises);
            assert.equal((await instance.size())[0], erc1155.length, `Should have ${contractsCount} contracts`);
            for (let i = 0; i < erc1155.length; i++) {
                utils_1.addressIs((await instance.contractAt(i))[0], erc1155[i]);
            }
        });
        utils_1.IT("Should be able to deposit all", async function () {
            // We are assuming ~ 3s for each round of deposits. We assume worst case of 3 count per transaction, with a small buffer.
            let timeout = 1 * contractsCount * tokensPerContract * countPerToken * 1000;
            timeout *= 1.1;
            //@ts-expect-error We have to use `this.timeout()` to override the Mocha timeout for this test.
            this.timeout(Math.ceil(timeout));
            // Deposit everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(countPerToken));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const { skip, newBadCount, contractIndex, tokenIndex, tokenCount, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                badCount = newBadCount;
                if (skip) {
                    continue;
                }
                // Reduce our counts.
                if (counts[contractIndex][tokenIndex] <= 0) {
                    finished++;
                }
                await utils_2.deposit1155E(vaultState, accounts[0], [erc1155[contractIndex]], [tokenIndex + 1], [tokenCount]);
            }
        });
        utils_1.IT("Should be able to withdraw all", async function () {
            // We are assuming ~ 3s for each round of deposits. We assume worst case of 3 count per transaction, with a small buffer.
            let timeout = 1 * contractsCount * tokensPerContract * countPerToken * 1000;
            timeout *= 1.1;
            //@ts-expect-error We have to use `this.timeout()` to override the Mocha timeout for this test.
            this.timeout(Math.ceil(timeout));
            // Withdraw everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(countPerToken));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const { skip, newBadCount, contractIndex, tokenIndex, tokenCount, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                badCount = newBadCount;
                if (skip) {
                    continue;
                }
                // Reduce our counts.
                if (counts[contractIndex][tokenIndex] <= 0) {
                    finished++;
                }
                await utils_2.withdraw1155E(vaultState, accounts[0], [erc1155[contractIndex]], [tokenIndex + 1], [tokenCount]);
            }
        });
    }
    async function test_depositWithdrawMultiple(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        const erc1155 = [];
        const contractsCount = 3;
        const tokensPerContract = 4;
        const countPerToken = 5;
        /** How many tokens we should try to do at once when doing a multiple deposit / withdrawal. */
        const multipleActionTarget = 5;
        let vaultState;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            vaultState = {
                instance,
                holderCounts: new Map(),
                vaultTokenMap: new Map(),
                MAX_TOKEN_COUNT: countPerToken,
            };
            // Get some contracts.
            const postDeployPromises = [];
            const deployPromises = await new Array(contractsCount).fill(0).map(async (_, i) => {
                // Grab, add, mint, approve.
                const _1155 = await artifacts.require(`StubERC1155_${i}`).deployed();
                erc1155.push(_1155);
                if (i > 0) {
                    postDeployPromises.push(instance.addContractAddress(_1155.address, FROM[0]));
                }
                postDeployPromises.push(_1155.setApprovalForAll(instance.address, true, FROM[0]));
                for (let j = 0; j < tokensPerContract; j++) {
                    postDeployPromises.push(_1155.mint(accounts[0], j + 1, countPerToken, FROM[0]));
                }
            });
            await Promise.all(deployPromises);
            await Promise.all(postDeployPromises);
            assert.equal((await instance.size())[0], erc1155.length, `Should have ${contractsCount} contracts`);
            for (let i = 0; i < erc1155.length; i++) {
                utils_1.addressIs((await instance.contractAt(i))[0], erc1155[i]);
            }
        });
        utils_1.IT("Should be able to deposit multiple", async function () {
            // We are assuming ~ 3s for each round of deposits. We assume worst case of 3 count per transaction, with a small buffer.
            let timeout = 1 * contractsCount * tokensPerContract * countPerToken * 1000;
            timeout *= 1.1;
            //@ts-expect-error We have to use `this.timeout()` to override the Mocha timeout for this test.
            this.timeout(Math.ceil(timeout));
            // Deposit everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(countPerToken));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const contractIndices = [];
                const tokenIndices = [];
                const tokenCounts = [];
                for (let i = 0; i < multipleActionTarget; i++) {
                    const { skip, newBadCount, contractIndex, tokenIndex, tokenCount, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                    badCount = newBadCount;
                    if (skip) {
                        continue;
                    }
                    contractIndices.push(contractIndex);
                    tokenIndices.push(tokenIndex);
                    tokenCounts.push(tokenCount);
                }
                if (contractIndices.length === 0) {
                    continue;
                }
                // Reduce our counts.
                contractIndices.map((contractIndex, i) => {
                    if (counts[contractIndex][tokenIndices[i]] <= 0) {
                        finished++;
                    }
                });
                await utils_2.deposit1155E(vaultState, accounts[0], contractIndices.map((contractIndex) => erc1155[contractIndex]), tokenIndices.map((tokenIndex) => tokenIndex + 1), tokenCounts);
            }
        });
        utils_1.IT("Should be able to withdraw multiple", async function () {
            // We are assuming ~ 3s for each round of deposits. We assume worst case of 3 count per transaction, with a small buffer.
            let timeout = 1 * contractsCount * tokensPerContract * countPerToken * 1000;
            timeout *= 1.1;
            //@ts-expect-error We have to use `this.timeout()` to override the Mocha timeout for this test.
            this.timeout(Math.ceil(timeout));
            // Withdraw everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(countPerToken));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const contractIndices = [];
                const tokenIndices = [];
                const tokenCounts = [];
                for (let i = 0; i < multipleActionTarget; i++) {
                    const { skip, newBadCount, contractIndex, tokenIndex, tokenCount, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                    badCount = newBadCount;
                    if (skip) {
                        continue;
                    }
                    contractIndices.push(contractIndex);
                    tokenIndices.push(tokenIndex);
                    tokenCounts.push(tokenCount);
                }
                if (contractIndices.length === 0) {
                    continue;
                }
                // Reduce our counts.
                contractIndices.map((contractIndex, i) => {
                    if (counts[contractIndex][tokenIndices[i]] <= 0) {
                        finished++;
                    }
                });
                await utils_2.withdraw1155E(vaultState, accounts[0], contractIndices.map((contractIndex) => erc1155[contractIndex]), tokenIndices.map((tokenIndex) => tokenIndex + 1), tokenCounts);
            }
        });
    }
    /** Here we test to make sure that role-restricted withdrawals are rejected. */
    async function test_tokenFiltering(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        let erc1155;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            erc1155 = await artifacts.require("StubERC1155_0").deployed();
            // Approve the accounts for all transfers
            for (let i = 0; i < 3; i++) {
                await erc1155.setApprovalForAll(instance.address, true, FROM[i]);
            }
            // Freeze the vault.
            await instance.freeze();
        });
        utils_1.IT("Should be able to mint tokens", async () => {
            const tokenCount = 5;
            for (let i = 0; i < tokenCount; i++) {
                await erc1155.mint(accounts[0], i, 1);
                await utils_1.numberIs(erc1155, 1, "", "balanceOf", accounts[0], i);
            }
        });
        utils_1.IT("Should be able to deposit token", async () => {
            assert.isOk(await instance.canDepositToken(erc1155.address, 1));
        });
        utils_1.IT("Should be able to add to whitelist", async () => {
            await instance.addTokenFilters(erc1155.address, [2], [2], FROM[0]);
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 1));
            assert.isOk(await instance.canDepositToken(erc1155.address, 2));
        });
        utils_1.IT("Should be able to add to whitelist", async () => {
            await instance.addTokenFilters(erc1155.address, [3], [4], FROM[0]);
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 5));
            assert.isOk(await instance.canDepositToken(erc1155.address, 3));
            assert.isOk(await instance.canDepositToken(erc1155.address, 4));
        });
        utils_1.IT("Should not be able to add to whitelist", async () => {
            utils_1.expectReversion(instance, "Not sorted", accounts[0], "addTokenFilters", erc1155.address, [1], [1]);
            utils_1.expectReversion(instance, "Not sorted", accounts[0], "addTokenFilters", erc1155.address, [8], [6]);
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 1));
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 7));
        });
        utils_1.IT("Should be able to add to whitelist", async () => {
            await instance.addTokenFilters(erc1155.address, [5, 17, 1999], [8, 234, 393999], FROM[0]);
            assert.isOk(await instance.canDepositToken(erc1155.address, 7));
            assert.isOk(await instance.canDepositToken(erc1155.address, 124));
            assert.isOk(await instance.canDepositToken(erc1155.address, 86919));
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 10000000));
        });
        utils_1.IT("Should be able to clear whitelist", async () => {
            await instance.clearTokenFilters(erc1155.address, FROM[0]);
            assert.isOk(await instance.canDepositToken(erc1155.address, 7));
            assert.isOk(await instance.canDepositToken(erc1155.address, 10000000));
        });
        utils_1.IT("Should not be able to add to whitelist", async () => {
            await instance.addTokenFilters(erc1155.address, [1], [1], FROM[0]);
            assert.isOk(await instance.canDepositToken(erc1155.address, 1));
            assert.isNotOk(await instance.canDepositToken(erc1155.address, 7));
        });
    }
});
//# sourceMappingURL=Vault1155EM.js.map