let _deployer;
function deploy(deployer, name, count) {
	if (count === undefined) {
		deployer.deploy(artifacts.require(name));

		return;
	}

	for (let i = 0; i < count; i ++) {
		deployer.deploy(artifacts.require(`${name}_${i}`));
	}
}

module.exports = async function (deployer) {
	console.log("Deploying contracts....");

	_deployer = deployer;
	
	deploy(deployer, "StubERC721", 5);
	deploy(deployer, "StubERC1155", 5);
	deploy(deployer, "Deployer721ERM_V01");
	deploy(deployer, "Deployer1155ERM_V01");

	console.log("Contracts deployed.");
};
