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
    const owner = accounts[0];
    const SUPPLY = new BN(toWei('100000000'));
    const REWARD_FOR_STAKING = new BN(toWei('73000000'));
    const ECOSYSTEM_FUND = new BN(toWei('15000000'));
    const PUBLIC_OFFERING = new BN(toWei('4000000'));
    const PRIVATE_OFFERING = new BN(toWei('4000000'));
    const FOUNDATION_REWARD = new BN(toWei('4000000'));
    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
    const BLOCK_TIME = 5; // in seconds
    const STAKING_EPOCH_DURATION = (7 * 24 * 60 * 60) / BLOCK_TIME; // 1 week in blocks
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
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;

            (await token.balanceOf(accounts[2])).should.be.bignumber.equal(PUBLIC_OFFERING);

            const privateOfferingPrepayment = calculatePercentage(PRIVATE_OFFERING, 35);
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
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith(ERROR_MSG);
            await distribution.initialize(
                token.address,
                EMPTY_ADDRESS,
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                accounts[1],
                EMPTY_ADDRESS,
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                EMPTY_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                [EMPTY_ADDRESS, accounts[5]],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                [accounts[4], EMPTY_ADDRESS],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                [toWei('1000000'), toWei('4000000')]    // sum is not equal to PRIVATE_OFFERING
            ).should.be.rejectedWith('wrong sum of values');
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                [accounts[4]],                          // different arrays sizes
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('different arrays sizes');
        });
        it('cannot be initialized twice', async () => {
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('already initialized');
        });
        it('cannot be initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
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
                accounts[1],
                accounts[2],
                accounts[3],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
        });
        it('should be unlocked', async () => {
            const cliff = new BN(12 * STAKING_EPOCH_DURATION + 1);
            const distributionStartBlock = await distribution.distributionStartBlock()
            await distribution.setBlock(distributionStartBlock.add(cliff));
            await distribution.unlockRewardForStaking(accounts[8]).should.be.fulfilled;
        });
    });
});
