const fs = require('fs'); 
const papaparse = require('papaparse');

const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');
const MultipleDistribution = artifacts.require('MultipleDistribution');

const TOKEN_NAME = 'STAKE';
const TOKEN_SYMBOL = 'STAKE';

module.exports = async deployer => {
  const csvPrivateOfferingData = fs.readFileSync(process.env.PRIVATE_OFFERING_DATA, { encoding: 'utf8' });
  const privateOfferingData = papaparse.parse(csvPrivateOfferingData, { delimiter: ',', header: true, skipEmptyLines: true }).data;
  const privateOfferingParticipants = privateOfferingData.map(item => item.participant);
  const privateOfferingParticipantsStakes = privateOfferingData.map(item => item.stake);

  await deployer;

  const privateOfferingDistribution = await deployer.deploy(MultipleDistribution, 3);
  await privateOfferingDistribution.addParticipants(
    privateOfferingParticipants,
    privateOfferingParticipantsStakes
  );
  await privateOfferingDistribution.finalizeParticipants();

  const distribution = await deployer.deploy(
    Distribution,
    process.env.ECOSYSTEM_FUND_ADDRESS,
    process.env.PUBLIC_OFFERING_ADDRESS,
    privateOfferingDistribution.address,
    process.env.FOUNDATION_REWARD_ADDRESS,
    process.env.LIQUIDITY_FUND_ADDRESS
  );

  await privateOfferingDistribution.setDistributionAddress(distribution.address);

  const token = await deployer.deploy(
    ERC677BridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    distribution.address,
    privateOfferingDistribution.address
  );

  // await distribution.preInitialize(token.address);
  // await distribution.initialize();
};


// example
// ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 LIQUIDITY_FUND_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea PRIVATE_OFFERING_DATA=./example.csv ./node_modules/.bin/truffle migrate --reset
