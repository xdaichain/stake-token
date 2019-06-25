const ERC677BridgeTokenRewardable = artifacts.require('ERC677BridgeTokenRewardable');

module.exports = function(deployer) {
  deployer.deploy(ERC677BridgeTokenRewardable, 'DPOS staking token', 'DPOS', 18);
};
