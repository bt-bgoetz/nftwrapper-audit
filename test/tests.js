(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./NFTWrapper/V01/Vault721ERM", "./NFTWrapper/V01/Vault1155ERM"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    require("source-map-support").install();
    const Vault721ERM_V01 = require("./NFTWrapper/V01/Vault721ERM");
    const Vault1155ERM_V01 = require("./NFTWrapper/V01/Vault1155ERM");
    Vault721ERM_V01.runTests();
    Vault1155ERM_V01.runTests();
});
//# sourceMappingURL=tests.js.map