const assert = require('assert');
const fs = require('fs');
const papaparse = require('papaparse');

const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken');
const Distribution = artifacts.require('Distribution');
const MultipleDistribution = artifacts.require('MultipleDistribution');

const TOKEN_NAME = 'STAKE';
const TOKEN_SYMBOL = 'STAKE';

module.exports = async deployer => {
  const csvPrivateOfferingData = fs.readFileSync(process.env.PRIVATE_OFFERING_DATA, { encoding: 'utf8' });
  const privateOfferingData = papaparse.parse(csvPrivateOfferingData, { delimiter: ',', header: true, skipEmptyLines: true }).data;
  const privateOfferingParticipants = privateOfferingData.map(item => item.participant);
  const privateOfferingParticipantsStakes = privateOfferingData.map(item => item.stake);

  const csvAdvisorsRewardData = fs.readFileSync(process.env.ADVISORS_REWARD_DATA, { encoding: 'utf8' });
  const advisorsRewardData = papaparse.parse(csvAdvisorsRewardData, { delimiter: ',', header: true, skipEmptyLines: true }).data;
  const advisorsRewardParticipants = advisorsRewardData.map(item => item.participant);
  const advisorsRewardParticipantsStakes = advisorsRewardData.map(item => item.stake);

  await deployer;

  const privateOfferingDistribution = await deployer.deploy(MultipleDistribution, 3);
  await privateOfferingDistribution.addParticipants(
    privateOfferingParticipants,
    privateOfferingParticipantsStakes
  );
  await privateOfferingDistribution.finalizeParticipants();

  const advisorsRewardDistribution = await deployer.deploy(MultipleDistribution, 4);
  await advisorsRewardDistribution.addParticipants(
    advisorsRewardParticipants,
    advisorsRewardParticipantsStakes
  );
  await advisorsRewardDistribution.finalizeParticipants();

  assert((await privateOfferingDistribution.getParticipants.call()).length > 0);
  assert((await advisorsRewardDistribution.getParticipants.call()).length > 0);
  assert(await privateOfferingDistribution.isFinalized.call());
  assert(await advisorsRewardDistribution.isFinalized.call());

  const distribution = await deployer.deploy(
    Distribution,
    process.env.ECOSYSTEM_FUND_ADDRESS,
    process.env.PUBLIC_OFFERING_ADDRESS,
    privateOfferingDistribution.address,
    advisorsRewardDistribution.address,
    process.env.FOUNDATION_REWARD_ADDRESS,
    process.env.LIQUIDITY_FUND_ADDRESS
  );

  await privateOfferingDistribution.setDistributionAddress(distribution.address);
  await advisorsRewardDistribution.setDistributionAddress(distribution.address);

  assert(await privateOfferingDistribution.distributionAddress.call() == distribution.address);
  assert(await advisorsRewardDistribution.distributionAddress.call() == distribution.address);

  const token = await deployer.deploy(
    ERC677MultiBridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    distribution.address,
    privateOfferingDistribution.address,
    advisorsRewardDistribution.address
  );

  //await distribution.preInitialize(token.address, process.env.INITIAL_STAKE_AMOUNT);
  //await distribution.initialize();
  //assert(await distribution.isInitialized.call());
};

// Example:
// ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 LIQUIDITY_FUND_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea INITIAL_STAKE_AMOUNT=220000000000000000000000 PRIVATE_OFFERING_DATA=./example.csv ADVISORS_REWARD_DATA=./example.csv ./node_modules/.bin/truffle migrate --reset
