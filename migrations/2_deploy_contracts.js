const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');

const TOKEN_NAME = 'DPOS staking token';
const TOKEN_SYMBOL = 'DPOS';
const TOKEN_DECIMALS = 18;

module.exports = async (deployer) => {
  await deployer;
  const distribution = await deployer.deploy(Distribution, 5); // block time = 5 seconds
  deployer.deploy(
    ERC677BridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_DECIMALS,
    distribution.address
  );
};
