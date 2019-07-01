const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');

module.exports = async (deployer) => {
  await deployer;
  const distribution = await deployer.deploy(Distribution, 5); // block time = 5 seconds
  deployer.deploy(ERC677BridgeToken, distribution.address);
};
