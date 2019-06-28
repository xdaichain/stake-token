const Distribution = artifacts.require('Distribution');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');

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
    let distribution;
    let token;

    beforeEach(async () => {
        distribution = await Distribution.new();
        token = await ERC677BridgeToken.new(distribution.address);
    });

    describe('initialize', async () => {
        it('should be initialized', async () => {
            const privateOfferingParticipants = [accounts[4], accounts[5]];
            const privateOfferingParticipantsStakes = [40, 60];

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
                calculatePercentage(privateOfferingPrepayment, privateOfferingParticipantsStakes[0]),
                calculatePercentage(privateOfferingPrepayment, privateOfferingParticipantsStakes[1])
            ];
            (await token.balanceOf(accounts[4])).should.be.bignumber.equal(privateOfferingPrepaymentValues[0]);
            (await token.balanceOf(accounts[5])).should.be.bignumber.equal(privateOfferingPrepaymentValues[1]);
        });
    });
});
