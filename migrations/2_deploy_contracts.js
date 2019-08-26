const fs = require('fs'); 
const papaparse = require('papaparse');

const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');
const PrivateOfferingDistribution = artifacts.require('PrivateOfferingDistribution');

const TOKEN_NAME = 'DPOS staking token';
const TOKEN_SYMBOL = 'DPOS';
const STAKING_EPOCH_DURATION = 604800; // in seconds

module.exports = async deployer => {
  const csvData = fs.readFileSync(process.env.PRIVATE_OFFERING_DATA, { encoding: 'utf8' });
  const privateOfferingData = papaparse.parse(csvData, { delimiter: ',', header: true, skipEmptyLines: true }).data;

  const privateOfferingParticipants = privateOfferingData.map(item => item.participant);
  const privateOfferingParticipantsStakes = privateOfferingData.map(item => item.stake);

  await deployer;

  const privateOfferingDistribution = await deployer.deploy(
    PrivateOfferingDistribution,
    privateOfferingParticipants,
    privateOfferingParticipantsStakes
  );

  const distribution = await deployer.deploy(
    Distribution,
    STAKING_EPOCH_DURATION,
    process.env.REWARD_FOR_STAKING_ADDRESS,
    process.env.ECOSYSTEM_FUND_ADDRESS,
    process.env.PUBLIC_OFFERING_ADDRESS,
    privateOfferingDistribution.address,
    process.env.FOUNDATION_REWARD_ADDRESS,
    process.env.EXCHANGE_RELATED_ACTIVITIES_ADDRESS
  );

  await privateOfferingDistribution.setDistributionAddress(distribution.address);

  const token = await deployer.deploy(
    ERC677BridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    distribution.address,
    privateOfferingDistribution.address
  );

  await distribution.initialize(token.address);
};


// example
// REWARD_FOR_STAKING_ADDRESS=0xd35114b4cef03065b0fa585d1c2e15e8fb589507 ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 EXCHANGE_RELATED_ACTIVITIES_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea PRIVATE_OFFERING_DATA=./example.csv ./node_modules/.bin/truffle migrate --reset
