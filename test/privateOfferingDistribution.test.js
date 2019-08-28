const Distribution = artifacts.require('DistributionMock');
const PrivateOfferingDistribution = artifacts.require('PrivateOfferingDistribution');
const PrivateOfferingDistributionMock = artifacts.require('PrivateOfferingDistributionMock');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const RecipientMock = artifacts.require('RecipientMock');
const ERC20 = artifacts.require('ERC20');
const EmptyContract = artifacts.require('EmptyContract');

const { mineBlock } = require('./helpers/ganache');

const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('PrivateOfferingDistribution', async accounts => {

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
        return PrivateOfferingDistribution.new().should.be.fulfilled;
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

    async function addParticipants(participants, participantsStakes) {
        await privateOfferingDistribution.addParticipants(participants, participantsStakes).should.be.fulfilled;
        const stakes = await Promise.all(participants.map(participant =>
            privateOfferingDistribution.participantStake.call(participant)
        ));
        participantsStakes.forEach((stake, index) => stake.should.be.bignumber.equal(stakes[index]));
    }

    async function addAndFinalizedParticipants(participants, participantsStakes) {
        await privateOfferingDistribution.addParticipants(participants, participantsStakes).should.be.fulfilled;
        await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
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

    describe('addParticipants', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await PrivateOfferingDistributionMock.new().should.be.fulfilled;
        });
        it('should be added', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
        });
        it('should be added 50 participants', async () => {
            const participants = await Promise.all([...Array(50)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(50)].map(() => new BN(toWei(String(random(1, 170000)))));
            await addParticipants(participants, participantsStakes);
        });
        it('cannot be added with wrong values', async () => {
            await privateOfferingDistribution.addParticipants(
                [accounts[6], accounts[7]],
                [toWei('1')],
            ).should.be.rejectedWith('different arrays sizes');
            await privateOfferingDistribution.addParticipants(
                [accounts[6], EMPTY_ADDRESS],
                [toWei('1'), toWei('1')],
            ).should.be.rejectedWith('invalid address');
            await privateOfferingDistribution.addParticipants(
                [accounts[6], accounts[7]],
                [toWei('1'), 0],
            ).should.be.rejectedWith('the participant stake must be more than 0');
            await privateOfferingDistribution.addParticipants(
                [accounts[6], accounts[7]],
                [toWei('3000000'), toWei('6000000')],
            ).should.be.rejectedWith('wrong sum of values');

            await privateOfferingDistribution.addParticipants(
                [accounts[6], accounts[7]],
                [toWei('3000000'), toWei('4000000')],
            ).should.be.fulfilled;
            await privateOfferingDistribution.addParticipants(
                [accounts[8], accounts[9]],
                [toWei('1000000'), toWei('2000000')],
            ).should.be.rejectedWith('wrong sum of values');
        });
        it('cannot be added if finalized', async () => {
            const participants = await Promise.all([...Array(10)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(10)].map(() => new BN(toWei(String(random(1, 850000)))));
            await privateOfferingDistribution.addParticipants(
                participants.slice(0, 5),
                participantsStakes.slice(0, 5)
            ).should.be.fulfilled;
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            await privateOfferingDistribution.addParticipants(
                participants.slice(5, 10),
                participantsStakes.slice(5, 10)
            ).should.be.rejectedWith('already finalized');
        });
    });
    describe('finalizeParticipants', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await PrivateOfferingDistributionMock.new().should.be.fulfilled;
        });
        it('should be finalized', async () => {
            await addAndFinalizedParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
        });
        it('should be finalized with sum of stakes which is less than the whole pool stake', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('4500000')), new BN(toWei('2999999'))];
            await addAndFinalizedParticipants(participants, participantsStakes);
        });
        it('should be finalized with 500 participants', async () => {
            const participants = await Promise.all([...Array(500)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(500)].map(() => new BN(toWei(String(random(1, 17000)))));
            await addParticipants(participants.slice(0, 50), participantsStakes.slice(0, 50));
            await addParticipants(participants.slice(50, 100), participantsStakes.slice(50, 100));
            await addParticipants(participants.slice(100, 150), participantsStakes.slice(100, 150));
            await addParticipants(participants.slice(150, 200), participantsStakes.slice(150, 200));
            await addParticipants(participants.slice(200, 250), participantsStakes.slice(200, 250));
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
        });
        it('cannot be finalized twice', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            await privateOfferingDistribution.finalizeParticipants().should.be.rejectedWith('already finalized');
        });
    });
    describe('initialize', async () => {
        let distributionAddress = owner;
        beforeEach(async () => {
            privateOfferingDistribution = await PrivateOfferingDistributionMock.new().should.be.fulfilled;
            await privateOfferingDistribution.setDistributionAddress(distributionAddress);
            await privateOfferingDistribution.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants();
        });
        it('should be initialized', async () => {
            const { logs } = await privateOfferingDistribution.initialize(accounts[9]).should.be.fulfilled;
            logs[0].args.token.should.be.equal(accounts[9]);
            logs[0].args.caller.should.be.equal(distributionAddress);
        });
        it('should fail if sender is not a distribution address', async () => {
            await privateOfferingDistribution.initialize(
                accounts[9],
                { from: accounts[8] }
            ).should.be.rejectedWith('wrong sender');
        });
        it('cannot be initialized twice', async () => {
            await privateOfferingDistribution.initialize(accounts[9]).should.be.fulfilled;
            await privateOfferingDistribution.initialize(accounts[9]).should.be.rejectedWith('already initialized');
        });
    });
    describe('setDistributionAddress', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distributuon = await createDistribution(privateOfferingDistribution.address);
        });
        it('should be set', async () => {
            await privateOfferingDistribution.setDistributionAddress(distributuon.address).should.be.fulfilled;
        });
        it('cannot be set twice', async () => {
            await privateOfferingDistribution.setDistributionAddress(
                distributuon.address
            ).should.be.fulfilled;
            await privateOfferingDistribution.setDistributionAddress(
                distributuon.address
            ).should.be.rejectedWith('already set');
        });
        it('should fail if not an owner', async () => {
            await privateOfferingDistribution.setDistributionAddress(
                distributuon.address,
                { from: accounts[9] }
            ).should.be.rejectedWith('Ownable: caller is not the owner.');
        });
        it('should fail if not the Distribution contract address', async () => {
            await privateOfferingDistribution.setDistributionAddress(
                accounts[9]
            ).should.be.rejectedWith('revert');

            const contract = await EmptyContract.new();
            await privateOfferingDistribution.setDistributionAddress(
                contract.address
            ).should.be.rejectedWith('revert');

            const anotherPrivateOfferingDistribution = await createPrivateOfferingDistribution();
            const distribution = await createDistribution(anotherPrivateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(
                distribution.address
            ).should.be.rejectedWith('wrong address');
        });
    });
});
