(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./Vault721EM", "../../utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runTests = void 0;
    const VaultEM = require("./Vault721EM");
    const utils_1 = require("../../utils");
    const DEPLOYER_ARTIFACT = "Deployer721ERM_V01";
    const VAULT_ARTIFACT = "Vault721ERM_V01";
    function runTests() {
        VaultEM.runTests(instanceGetter);
    }
    exports.runTests = runTests;
    /** Deploys a new Vault721ERM_V01. */
    async function instanceGetter(accounts) {
        const FROM = utils_1.makeFROM(accounts);
        const erc721 = await artifacts.require("StubERC721_0").deployed();
        const deployer = await artifacts.require(DEPLOYER_ARTIFACT).deployed();
        const result = await deployer.deploy("test", "test", 1, 1, [erc721.address], false, false, FROM[0]);
        const vaultAddress = utils_1.normalizeAddress(result.logs[0].args.vaultAddress);
        return artifacts.require(VAULT_ARTIFACT).at(vaultAddress);
    }
});
//# sourceMappingURL=Vault721ERM.js.map