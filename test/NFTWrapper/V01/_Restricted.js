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
    exports.runTests = void 0;
    const utils_1 = require("../../utils");
    const TEST_GROUP = "_Restricted";
    function label(string) {
        return `${TEST_GROUP} - ${string}`;
    }
    function runTests(instanceGetter) {
        utils_1.CONTRACT(label("setRoles(), getRoles()"), instanceGetter, test_setRoles_getRoles);
    }
    exports.runTests = runTests;
    /** Check to make sure that we can set the role flags correctly. */
    async function test_setRoles_getRoles(instanceGetter, accounts) {
        // Get the instance that we're working with.
        let instance;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
        });
        utils_1.IT("Owner should have full permissions", async () => {
            await expectRole(instance, accounts[0], 0x7);
        });
        utils_1.IT("Other should have no permissions", async () => {
            await expectRole(instance, accounts[1], 0x0);
        });
        utils_1.IT("Should be able to set admin only", async () => {
            await instance.setRoles([accounts[1]], true, true, false, false);
            await expectRole(instance, accounts[1], 0x4);
        });
        utils_1.IT("Should be able to unset admin", async () => {
            await instance.setRoles([accounts[1]], false, true, false, false);
            await expectRole(instance, accounts[1], 0x0);
        });
        utils_1.IT("Should be able to set each individually", async () => {
            const isDepositor = 0x1;
            const isWithdrawer = 0x2;
            const isAdmin = 0x4;
            for (let i = 0x1; i <= 0x7; i++) {
                // Set the role
                await instance.setRoles([accounts[1]], true, (i & isAdmin) === isAdmin, (i & isDepositor) === isDepositor, (i & isWithdrawer) === isWithdrawer);
                await expectRole(instance, accounts[1], i);
                // Clear the role
                await instance.setRoles([accounts[1]], false, true, true, true);
                await expectRole(instance, accounts[1], 0x0);
            }
        });
        utils_1.IT("Vault should not be role restricted", async () => {
            await utils_1.numberIs(instance, 0, "", "getRoleRestrictions");
        });
        utils_1.IT("Should be able to set role restrictiveness", async () => {
            const restrictDeposits = 0x1;
            const restrictWithdrawals = 0x2;
            for (let i = 0x1; i <= 0x3; i++) {
                // Set the role
                await instance.changeRoleRestrictions((i & restrictDeposits) === restrictDeposits, (i & restrictWithdrawals) === restrictWithdrawals);
                await utils_1.numberIs(instance, i, "", "getRoleRestrictions");
                // Clear the role
                await instance.changeRoleRestrictions(false, false);
                await utils_1.numberIs(instance, 0, "", "getRoleRestrictions");
            }
        });
    }
    async function expectRole(instance, account, role) {
        return utils_1.numberIs(instance, role, "Expected role to match", "getRoles", account);
    }
});
//# sourceMappingURL=_Restricted.js.map