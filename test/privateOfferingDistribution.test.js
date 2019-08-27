const Distribution = artifacts.require('DistributionMock');
const PrivateOfferingDistribution = artifacts.require('PrivateOfferingDistribution');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const RecipientMock = artifacts.require('RecipientMock');
const ERC20 = artifacts.require('ERC20');

const { mineBlock } = require('./helpers/ganache');

const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract.only('PrivateOfferingDistribution', async accounts => {

    const {
        ERROR_MSG,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        EMPTY_ADDRESS,
        STAKING_EPOCH_DURATION,
        REWARD_FOR_STAKING,
        ECOSYSTEM_FUND,
        PUBLIC_OFFERING,
        PRIVATE_OFFERING,
        FOUNDATION_REWARD,
        EXCHANGE_RELATED_ACTIVITIES,
        owner,
        address,
        stake,
        cliff,
        percentAtCliff,
        numberOfInstallments,
        PRIVATE_OFFERING_PRERELEASE,
        SUPPLY,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
    } = require('./constants')(accounts);

    let privateOfferingDistribution;
    let distribution;
    let token;

    function createToken(distributionAddress, privateOfferingDistributionAddress) {
        return ERC677BridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distributionAddress,
            privateOfferingDistributionAddress
        );
    }

    function createPrivateOfferingDistribution() {
        return PrivateOfferingDistribution.new(
            privateOfferingParticipants,
            privateOfferingParticipantsStakes,
        ).should.be.fulfilled;
    }

    async function createDistribution(privateOfferingDistributionAddress) {
        return Distribution.new(
            STAKING_EPOCH_DURATION,
            address[REWARD_FOR_STAKING],
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            privateOfferingDistributionAddress,
            address[FOUNDATION_REWARD],
            address[EXCHANGE_RELATED_ACTIVITIES]
        ).should.be.fulfilled;
    }

    function calculatePercentage(number, percentage) {
        return new BN(number).mul(new BN(percentage)).div(new BN(100));
    }

    function getBalances(addresses) {
        return Promise.all(addresses.map(addr => token.balanceOf(addr)));
    }

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomAccount() {
        return accounts[random(10, 19)];
    }

    describe('constructor', async () => {
        async function create(participants, participantsStakes) {
            privateOfferingDistribution = await PrivateOfferingDistribution.new(
                participants,
                participantsStakes,
            ).should.be.fulfilled;
            const stakes = await Promise.all(
                [...participants, EMPTY_ADDRESS].map(participant =>
                    privateOfferingDistribution.participantStake.call(participant)
                )
            );
            const sumOfStakes = participantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            const zeroAddressStake = stake[PRIVATE_OFFERING].sub(sumOfStakes);
            [...participantsStakes, zeroAddressStake].forEach((stake, index) =>
                stake.should.be.bignumber.equal(stakes[index])
            );
        }
        it('should be created', async () => {
            await create(privateOfferingParticipants, privateOfferingParticipantsStakes);
        });
        it('should be created with sum of stakes which is less than the whole pool stake', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('4500000')), new BN(toWei('2999999'))];
            await create(participants, participantsStakes);
        });
        it('should be created with 100 participants', async () => {
            const participants = await Promise.all([...Array(100)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(100)].map(() => new BN(toWei(String(random(1, 85000)))));
            await create(participants, participantsStakes);
        });
        it('cannot be created with wrong values', async () => {
            await PrivateOfferingDistribution.new(
                [accounts[6], accounts[7]],
                [toWei('1')],
            ).should.be.rejectedWith('different arrays sizes');
            await PrivateOfferingDistribution.new(
                [accounts[6], EMPTY_ADDRESS],
                [toWei('1'), toWei('1')],
            ).should.be.rejectedWith('invalid address');
            await PrivateOfferingDistribution.new(
                [accounts[6], accounts[7]],
                [toWei('1'), 0],
            ).should.be.rejectedWith('the participant stake must be more than 0');
            await PrivateOfferingDistribution.new(
                [accounts[6], accounts[7]],
                [toWei('3000000'), toWei('6000000')],
            ).should.be.rejectedWith('SafeMath: subtraction overflow.');
        });
    });
});
