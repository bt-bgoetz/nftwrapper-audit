(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./Vault1155ER", "./Vault1155EM", "../../utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runTests = void 0;
    const VaultER = require("./Vault1155ER");
    const VaultEM = require("./Vault1155EM");
    const utils_1 = require("../../utils");
    const DEPLOYER_ARTIFACT = "Deployer1155ERM_V01";
    const VAULT_ARTIFACT = "Vault1155ERM_V01";
    function runTests() {
        VaultER.runTests(instanceGetter);
        VaultEM.runTests(instanceGetter);
    }
    exports.runTests = runTests;
    /** Deploys a new Vault1155ERM_V01. */
    async function instanceGetter(accounts) {
        const FROM = utils_1.makeFROM(accounts);
        const erc1155 = await artifacts.require("StubERC1155_0").deployed();
        const deployer = await artifacts.require(DEPLOYER_ARTIFACT).deployed();
        const result = await deployer.deploy("test", "test", 1, 1, [erc1155.address], false, false, FROM[0]);
        const vaultAddress = utils_1.normalizeAddress(result.logs[0].args.vaultAddress);
        return artifacts.require(VAULT_ARTIFACT).at(vaultAddress);
    }
});
//# sourceMappingURL=Vault1155ERM.js.map