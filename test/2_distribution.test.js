const Distribution = artifacts.require('DistributionMock');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const ERC20 = artifacts.require('ERC20');
const EmptyContract = artifacts.require('EmptyContract');

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
    const TOKEN_NAME = 'DPOS staking token';
    const TOKEN_SYMBOL = 'DPOS';

    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
    const STAKING_EPOCH_DURATION = new BN(604800);

    const REWARD_FOR_STAKING = 1;
    const ECOSYSTEM_FUND = 2;
    const PUBLIC_OFFERING = 3;
    const PRIVATE_OFFERING = 4;
    const FOUNDATION_REWARD = 5;
    const EXCHANGE_RELATED_ACTIVITIES = 6;

    const owner = accounts[0];

    const address = {
        [REWARD_FOR_STAKING]: accounts[1],
        [ECOSYSTEM_FUND]: accounts[2],
        [PUBLIC_OFFERING]: accounts[3],
        [FOUNDATION_REWARD]: accounts[4],
        [EXCHANGE_RELATED_ACTIVITIES]: accounts[5],
    };

    const stake = {
        [REWARD_FOR_STAKING]: new BN(toWei('73000000')),
        [ECOSYSTEM_FUND]: new BN(toWei('12500000')),
        [PUBLIC_OFFERING]: new BN(toWei('1000000')),
        [PRIVATE_OFFERING]: new BN(toWei('8500000')),
        [FOUNDATION_REWARD]: new BN(toWei('4000000')),
        [EXCHANGE_RELATED_ACTIVITIES]: new BN(toWei('1000000')),
    };

    const cliff = {
        [REWARD_FOR_STAKING]: new BN(12).mul(STAKING_EPOCH_DURATION),
        [ECOSYSTEM_FUND]: new BN(48).mul(STAKING_EPOCH_DURATION),
        [PUBLIC_OFFERING]: new BN(0),
        [PRIVATE_OFFERING]: new BN(4).mul(STAKING_EPOCH_DURATION),
        [FOUNDATION_REWARD]: new BN(12).mul(STAKING_EPOCH_DURATION),
    };

    const percentAtCliff = {
        [ECOSYSTEM_FUND]: 10,
        [PRIVATE_OFFERING]: 10,
        [FOUNDATION_REWARD]: 20,
    };

    const numberOfInstallments = {
        [ECOSYSTEM_FUND]: new BN(96),
        [PRIVATE_OFFERING]: new BN(32),
        [FOUNDATION_REWARD]: new BN(36),
    };

    const PRIVATE_OFFERING_PRERELEASE = 25; // 25%

    const SUPPLY = new BN(toWei('100000000'));

    let distribution;
    let token;

    const privateOfferingParticipants = [accounts[6], accounts[7]];
    const privateOfferingParticipantsStakes = [new BN(toWei('3000000')), new BN(toWei('5500000'))];

    function createToken(distributionAddress) {
        return ERC677BridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distributionAddress,
        );
    }

    function createDistribution() {
        return Distribution.new(
            STAKING_EPOCH_DURATION,
            address[REWARD_FOR_STAKING],
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            address[FOUNDATION_REWARD],
            address[EXCHANGE_RELATED_ACTIVITIES],
            privateOfferingParticipants,
            privateOfferingParticipantsStakes
        ).should.be.fulfilled;
    }

    function getBalances(addresses) {
        return Promise.all(addresses.map(addr => token.balanceOf(addr)));
    }

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomAccount() {
        return accounts[random(0, 9)];
    }

    describe('makeInstallment', async () => {
        beforeEach(async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
        });
        async function initializeDistributionWithCustomPrivateOffering(participants, stakes) {
            distribution = await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                participants,
                stakes
            ).should.be.fulfilled;
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
        }
        async function makeAllInstallments(pool, epochsPastFromCliff = new BN(0)) {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            let nextTimestamp = distributionStartTimestamp.add(cliff[pool]).add(STAKING_EPOCH_DURATION.mul(epochsPastFromCliff));
            await mineBlock(nextTimestamp.toNumber());
            await distribution.makeInstallment(pool, { from: randomAccount() }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(stake[pool], percentAtCliff[pool]); // 10%
            let oneInstallmentValue = stake[pool].sub(valueAtCliff).div(numberOfInstallments[pool]);

            let paidValue;
            let numberOfInstallmentsMade = epochsPastFromCliff;
            if (numberOfInstallmentsMade.gt(numberOfInstallments[pool])) { // if greater
                paidValue = stake[pool];
            } else {
                paidValue = valueAtCliff.add(oneInstallmentValue.mul(numberOfInstallmentsMade));
            }

            const balanceAtFirstIntallment = await token.balanceOf(address[pool]);
            balanceAtFirstIntallment.should.be.bignumber.equal(paidValue);
            
            let lastBalance = balanceAtFirstIntallment;
            const installmentsNumber = numberOfInstallments[pool].toNumber();
            for (let i = epochsPastFromCliff.toNumber(); i < installmentsNumber;) {
                let installmentValue = oneInstallmentValue;
                let step = 1;

                if (i === Math.floor(installmentsNumber / 2)) {
                    step = Math.floor(installmentsNumber / 4); // to test that more than 1 installment will be made
                    installmentValue = oneInstallmentValue.mul(new BN(step));
                }
                if (i === installmentsNumber - 1) {
                    step = 5; // to test that there will be no more installments than available
                    installmentValue = await distribution.tokensLeft(pool);
                }
                nextTimestamp = nextTimestamp.add(STAKING_EPOCH_DURATION.mul(new BN(step)));
                await mineBlock(nextTimestamp.toNumber());

                const caller = randomAccount();
                const { logs } = await distribution.makeInstallment(pool, { from: caller }).should.be.fulfilled;
                logs[0].args.pool.toNumber().should.be.equal(pool);
                logs[0].args.value.should.be.bignumber.equal(installmentValue);
                logs[0].args.caller.should.be.equal(caller);
                
                const newBalance = await token.balanceOf(address[pool]);
                newBalance.should.be.bignumber.equal(lastBalance.add(installmentValue));
                lastBalance = newBalance;

                i += step;
            }
            (await token.balanceOf(address[pool])).should.be.bignumber.equal(stake[pool]);
        }
        it('should make all installments (ECOSYSTEM_FUND) - 1', async () => {
            const args = [ECOSYSTEM_FUND, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(ECOSYSTEM_FUND);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (ECOSYSTEM_FUND) - 2 (time past more than cliff)', async () => {
            const args = [ECOSYSTEM_FUND, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(ECOSYSTEM_FUND, new BN(5));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (ECOSYSTEM_FUND) - 3 (time past more than cliff + all installments)', async () => {
            const args = [ECOSYSTEM_FUND, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const epochsPastFromCliff = numberOfInstallments[ECOSYSTEM_FUND].add(new BN(5));
            await makeAllInstallments(ECOSYSTEM_FUND, epochsPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (FOUNDATION_REWARD) - 1', async () => {
            const args = [FOUNDATION_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(FOUNDATION_REWARD);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (FOUNDATION_REWARD) - 2 (time past more than cliff)', async () => {
            const args = [FOUNDATION_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(FOUNDATION_REWARD, new BN(5));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (FOUNDATION_REWARD) - 3 (time past more than cliff + all installments)', async () => {
            const args = [FOUNDATION_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const epochsPastFromCliff = numberOfInstallments[FOUNDATION_REWARD].add(new BN(5));
            await makeAllInstallments(FOUNDATION_REWARD, epochsPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        async function makeInstallmentsForPrivateOffering(
            privateOfferingParticipants,
            privateOfferingParticipantsStakes,
            epochsPastFromCliff = new BN(0)
        ) {
            const prereleaseValue = calculatePercentage(stake[PRIVATE_OFFERING], PRIVATE_OFFERING_PRERELEASE); // 25%
            const valueAtCliff = calculatePercentage(stake[PRIVATE_OFFERING], percentAtCliff[PRIVATE_OFFERING]); // 10%
            const installmentValue = stake[PRIVATE_OFFERING].sub(valueAtCliff).sub(prereleaseValue).div(numberOfInstallments[PRIVATE_OFFERING]);
            
            let balances = await getBalances(privateOfferingParticipants);

            let nextTimestamp = await distribution.distributionStartTimestamp();

            async function makeInstallmentForPrivateOffering(value, interval, isLast) {
                if (isLast) {
                    interval = interval.mul(new BN(5)); // to test that there will be no more installments than available
                }
                nextTimestamp = nextTimestamp.add(interval);
                await mineBlock(nextTimestamp.toNumber());
                const caller = randomAccount();
                const { logs } = await distribution.makeInstallment(
                    PRIVATE_OFFERING,
                    { from: caller }
                ).should.be.fulfilled;
                logs[0].args.pool.toNumber().should.be.equal(PRIVATE_OFFERING);
                logs[0].args.value.should.be.bignumber.equal(value);
                logs[0].args.caller.should.be.equal(caller);
                const participantsStakes = privateOfferingParticipantsStakes.map(partStake =>
                    value.mul(partStake).div(stake[PRIVATE_OFFERING])
                );
                const newBalances = await getBalances(privateOfferingParticipants);
                newBalances.forEach((newBalance, index) => {
                    newBalance.should.be.bignumber.equal(balances[index].add(participantsStakes[index]));
                });
                balances = newBalances;
            }

            let firstInstallmentValue;
            let numberOfInstallmentsMade = epochsPastFromCliff;
            if (numberOfInstallmentsMade.gt(numberOfInstallments[PRIVATE_OFFERING])) { // if greater
                firstInstallmentValue = stake[PRIVATE_OFFERING].sub(prereleaseValue);
            } else {
                firstInstallmentValue = valueAtCliff.add(installmentValue.mul(numberOfInstallmentsMade));
            }
            const interval = cliff[PRIVATE_OFFERING].add(STAKING_EPOCH_DURATION.mul(epochsPastFromCliff));
            await makeInstallmentForPrivateOffering(firstInstallmentValue, interval);

            for (let i = epochsPastFromCliff.toNumber(); i < numberOfInstallments[PRIVATE_OFFERING].toNumber(); i++) {
                let value = installmentValue;
                if (i === numberOfInstallments[PRIVATE_OFFERING].toNumber() - 1) {
                    value = await distribution.tokensLeft(PRIVATE_OFFERING);
                }
                const isLast = i === numberOfInstallments[PRIVATE_OFFERING].toNumber() - 1;
                await makeInstallmentForPrivateOffering(value, STAKING_EPOCH_DURATION, isLast);
            }

            (await distribution.tokensLeft(PRIVATE_OFFERING)).should.be.bignumber.equal(new BN(0));

            await distribution.makeInstallment(
                PRIVATE_OFFERING,
                { from: randomAccount() }
            ).should.be.rejectedWith('installments are not active for this pool');
        }
        it('should make all installments (PRIVATE_OFFERING) - 1', async () => {
            await makeInstallmentsForPrivateOffering(
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            );
        });
        it('should make all installments (PRIVATE_OFFERING) - 2 (time past more than cliff)', async () => {
            await makeInstallmentsForPrivateOffering(
                privateOfferingParticipants,
                privateOfferingParticipantsStakes,
                new BN(5)
            );
        });
        it('should make all installments (PRIVATE_OFFERING) - 3 (time past more than cliff + all installments)', async () => {
            await makeInstallmentsForPrivateOffering(
                privateOfferingParticipants,
                privateOfferingParticipantsStakes,
                numberOfInstallments[PRIVATE_OFFERING].add(new BN(5))
            );
        });
        it('should make all installments (PRIVATE_OFFERING) - 4', async () => {
            const participants = [accounts[0], accounts[6], accounts[7], accounts[8], accounts[9]];
            const stakes = [
                new BN(toWei('1')),
                new BN(toWei('2')),
                new BN(toWei('3')),
                new BN(toWei('4')),
                new BN(toWei('5')),
            ];

            await initializeDistributionWithCustomPrivateOffering(participants, stakes);
            await makeInstallmentsForPrivateOffering(participants, stakes);
        });
        it('should make all installments (PRIVATE_OFFERING) - 5', async () => {
            const participants = [accounts[6], accounts[7]];
            const stakes = [
                new BN(toWei('8499999')),
                new BN(toWei('1')),
            ];

            await initializeDistributionWithCustomPrivateOffering(participants, stakes);
            await makeInstallmentsForPrivateOffering(participants, stakes);
        });
        it('should make all installments (PRIVATE_OFFERING) - 6', async () => {
            const participants = [accounts[6]];
            const stakes = [new BN(toWei('8499999'))];

            await initializeDistributionWithCustomPrivateOffering(participants, stakes);
            await makeInstallmentsForPrivateOffering(participants, stakes);
        });
        it('should make all installments (PRIVATE_OFFERING) - 7', async () => {
            const participants = await Promise.all([...Array(50)].map(() => web3.eth.personal.newAccount()));
            const stakes = [...Array(50)].map(() => new BN(random(1, 85000)));

            await initializeDistributionWithCustomPrivateOffering(participants, stakes);
            await makeInstallmentsForPrivateOffering(participants, stakes);
        });
        it('cannot make installment if not initialized', async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('not initialized');
            await distribution.initialize(token.address).should.be.fulfilled;
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
        });
        it('cannot make installment for wrong pool', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.makeInstallment(7).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(0).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
        });
        it('should revert if no installments available', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('no installments available');
        });
    });
});
