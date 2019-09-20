const Distribution = artifacts.require('DistributionMock');
const PrivateOfferingDistribution = artifacts.require('PrivateOfferingDistribution');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
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
        PRIVATE_OFFERING_1,
        PRIVATE_OFFERING_2,
        FOUNDATION_REWARD,
        EXCHANGE_RELATED_ACTIVITIES,
        owner,
        address,
        stake,
        cliff,
        prerelease,
        SUPPLY,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
    } = require('./constants')(accounts);

    let privateOfferingDistribution_1;
    let privateOfferingDistribution_2;
    let distribution;
    let token;

    function createToken() {
        return ERC677BridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distribution.address,
            privateOfferingDistribution_1.address,
            privateOfferingDistribution_2.address
        );
    }

    async function createDistribution() {
        return Distribution.new(
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            privateOfferingDistribution_1.address,
            privateOfferingDistribution_2.address,
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
        beforeEach(async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
        });

        it('should be created', async () => {
            distribution = await createDistribution();
        });
        it('cannot be created with wrong values', async () => {
            const defaultArgs = [
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address,
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES]
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
            args[2] = accounts[9];
            await Distribution.new(...args).should.be.rejectedWith('not a contract address');
            args = [...defaultArgs];
            args[3] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[4] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
        });
    });
    describe('preInitialize', async () => {
        beforeEach(async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
        });
        it('should be pre-initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);
            (await distribution.isPreInitialized.call()).should.be.equal(false);
            (await distribution.tokensLeft.call(PUBLIC_OFFERING)).should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            (await distribution.tokensLeft.call(EXCHANGE_RELATED_ACTIVITIES)).should.be.bignumber.equal(stake[EXCHANGE_RELATED_ACTIVITIES]);
            (await distribution.preInitializationTimestamp.call()).should.be.bignumber.equal(new BN(0));

            const data = await distribution.preInitialize(token.address).should.be.fulfilled;
            const log = data.logs.find(item =>
                item.event === 'PreInitialized' && item.address.toLowerCase() === distribution.address.toLowerCase()
            );
            log.args.token.should.be.equal(token.address);
            log.args.caller.should.be.equal(owner);

            const balances = await getBalances([
                address[PUBLIC_OFFERING],
                address[EXCHANGE_RELATED_ACTIVITIES],
            ]);

            balances[0].should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            balances[1].should.be.bignumber.equal(stake[EXCHANGE_RELATED_ACTIVITIES]);

            function validatePreInstallmentEvent(pool, value) {
                const log = data.logs.find(item =>
                    item.event === 'InstallmentMade' && item.args.pool.toNumber() === pool
                );
                log.args.value.should.be.bignumber.equal(value);
                log.args.caller.should.be.equal(owner);
            }
            validatePreInstallmentEvent(PUBLIC_OFFERING, stake[PUBLIC_OFFERING]);
            validatePreInstallmentEvent(EXCHANGE_RELATED_ACTIVITIES, stake[EXCHANGE_RELATED_ACTIVITIES]);

            (await distribution.isPreInitialized.call()).should.be.equal(true);
            (await distribution.preInitializationTimestamp.call()).should.be.bignumber.above(new BN(0));
            (await distribution.tokensLeft.call(PUBLIC_OFFERING)).should.be.bignumber.equal(new BN(0));
            (await distribution.tokensLeft.call(EXCHANGE_RELATED_ACTIVITIES)).should.be.bignumber.equal(new BN(0));
            (await distribution.tokensLeft.call(PRIVATE_OFFERING_1)).should.be.bignumber.equal(stake[PRIVATE_OFFERING_1]);
            (await distribution.tokensLeft.call(PRIVATE_OFFERING_2)).should.be.bignumber.equal(stake[PRIVATE_OFFERING_2]);
        });
        it('cannot be pre-initialized with not a token address', async () => {
            await distribution.preInitialize(accounts[9]).should.be.rejectedWith(ERROR_MSG);
        });
        it('cannot be pre-initialized twice', async () => {
            await distribution.preInitialize(token.address).should.be.fulfilled;
            await distribution.preInitialize(token.address).should.be.rejectedWith('already pre-initialized');
        });
        it('cannot be initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.preInitialize(token.address).should.be.rejectedWith('wrong contract balance');
        });
        it('should fail if not an owner', async () => {
            await distribution.preInitialize(
                token.address,
                { from: randomAccount() }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
    });
    describe('initialize', async () => {
        beforeEach(async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            await privateOfferingDistribution_1.setDistributionAddress(distribution.address);
            await privateOfferingDistribution_2.setDistributionAddress(distribution.address);
            await distribution.preInitialize(token.address);
            await privateOfferingDistribution_1.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution_1.finalizeParticipants();
            await privateOfferingDistribution_2.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution_2.finalizeParticipants();
        });
        it('should be initialized', async () => {
            (await distribution.distributionStartTimestamp.call()).should.be.bignumber.equal(new BN(0));
            (await distribution.isInitialized.call()).should.be.equal(false);
            (await privateOfferingDistribution_1.isInitialized.call()).should.be.equal(false);
            (await privateOfferingDistribution_2.isInitialized.call()).should.be.equal(false);

            const data = await distribution.initialize().should.be.fulfilled;
            let log = data.logs.find(item =>
                item.event === 'Initialized' && item.address.toLowerCase() === distribution.address.toLowerCase()
            );
            log.args.caller.should.be.equal(owner);

            const privateOfferingBalance_1 = await token.balanceOf.call(privateOfferingDistribution_1.address);
            const privateOfferingPrepayment_1 = calculatePercentage(stake[PRIVATE_OFFERING_1], prerelease[PRIVATE_OFFERING_1]);
            privateOfferingBalance_1.should.be.bignumber.equal(privateOfferingPrepayment_1);

            const privateOfferingBalance_2 = await token.balanceOf.call(privateOfferingDistribution_2.address);
            const privateOfferingPrepayment_2 = calculatePercentage(stake[PRIVATE_OFFERING_2], prerelease[PRIVATE_OFFERING_2]);
            privateOfferingBalance_2.should.be.bignumber.equal(privateOfferingPrepayment_2);

            // log = data.logs.find(item => item.event === 'InstallmentMade');
            // log.args.value.should.be.bignumber.equal(privateOfferingPrepayment_1);
            // log.args.caller.should.be.equal(owner);

            (await distribution.distributionStartTimestamp.call()).should.be.bignumber.above(new BN(0));
            (await distribution.tokensLeft.call(PRIVATE_OFFERING_1)).should.be.bignumber.equal(stake[PRIVATE_OFFERING_1].sub(privateOfferingPrepayment_1));
            (await distribution.tokensLeft.call(PRIVATE_OFFERING_2)).should.be.bignumber.equal(stake[PRIVATE_OFFERING_2].sub(privateOfferingPrepayment_2));
            (await distribution.isInitialized.call()).should.be.equal(true);
            (await privateOfferingDistribution_1.isInitialized.call()).should.be.equal(true);
            (await privateOfferingDistribution_2.isInitialized.call()).should.be.equal(true);
        });
        it('cannot be initialized if not pre-initialized', async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
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
        it('should be initialized right after setting Private Offering participants', async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            await distribution.preInitialize(token.address);
            await privateOfferingDistribution_1.setDistributionAddress(distribution.address);
            await privateOfferingDistribution_2.setDistributionAddress(distribution.address);

            await privateOfferingDistribution_1.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution_1.finalizeParticipants();
            await privateOfferingDistribution_2.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution_2.finalizeParticipants();

            await distribution.initialize().should.be.fulfilled;
        });
        it('cannot be initialized if Private Offering participants are not set', async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            await distribution.preInitialize(token.address);
            await privateOfferingDistribution_1.setDistributionAddress(distribution.address);
            await privateOfferingDistribution_2.setDistributionAddress(distribution.address);

            await distribution.initialize().should.be.rejectedWith('not finalized');

            await privateOfferingDistribution_1.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await distribution.initialize().should.be.rejectedWith('not finalized');

            await privateOfferingDistribution_2.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await distribution.initialize().should.be.rejectedWith('not finalized');

            await privateOfferingDistribution_1.finalizeParticipants();
            await distribution.initialize().should.be.rejectedWith('not finalized');

            await privateOfferingDistribution_2.finalizeParticipants();
            await distribution.initialize().should.be.fulfilled;
        });
    });
    describe('changePoolAddress', async () => {
        beforeEach(async () => {
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
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
            privateOfferingDistribution_1 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await PrivateOfferingDistribution.new(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            await distribution.onTokenTransfer(
                EMPTY_ADDRESS,
                0,
                '0x'
            ).should.be.rejectedWith('sending tokens to this contract is not allowed');
        });
    });
});
