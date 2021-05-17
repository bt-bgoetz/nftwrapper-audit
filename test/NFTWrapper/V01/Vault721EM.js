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
    const TEST_GROUP = "Vault721EM";
    function label(string) {
        return `${TEST_GROUP} - ${string}`;
    }
    function runTests(instanceGetter) {
        Managed.runTests(instanceGetter);
        utils_1.CONTRACT(label("deposit, withdraw single"), instanceGetter, test_depositWithdrawSingle);
        utils_1.CONTRACT(label("deposit, withdraw multiple"), instanceGetter, test_depositWithdrawMultiple);
    }
    exports.runTests = runTests;
    async function test_depositWithdrawSingle(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        const erc721 = [];
        const contractsCount = 2;
        const tokensPerContract = 4;
        let vaultState;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            vaultState = {
                instance,
                holderCounts: new Map(),
                vaultTokenMap: new Map(),
            };
            // Get some contracts.
            const postDeployPromises = [];
            const deployPromises = await new Array(contractsCount).fill(0).map(async (_, i) => {
                // Grab, add, mint, approve.
                const _721 = await artifacts.require(`StubERC721_${i}`).deployed();
                erc721.push(_721);
                if (i > 0) {
                    postDeployPromises.push(instance.addContractAddress(_721.address, FROM[0]));
                }
                postDeployPromises.push(_721.setApprovalForAll(instance.address, true, FROM[0]));
                for (let j = 0; j < tokensPerContract; j++) {
                    postDeployPromises.push(_721.mint(accounts[0], j + 1, FROM[0]));
                }
            });
            await Promise.all(deployPromises);
            await Promise.all(postDeployPromises);
            assert.equal((await instance.size())[0], erc721.length, `Should have ${contractsCount} contracts`);
            for (let i = 0; i < erc721.length; i++) {
                utils_1.addressIs((await instance.contractAt(i))[0], erc721[i]);
            }
        });
        utils_1.IT("Should be able to deposit all", async function () {
            // Deposit everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(1));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const { skip, newBadCount, contractIndex, tokenIndex, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                badCount = newBadCount;
                if (skip) {
                    continue;
                }
                // Reduce our counts.
                if (counts[contractIndex][tokenIndex] <= 0) {
                    finished++;
                }
                await utils_2.deposit721E(vaultState, accounts[0], [erc721[contractIndex]], [tokenIndex + 1]);
            }
        });
        utils_1.IT("Should be able to withdraw all", async function () {
            // Withdraw everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(1));
            let finished = 0;
            const skips = new Set();
            let badCount = 0;
            while (finished < contractsCount * tokensPerContract && badCount < 100) {
                const { skip, newBadCount, contractIndex, tokenIndex, } = utils_2.getTokenIndexCount(skips, badCount, counts);
                badCount = newBadCount;
                if (skip) {
                    continue;
                }
                // Reduce our counts.
                if (counts[contractIndex][tokenIndex] <= 0) {
                    finished++;
                }
                await utils_2.withdraw721E(vaultState, accounts[0], [erc721[contractIndex]], [tokenIndex + 1]);
            }
        });
    }
    async function test_depositWithdrawMultiple(instanceGetter, accounts) {
        // Get the instance that we're working with.
        const FROM = utils_1.makeFROM(accounts);
        let instance;
        const erc721 = [];
        const contractsCount = 3;
        const tokensPerContract = 4;
        /** How many tokens we should try to do at once when doing a multiple deposit / withdrawal. */
        const multipleActionTarget = 5;
        let vaultState;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
            vaultState = {
                instance,
                holderCounts: new Map(),
                vaultTokenMap: new Map(),
            };
            // Get some contracts.
            const postDeployPromises = [];
            const deployPromises = await new Array(contractsCount).fill(0).map(async (_, i) => {
                // Grab, add, mint, approve.
                const _721 = await artifacts.require(`StubERC721_${i}`).deployed();
                erc721.push(_721);
                if (i > 0) {
                    postDeployPromises.push(instance.addContractAddress(_721.address, FROM[0]));
                }
                postDeployPromises.push(_721.setApprovalForAll(instance.address, true, FROM[0]));
                for (let j = 0; j < tokensPerContract; j++) {
                    postDeployPromises.push(_721.mint(accounts[0], j + 1, FROM[0]));
                }
            });
            await Promise.all(deployPromises);
            await Promise.all(postDeployPromises);
            assert.equal((await instance.size())[0], erc721.length, `Should have ${contractsCount} contracts`);
            for (let i = 0; i < erc721.length; i++) {
                utils_1.addressIs((await instance.contractAt(i))[0], erc721[i]);
            }
        });
        utils_1.IT("Should be able to deposit multiple", async function () {
            // Deposit everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(1));
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
                await utils_2.deposit721E(vaultState, accounts[0], contractIndices.map((contractIndex) => erc721[contractIndex]), tokenIndices.map((tokenIndex) => tokenIndex + 1));
            }
        });
        utils_1.IT("Should be able to withdraw multiple", async function () {
            // Withdraw everything at random.
            const counts = new Array(contractsCount).fill(0).map((_) => new Array(tokensPerContract).fill(1));
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
                await utils_2.withdraw721E(vaultState, accounts[0], contractIndices.map((contractIndex) => erc721[contractIndex]), tokenIndices.map((tokenIndex) => tokenIndex + 1));
            }
        });
    }
});
//# sourceMappingURL=Vault721EM.js.map