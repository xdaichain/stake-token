const fs = require('fs'); 
const papaparse = require('papaparse');

const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const Distribution = artifacts.require('Distribution');
const MultipleDistribution = artifacts.require('MultipleDistribution');

const TOKEN_NAME = 'STAKE';
const TOKEN_SYMBOL = 'STAKE';

module.exports = async deployer => {
  const csvData_1 = fs.readFileSync(process.env.PRIVATE_OFFERING_DATA_1, { encoding: 'utf8' });
  const csvData_2 = fs.readFileSync(process.env.PRIVATE_OFFERING_DATA_2, { encoding: 'utf8' });

  const privateOfferingData_1 = papaparse.parse(csvData_1, { delimiter: ',', header: true, skipEmptyLines: true }).data;
  const privateOfferingData_2 = papaparse.parse(csvData_2, { delimiter: ',', header: true, skipEmptyLines: true }).data;

  const privateOfferingParticipants_1 = privateOfferingData_1.map(item => item.participant);
  const privateOfferingParticipantsStakes_1 = privateOfferingData_1.map(item => item.stake);

  const privateOfferingParticipants_2 = privateOfferingData_2.map(item => item.participant);
  const privateOfferingParticipantsStakes_2 = privateOfferingData_2.map(item => item.stake);

  await deployer;

  const privateOfferingDistribution_1 = await deployer.deploy(MultipleDistribution, 3);
  await privateOfferingDistribution_1.addParticipants(
    privateOfferingParticipants_1,
    privateOfferingParticipantsStakes_1
  );
  await privateOfferingDistribution_1.finalizeParticipants();

  const privateOfferingDistribution_2 = await deployer.deploy(MultipleDistribution, 4);
  await privateOfferingDistribution_2.addParticipants(
    privateOfferingParticipants_2,
    privateOfferingParticipantsStakes_2
  );
  await privateOfferingDistribution_2.finalizeParticipants();

  const distribution = await deployer.deploy(
    Distribution,
    process.env.ECOSYSTEM_FUND_ADDRESS,
    process.env.PUBLIC_OFFERING_ADDRESS,
    privateOfferingDistribution_1.address,
    privateOfferingDistribution_2.address,
    process.env.FOUNDATION_REWARD_ADDRESS,
    process.env.LIQUIDITY_FUND_ADDRESS
  );

  await privateOfferingDistribution_1.setDistributionAddress(distribution.address);
  await privateOfferingDistribution_2.setDistributionAddress(distribution.address);

  const token = await deployer.deploy(
    ERC677BridgeToken,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    distribution.address,
    privateOfferingDistribution_1.address,
    privateOfferingDistribution_2.address
  );

  // await distribution.preInitialize(token.address);
  // await distribution.initialize();
};


// example
// ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 LIQUIDITY_FUND_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea PRIVATE_OFFERING_DATA_1=./example.csv PRIVATE_OFFERING_DATA_2=./example.csv ./node_modules/.bin/truffle migrate --reset
