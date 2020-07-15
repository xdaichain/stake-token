const Distribution = artifacts.require('DistributionMock');
const MultipleDistribution = artifacts.require('MultipleDistribution');
const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken');
const ERC20 = artifacts.require('ERC20');

const { BN } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Distribution', async accounts => {

    const {
        ERROR_MSG,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        EMPTY_ADDRESS,
        ECOSYSTEM_FUND,
        PUBLIC_OFFERING,
        PRIVATE_OFFERING,
        ADVISORS_REWARD,
        FOUNDATION_REWARD,
        LIQUIDITY_FUND,
        INITIAL_STAKE_AMOUNT,
        owner,
        address,
        stake,
        cliff,
        SUPPLY,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
    } = require('./utils/constants')(accounts);

    let privateOfferingDistribution;
    let advisorsRewardDistribution;
    let distribution;
    let token;

    function createToken() {
        return ERC677MultiBridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distribution.address,
            privateOfferingDistribution.address,
            advisorsRewardDistribution.address
        );
    }

    async function createDistribution() {
        return Distribution.new(
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            privateOfferingDistribution.address,
            advisorsRewardDistribution.address,
            address[FOUNDATION_REWARD],
            address[LIQUIDITY_FUND]
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
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
        });

        it('should be created', async () => {
            distribution = await createDistribution();
        });
        it('cannot be created with wrong values', async () => {
            const defaultArgs = [
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address,
                address[FOUNDATION_REWARD],
                address[LIQUIDITY_FUND]
            ];
            let args;
            args = [...defaultArgs];
            args[0] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[1] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[2] = accounts[9];
            await Distribution.new(...args).should.be.rejectedWith('not a contract address');
            args = [...defaultArgs];
            args[3] = accounts[9];
            await Distribution.new(...args).should.be.rejectedWith('not a contract address');
            args = [...defaultArgs];
            args[4] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[5] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
        });
    });
    describe('preInitialize', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            await privateOfferingDistribution.finalizeParticipants();
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await advisorsRewardDistribution.finalizeParticipants();
            await advisorsRewardDistribution.setDistributionAddress(distribution.address);
        });
        it('should be pre-initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);
            (await distribution.isPreInitialized.call()).should.be.equal(false);
            (await distribution.tokensLeft.call(PUBLIC_OFFERING)).should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            (await distribution.tokensLeft.call(PRIVATE_OFFERING)).should.be.bignumber.equal(stake[PRIVATE_OFFERING]);
            (await distribution.tokensLeft.call(LIQUIDITY_FUND)).should.be.bignumber.equal(stake[LIQUIDITY_FUND]);
            (await distribution.preInitializationTimestamp.call()).should.be.bignumber.equal(new BN(0));

            const data = await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.fulfilled;
            const log = data.logs.find(item =>
                item.event === 'PreInitialized' && item.address.toLowerCase() === distribution.address.toLowerCase()
            );
            log.args.token.should.be.equal(token.address);
            log.args.caller.should.be.equal(owner);

            const privateOfferingPrerelease = stake[PRIVATE_OFFERING].mul(new BN(25)).div(new BN(100));

            const balances = await getBalances([
                address[PUBLIC_OFFERING],
                privateOfferingDistribution.address,
                address[LIQUIDITY_FUND],
                '0x0000000000000000000000000000000000000000'
            ]);

            balances[0].should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            balances[1].should.be.bignumber.equal(privateOfferingPrerelease);
            balances[2].should.be.bignumber.equal(stake[LIQUIDITY_FUND].sub(INITIAL_STAKE_AMOUNT));
            balances[3].should.be.bignumber.equal(INITIAL_STAKE_AMOUNT);

            function validatePreInstallmentEvent(pool, value) {
                const log = data.logs.find(item =>
                    item.event === 'InstallmentMade' && item.args.pool.toNumber() === pool
                );
                log.args.value.should.be.bignumber.equal(value);
                log.args.caller.should.be.equal(owner);
            }
            validatePreInstallmentEvent(PUBLIC_OFFERING, stake[PUBLIC_OFFERING]);
            validatePreInstallmentEvent(PRIVATE_OFFERING, privateOfferingPrerelease);
            validatePreInstallmentEvent(LIQUIDITY_FUND, stake[LIQUIDITY_FUND].sub(INITIAL_STAKE_AMOUNT));
            validatePreInstallmentEvent(0, INITIAL_STAKE_AMOUNT);

            (await distribution.isPreInitialized.call()).should.be.equal(true);
            (await distribution.preInitializationTimestamp.call()).should.be.bignumber.above(new BN(0));
            (await distribution.tokensLeft.call(PUBLIC_OFFERING)).should.be.bignumber.equal(new BN(0));
            (await distribution.tokensLeft.call(LIQUIDITY_FUND)).should.be.bignumber.equal(new BN(0));
            (await distribution.tokensLeft.call(PRIVATE_OFFERING)).should.be.bignumber.equal(stake[PRIVATE_OFFERING].sub(privateOfferingPrerelease));
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('cannot be pre-initialized with not a token address', async () => {
            await distribution.preInitialize(accounts[9], INITIAL_STAKE_AMOUNT).should.be.rejectedWith(ERROR_MSG);
        });
        it('cannot be pre-initialized twice', async () => {
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.fulfilled;
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.rejectedWith('already pre-initialized');
        });
        it('cannot be pre-initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.rejectedWith('wrong contract balance');
        });
        it('should fail if not an owner', async () => {
            await distribution.preInitialize(
                token.address,
                INITIAL_STAKE_AMOUNT,
                { from: randomAccount() }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('cannot be pre-initialized if Private Offering or Advisors Reward participants are not finalized', async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();

            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await advisorsRewardDistribution.setDistributionAddress(distribution.address);

            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.rejectedWith('not finalized');

            await privateOfferingDistribution.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.rejectedWith('not finalized');

            await privateOfferingDistribution.finalizeParticipants();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.rejectedWith('not finalized');

            await advisorsRewardDistribution.finalizeParticipants();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT);
        });
    });
    describe('initialize', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await privateOfferingDistribution.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants();
            await advisorsRewardDistribution.setDistributionAddress(distribution.address);
            await advisorsRewardDistribution.finalizeParticipants();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT);
        });
        it('should be initialized', async () => {
            (await distribution.distributionStartTimestamp.call()).should.be.bignumber.equal(new BN(0));
            (await distribution.isInitialized.call()).should.be.equal(false);
            (await privateOfferingDistribution.isInitialized.call()).should.be.equal(true);
            (await advisorsRewardDistribution.isInitialized.call()).should.be.equal(true);

            const data = await distribution.initialize().should.be.fulfilled;
            let log = data.logs.find(item =>
                item.event === 'Initialized' && item.address.toLowerCase() === distribution.address.toLowerCase()
            );
            log.args.caller.should.be.equal(owner);

            (await distribution.distributionStartTimestamp.call()).should.be.bignumber.above(new BN(0));
            (await distribution.isInitialized.call()).should.be.equal(true);
        });
        it('cannot be initialized if not pre-initialized', async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();

            await distribution.initialize().should.be.rejectedWith('not pre-initialized');
        });
        it('cannot be initialized twice', async () => {
            await distribution.initialize().should.be.fulfilled;
            await distribution.initialize().should.be.rejectedWith('already initialized');
        });
        it('should fail if not an owner first 90 days', async () => {
            await distribution.initialize(
                { from: randomAccount() }
            ).should.be.rejectedWith('for now only owner can call this method');
        });
        it('can be initialized by anyone after 90 days', async () => {
            const account = randomAccount();

            await distribution.initialize(
                { from: account }
            ).should.be.rejectedWith('for now only owner can call this method');

            const preInitializationTimestamp = await distribution.preInitializationTimestamp.call();
            const timePast = new BN(90 * 24 * 60 * 60); // 90 days in seconds
            const nextTimestamp = preInitializationTimestamp.add(timePast).toNumber();
            await distribution.setTimestamp(nextTimestamp);

            await distribution.initialize({ from: account }).should.be.fulfilled;
        });
    });
    describe('changePoolAddress', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
        });
        it('should be changed', async () => {
            async function changeAddress(pool, newAddress) {
                const { logs } = await distribution.changePoolAddress(
                    pool,
                    newAddress,
                    { from: address[pool] },
                ).should.be.fulfilled;
                logs[0].args.pool.toNumber().should.be.equal(pool);
                logs[0].args.oldAddress.should.be.equal(address[pool]);
                logs[0].args.newAddress.should.be.equal(newAddress);
                (await distribution.poolAddress(pool)).should.be.equal(newAddress);
            }
            await changeAddress(ECOSYSTEM_FUND, accounts[8]);
            await changeAddress(FOUNDATION_REWARD, accounts[9]);
        });
        it('should fail if wrong pool', async () => {
            await distribution.changePoolAddress(7, accounts[8]).should.be.rejectedWith('wrong pool');
            await distribution.changePoolAddress(0, accounts[8]).should.be.rejectedWith('wrong pool');
        });
        it('should fail if not authorized', async () => {
            await distribution.changePoolAddress(
                ECOSYSTEM_FUND,
                accounts[8],
            ).should.be.rejectedWith('not authorized');
            await distribution.changePoolAddress(
                FOUNDATION_REWARD,
                accounts[8],
            ).should.be.rejectedWith('not authorized');
        });
        it('should fail if invalid address', async () => {
            await distribution.changePoolAddress(
                ECOSYSTEM_FUND,
                EMPTY_ADDRESS,
                { from: address[ECOSYSTEM_FUND] },
            ).should.be.rejectedWith('invalid address');
        });
    });
    describe('onTokenTransfer', () => {
        it('should fail (not allowed)', async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            await distribution.onTokenTransfer(
                EMPTY_ADDRESS,
                0,
                '0x'
            ).should.be.rejectedWith('sending tokens to this contract is not allowed');
        });
    });
});
