(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../../utils", "./_Restricted"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runTests = void 0;
    const utils_1 = require("../../utils");
    const Restricted = require("./_Restricted");
    const TEST_GROUP = "Vault1155ER";
    function label(string) {
        return `${TEST_GROUP} - ${string}`;
    }
    function runTests(instanceGetter) {
        Restricted.runTests(instanceGetter);
        utils_1.CONTRACT(label("deposit()"), instanceGetter, test_restrictedDeposits);
        utils_1.CONTRACT(label("withdrawAny()"), instanceGetter, test_restrictedWithdrawals);
    }
    exports.runTests = runTests;
    /** Here we test to make sure that role-restricted deposits are rejected. */
    async function test_restrictedDeposits(instanceGetter, accounts) {
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
            // Enable deposit restrictions.
            await instance.changeRoleRestrictions(true, false);
        });
        utils_1.IT("Should be able to mint tokens", async () => {
            // We give one token each to two accounts, the first is authorized the second not.
            for (let i = 0; i < 2; i++) {
                await utils_1.numberIs(erc1155, 0, "", "balanceOf", accounts[i], 1);
                await erc1155.mint(accounts[i], 1, 10);
                await utils_1.numberIs(erc1155, 10, "", "balanceOf", accounts[i], 1);
            }
        });
        utils_1.IT("Should be able to deposit", async () => {
            // Do initial deposit.
            await utils_1.numberIs(instance, 0, "", "balanceOf", accounts[0]);
            await instance.deposit(accounts[0], [erc1155.address], [1], [1], FROM[0]);
            await utils_1.numberIs(instance, 1, "", "balanceOf", accounts[0]);
            // Deposit same token again.
            await utils_1.numberIs(instance, 1, "", "balanceOf", accounts[0]);
            await instance.deposit(accounts[0], [erc1155.address], [1], [1], FROM[0]);
            await utils_1.numberIs(instance, 2, "", "balanceOf", accounts[0]);
        });
        utils_1.IT("Should not be able to deposit", async () => {
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[1], "deposit", accounts[1], [erc1155.address], [1], [1]);
        });
        utils_1.IT("Should be able to deposit after gaining permission", async () => {
            await instance.setRoles([accounts[1]], true, false, true, false, FROM[0]);
            // Deposit
            await utils_1.numberIs(instance, 0, "", "balanceOf", accounts[1]);
            await instance.deposit(accounts[1], [erc1155.address], [1], [1], FROM[1]);
            await utils_1.numberIs(instance, 1, "", "balanceOf", accounts[1]);
        });
        utils_1.IT("Should not be able to deposit again", async () => {
            await instance.setRoles([accounts[1]], false, false, true, false, FROM[0]);
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[1], "deposit", accounts[1], [erc1155.address], [1], [1]);
        });
    }
    /** Here we test to make sure that role-restricted withdrawals are rejected. */
    async function test_restrictedWithdrawals(instanceGetter, accounts) {
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
            // Enable withdrawal restrictions.
            await instance.changeRoleRestrictions(false, true);
        });
        utils_1.IT("Should be able to mint tokens", async () => {
            // We give one token each to two accounts, the first is authorized the second not.
            for (let i = 0; i < 2; i++) {
                await utils_1.numberIs(erc1155, 0, "", "balanceOf", accounts[i], 1);
                await erc1155.mint(accounts[i], 1, 10);
                await utils_1.numberIs(erc1155, 10, "", "balanceOf", accounts[i], 1);
            }
        });
        utils_1.IT("Should be able to do initial deposit", async () => {
            // Do an initial deposit so we can test withdrawals.
            await utils_1.numberIs(instance, 0, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155, 10, "", "balanceOf", accounts[0], 1);
            await instance.deposit(accounts[0], [erc1155.address], [1], [8], FROM[0]);
            await utils_1.numberIs(instance, 8, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155, 2, "", "balanceOf", accounts[0], 1);
            // Check the token details.
            const [fakeAddress, id, count] = await instance.tokenAt(0);
            utils_1.addressIs(fakeAddress, erc1155, "Contract should match");
            assert.equal(id.toNumber(), 1, "ID should match");
            assert.equal(count.toNumber(), 8, "Count should match");
            // Also send sone of the tokens to the other account so we can test for withdrawals.
            await instance.transfer(accounts[1], 3, FROM[0]);
            await utils_1.numberIs(instance, 5, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(instance, 3, "", "balanceOf", accounts[1]);
            await utils_1.numberIs(erc1155, 2, "", "balanceOf", accounts[0], 1);
        });
        utils_1.IT("Should be able to withdraw", async () => {
            await utils_1.numberIs(instance, 0, "", "getTokenIndex", erc1155.address, 1);
            await utils_1.numberIs(instance, 5, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155, 2, "", "balanceOf", accounts[0], 1);
            await instance.withdrawTokens(accounts[0], [erc1155.address], [1], [1], FROM[0]);
            await utils_1.numberIs(instance, 4, "", "balanceOf", accounts[0]);
            await utils_1.numberIs(erc1155, 3, "", "balanceOf", accounts[0], 1);
            // Check the token details.
            const [fakeAddress, id, count] = await instance.tokenAt(0);
            utils_1.addressIs(fakeAddress, erc1155, "Contract should match");
            assert.equal(id.toNumber(), 1, "ID should match");
            assert.equal(count.toNumber(), 7, "Count should match");
        });
        utils_1.IT("Should not be able to withdraw", async () => {
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[1], "withdrawTokens", accounts[1], [erc1155.address], [1], [1]);
        });
        utils_1.IT("Should be able to withdraw after gaining permission", async () => {
            await instance.setRoles([accounts[1]], true, false, false, true, FROM[0]);
            // Withdraw
            await utils_1.numberIs(instance, 3, "", "balanceOf", accounts[1]);
            await utils_1.numberIs(erc1155, 10, "", "balanceOf", accounts[1], 1);
            await instance.withdrawTokens(accounts[1], [erc1155.address], [1], [1], FROM[1]);
            await utils_1.numberIs(instance, 2, "", "balanceOf", accounts[1]);
            await utils_1.numberIs(erc1155, 11, "", "balanceOf", accounts[1], 1);
            // Check the token details.
            const [fakeAddress, id, count] = await instance.tokenAt(0);
            utils_1.addressIs(fakeAddress, erc1155, "Contract should match");
            assert.equal(id.toNumber(), 1, "ID should match");
            assert.equal(count.toNumber(), 6, "Count should match");
        });
        utils_1.IT("Should not be able to withdraw again", async () => {
            await instance.setRoles([accounts[1]], false, false, false, true, FROM[0]);
            await utils_1.expectReversion(instance, "Invalid parameters", accounts[1], "withdrawTokens", accounts[1], [erc1155.address], [1], [1]);
        });
    }
});
//# sourceMappingURL=Vault1155ER.js.map