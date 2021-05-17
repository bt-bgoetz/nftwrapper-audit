(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.numberIs = exports.normalizeAddress = exports.expectReversion = exports.getContractAt = exports.addressIs = exports.logGas = exports.makeFROM = exports.IT = exports.CONTRACT = exports.SKIP_TEST = void 0;
    const GAS_PRICE = 90;
    const ETH_VALUE = 750;
    /** The mapping of contract name and address to deployed contract. Keys are `${contractName}-${contractAddress}` */
    const DEPLOYED_CONTRACT_MAP = {};
    /** The current test's position within a given testing group. */
    let TEST_COUNT = 0;
    /** Readable skip flag. */
    exports.SKIP_TEST = true;
    /** Wraps Mocha.contract so we can reset the test #. */
    function CONTRACT(label, instanceGetter, testingGroup, skip) {
        TEST_COUNT = 0;
        if (skip === true) {
            return;
        }
        contract(label, (accounts) => testingGroup(instanceGetter, accounts));
    }
    exports.CONTRACT = CONTRACT;
    /** Wraps Mocha.it so we can insert the test #. */
    function IT(label, callback) {
        it(`${(++TEST_COUNT).toLocaleString()} | ${label}`, callback);
    }
    exports.IT = IT;
    /** Generates the FROM statements for all provided accounts. */
    function makeFROM(accounts) {
        return accounts.map((account) => ({ from: account }));
    }
    exports.makeFROM = makeFROM;
    function logGas(name, gas) {
        const fiat = Math.round(gas * GAS_PRICE * ETH_VALUE / 10000000) / 100;
        let decimal = `${fiat - Math.floor(fiat)}`;
        if (decimal.length === 1) {
            decimal = ".00";
        }
        else if (decimal.length === 3) {
            decimal += "0";
        }
        else {
            decimal = `.${decimal.slice(2, 4)}`;
        }
        console.log(`\t${name}():`, gas, `\$${Math.floor(fiat).toLocaleString()}${decimal}`);
    }
    exports.logGas = logGas;
    /** Adds assertions to make sure the two addresses match. */
    function addressIs(addressA, addressB, assertionMessage) {
        assert.equal(normalizeAddress(addressA), normalizeAddress(addressB), assertionMessage);
    }
    exports.addressIs = addressIs;
    /** Returns the deployed contract, caching for faster retrievals. */
    async function getContractAt(contractName, address) {
        const contractId = `${contractName}-${address}`;
        let contract = DEPLOYED_CONTRACT_MAP[contractId];
        if (contract !== undefined) {
            return contract;
        }
        contract = await artifacts.require(contractName).at(address);
        DEPLOYED_CONTRACT_MAP[contractId] = contract;
        return contract;
    }
    exports.getContractAt = getContractAt;
    /**
     * Calls a function that is expecting a specific reversion.
     *
     * @param revertReason Can be the empty string if no revert message is expected.
     */
    async function expectReversion(instance, revertReason, from, method, ...args) {
        if (revertReason === "") {
            revertReason = "invalid opcode";
        }
        try {
            await instance[method](...args, { from });
        }
        catch (error) {
            if (!error.message.includes(revertReason)) {
                assert.equal(error.message, revertReason);
            }
            else {
                assert.isOk(true);
                return;
            }
        }
        assert.isNotOk(true, `${method}(...[${args.length}]) did not revert`);
    }
    exports.expectReversion = expectReversion;
    function normalizeAddress(address) {
        if (isDeployedContract(address)) {
            address = address.address;
        }
        // Convert it to hex if it's a BigNumber.
        if (typeof address !== "string") {
            address = address.toString(16);
        }
        // Make sure it's prefixed with 0x.
        if (address.slice(0, 2) !== "0x") {
            address = address.padStart(40, "0");
            address = `0x${address}`;
        }
        // Make sure it's lowercase.
        return address.toLowerCase();
    }
    exports.normalizeAddress = normalizeAddress;
    /** Adds assertions that the two values are equal. */
    async function numberIs(instance, target, assertionMessage, method, ...args) {
        const value = await instance[method](...args);
        try {
            assert.equal(value.toNumber(), target, assertionMessage);
        }
        catch (error) {
            if (error.message.includes("AssertionError")) {
                throw error;
            }
            assert.isNotOk(true, error.message);
        }
    }
    exports.numberIs = numberIs;
    function isDeployedContract(contract) {
        return contract.address !== undefined;
    }
});
//# sourceMappingURL=utils.js.map