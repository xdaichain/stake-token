const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');

const { toWei } = web3.utils;

const TOKEN_NAME = 'DPOS staking token';
const TOKEN_SYMBOL = 'DPOS';
const TOKEN_DECIMALS = 18;
const STAKING_EPOCH_DURATION = 120960;

module.exports = async (deployer, network, accounts) => {
  const REWARD_FOR_STAKING_ADDRESS = accounts[1];
  const ECOSYSTEM_FUND_ADDRESS = accounts[2];
  const PUBLIC_OFFERING_ADDRESS = accounts[3];
  const FOUNDATION_REWARD_ADDRESS = accounts[4];
  const EXCHANGE_RELATED_ACTIVITIES_ADDRESS = accounts[5];
  const privateOfferingParticipants = [accounts[6], accounts[7]];
  const privateOfferingParticipantsStakes = [toWei('3000000'), toWei('5500000')];
  const bridgeAddress = accounts[8];

  await deployer;

  const distribution = await deployer.deploy(
    Distribution,
    STAKING_EPOCH_DURATION,
    bridgeAddress,
    REWARD_FOR_STAKING_ADDRESS,
    ECOSYSTEM_FUND_ADDRESS,
    PUBLIC_OFFERING_ADDRESS,
    FOUNDATION_REWARD_ADDRESS,
    EXCHANGE_RELATED_ACTIVITIES_ADDRESS,
    privateOfferingParticipants,
    privateOfferingParticipantsStakes
  );

  const token = await deployer.deploy(
    ERC677BridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_DECIMALS,
    distribution.address
  );

  await distribution.initialize(token.address);
};
