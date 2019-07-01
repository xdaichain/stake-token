const Distribution = artifacts.require('DistributionMock');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const ERC20 = artifacts.require('ERC20');

const { mineBlock } = require('./helpers/ganache');

const ERROR_MSG = 'VM Exception while processing transaction: revert';
const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();

function calculatePercentage(number, percentage) {
    return new BN(number).mul(new BN(percentage)).div(new BN(100));
}


contract('Distribution', async accounts => {
    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
    const BLOCK_TIME = 5; // in seconds
    const STAKING_EPOCH_DURATION = new BN((7 * 24 * 60 * 60) / BLOCK_TIME); // 1 week in blocks

    const owner = accounts[0];
    const ECOSYSTEM_FUND_ADDRESS = accounts[1];
    const PUBLIC_OFFERING_ADDRESS = accounts[2];
    const FOUNDATION_ADDRESS = accounts[3];

    const SUPPLY = new BN(toWei('100000000'));
    const REWARD_FOR_STAKING = new BN(toWei('73000000'));
    const ECOSYSTEM_FUND = new BN(toWei('15000000'));
    const PUBLIC_OFFERING = new BN(toWei('4000000'));
    const PRIVATE_OFFERING = new BN(toWei('4000000'));
    const FOUNDATION_REWARD = new BN(toWei('4000000'));

    const REWARD_FOR_STAKING_CLIFF = new BN(12).mul(STAKING_EPOCH_DURATION);
    const ECOSYSTEM_FUND_CLIFF = new BN(48).mul(STAKING_EPOCH_DURATION);
    const FOUNDATION_REWARD_CLIFF = new BN(12).mul(STAKING_EPOCH_DURATION);

    const ECOSYSTEM_FUND_PERCENT_AT_CLIFF = 10;
    const PRIVATE_OFFERING_PERCENT_AT_CLIFF = 35;
    const FOUNDATION_REWARD_PERCENT_AT_CLIFF = 20;

    const ECOSYSTEM_FUND_INSTALLMENTS_NUMBER = new BN(96);
    const PRIVATE_OFFERING_INSTALLMENTS_NUMBER = new BN(36);
    const FOUNDATION_REWARD_INSTALLMENTS_NUMBER = new BN(48);

    let distribution;
    let token;

    const privateOfferingParticipants = [accounts[4], accounts[5]];
    const privateOfferingParticipantsStakes = [new BN(toWei('1000000')), new BN(toWei('3000000'))];

    describe('initialize', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(BLOCK_TIME);
            token = await ERC677BridgeToken.new(distribution.address);
        });
        it('should be initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);

            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;

            (await token.balanceOf(PUBLIC_OFFERING_ADDRESS)).should.be.bignumber.equal(PUBLIC_OFFERING);

            const privateOfferingPrepayment = calculatePercentage(PRIVATE_OFFERING, PRIVATE_OFFERING_PERCENT_AT_CLIFF);
            const privateOfferingPrepaymentValues = [
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[0]).div(PRIVATE_OFFERING),
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[1]).div(PRIVATE_OFFERING),
            ];
            (await token.balanceOf(accounts[4])).should.be.bignumber.equal(privateOfferingPrepaymentValues[0]);
            (await token.balanceOf(accounts[5])).should.be.bignumber.equal(privateOfferingPrepaymentValues[1]);
        });
        it('cannot be initialized with wrong values', async () => {
            await distribution.initialize(
                accounts[9],                            // not a token address
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith(ERROR_MSG);
            await distribution.initialize(
                token.address,
                EMPTY_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                EMPTY_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                EMPTY_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                [EMPTY_ADDRESS, accounts[5]],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                [accounts[4], EMPTY_ADDRESS],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                [toWei('1000000'), toWei('4000000')]    // sum is not equal to PRIVATE_OFFERING
            ).should.be.rejectedWith('wrong sum of values');
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                [accounts[4]],                          // different arrays sizes
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('different arrays sizes');
        });
        it('cannot be initialized twice', async () => {
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('already initialized');
        });
        it('cannot be initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('wrong contract balance');
        });
    });
    describe('unlockRewardForStaking', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(BLOCK_TIME);
            token = await ERC677BridgeToken.new(distribution.address);
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
        });
        it('should be unlocked', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock()
            const newBlockNumber = distributionStartBlock.add(REWARD_FOR_STAKING_CLIFF).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.fulfilled;
            (await token.balanceOf(accounts[8])).should.be.bignumber.equal(REWARD_FOR_STAKING);
        });
        it('cannot be unlocked before time', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(REWARD_FOR_STAKING_CLIFF);
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot be unlocked if not initialized', async () => {
            distribution = await Distribution.new(BLOCK_TIME);
            token = await ERC677BridgeToken.new(distribution.address);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('not initialized');
        });
        it('cannot be unlocked twice', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(REWARD_FOR_STAKING_CLIFF).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.fulfilled;
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('installments are not active for this pool');
        });
        it('can be unlocked only by owner', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(REWARD_FOR_STAKING_CLIFF).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8], { from: accounts[9] }).should.be.rejectedWith('Ownable: caller is not the owner');
            await distribution.unlockRewardForStaking(accounts[8], { from: owner }).should.be.fulfilled;
        });
        it('cannot be sent to invalid bridge address', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(REWARD_FOR_STAKING_CLIFF).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(EMPTY_ADDRESS).should.be.rejectedWith('invalid address');
        });
    });
    describe('makeInstallment', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(BLOCK_TIME);
            token = await ERC677BridgeToken.new(distribution.address);
            await distribution.initialize(
                token.address,
                ECOSYSTEM_FUND_ADDRESS,
                PUBLIC_OFFERING_ADDRESS,
                FOUNDATION_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
        });
        it('should be made (ECOSYSTEM_FUND)', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const cliffBlock = distributionStartBlock.add(ECOSYSTEM_FUND_CLIFF);
            await distribution.setBlock(cliffBlock.add(new BN(1)));
            await distribution.makeInstallment(2, { from: ECOSYSTEM_FUND_ADDRESS }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(ECOSYSTEM_FUND, ECOSYSTEM_FUND_PERCENT_AT_CLIFF); // 10%
            const balanceAtCliff = await token.balanceOf(ECOSYSTEM_FUND_ADDRESS);
            balanceAtCliff.should.be.bignumber.equal(valueAtCliff);

            await distribution.setBlock(cliffBlock.add(STAKING_EPOCH_DURATION));
            await distribution.makeInstallment(2, { from: ECOSYSTEM_FUND_ADDRESS }).should.be.fulfilled;
            const installmentValue = ECOSYSTEM_FUND.sub(valueAtCliff).div(ECOSYSTEM_FUND_INSTALLMENTS_NUMBER);
            (await token.balanceOf(ECOSYSTEM_FUND_ADDRESS)).should.be.bignumber.equal(balanceAtCliff.add(installmentValue));
        });
        it('should be made (FOUNDATION_REWARD)', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const cliffBlock = distributionStartBlock.add(FOUNDATION_REWARD_CLIFF);
            await distribution.setBlock(cliffBlock.add(new BN(1)));
            await distribution.makeInstallment(5, { from: FOUNDATION_ADDRESS }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(FOUNDATION_REWARD, FOUNDATION_REWARD_PERCENT_AT_CLIFF); // 20%
            const balanceAtCliff = await token.balanceOf(FOUNDATION_ADDRESS);
            balanceAtCliff.should.be.bignumber.equal(valueAtCliff);

            await distribution.setBlock(cliffBlock.add(STAKING_EPOCH_DURATION));
            await distribution.makeInstallment(5, { from: FOUNDATION_ADDRESS }).should.be.fulfilled;
            const installmentValue = FOUNDATION_REWARD.sub(valueAtCliff).div(FOUNDATION_REWARD_INSTALLMENTS_NUMBER);
            (await token.balanceOf(FOUNDATION_ADDRESS)).should.be.bignumber.equal(balanceAtCliff.add(installmentValue));
        });
    });
});
