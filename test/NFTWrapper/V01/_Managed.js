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
    const TEST_GROUP = "_Managed";
    function label(string) {
        return `${TEST_GROUP} - ${string}`;
    }
    function runTests(instanceGetter) {
        utils_1.CONTRACT(label("freeze(), unfreeze()"), instanceGetter, test_freezing, true);
    }
    exports.runTests = runTests;
    async function test_freezing(instanceGetter, accounts) {
        // Get the instance that we're working with.
        let instance;
        utils_1.IT("Set up environment", async () => {
            instance = await instanceGetter(accounts);
        });
        utils_1.IT("Should not be able to freeze", async () => {
            await utils_1.expectReversion(instance, "Not admin", accounts[1], "freeze");
        });
        utils_1.IT("Should be able to freeze", async () => {
            await instance.freeze();
            assert.isOk(true);
        });
        utils_1.IT("Should not be able to freeze", async () => {
            await utils_1.expectReversion(instance, "Reentrancy: reentrant call", accounts[0], "freeze");
        });
        utils_1.IT("Should not be able to unfreeze", async () => {
            await utils_1.expectReversion(instance, "Not admin", accounts[1], "unfreeze");
        });
        utils_1.IT("Should be able to unfreeze", async () => {
            await instance.unfreeze();
            assert.isOk(true);
        });
        utils_1.IT("Should not be able to unfreeze", async () => {
            await utils_1.expectReversion(instance, "Reentrancy: reentrant call", accounts[0], "unfreeze");
        });
    }
});
//# sourceMappingURL=_Managed.js.map