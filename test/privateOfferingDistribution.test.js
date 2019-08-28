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
