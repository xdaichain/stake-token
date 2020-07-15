const Distribution = artifacts.require('DistributionMock');
const MultipleDistribution = artifacts.require('MultipleDistribution');
const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken');

const { BN } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Distribution', async accounts => {

    const {
        TOKEN_NAME,
        TOKEN_SYMBOL,
        DAY_IN_SECONDS,
        ECOSYSTEM_FUND,
        PUBLIC_OFFERING,
        PRIVATE_OFFERING,
        ADVISORS_REWARD,
        FOUNDATION_REWARD,
        LIQUIDITY_FUND,
        INITIAL_STAKE_AMOUNT,
        address,
        stake,
        cliff,
        SUPPLY,
        percentAtCliff,
        numberOfInstallments,
        prerelease,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
        advisorsRewardParticipants,
        advisorsRewardParticipantsStakes
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

    async function createMultipleDistribution() {
        const contract = await MultipleDistribution.new().should.be.fulfilled;
        await contract.finalizeParticipants();
        return contract;
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

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomAccount() {
        return accounts[random(10, 19)];
    }

    describe('makeInstallment', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            address[PRIVATE_OFFERING] = privateOfferingDistribution.address;
            address[ADVISORS_REWARD] = advisorsRewardDistribution.address;
            distribution = await createDistribution();
            token = await createToken();
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await privateOfferingDistribution.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants();
            await advisorsRewardDistribution.setDistributionAddress(distribution.address);
            await advisorsRewardDistribution.addParticipants(advisorsRewardParticipants, advisorsRewardParticipantsStakes);
            await advisorsRewardDistribution.finalizeParticipants();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.fulfilled;
            await distribution.initialize().should.be.fulfilled;
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        async function makeAllInstallments(pool, daysPastFromCliff = new BN(0)) {
            let prepaymentValue = new BN(0);
            if (pool === PRIVATE_OFFERING) {
                prepaymentValue = calculatePercentage(stake[pool], prerelease[pool]);
            }
            const distributionStartTimestamp = await distribution.distributionStartTimestamp.call();
            let nextTimestamp = distributionStartTimestamp.add(cliff[pool]).add(DAY_IN_SECONDS.mul(daysPastFromCliff));
            await distribution.setTimestamp(nextTimestamp);
            await distribution.makeInstallment(pool, { from: randomAccount() }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(stake[pool], percentAtCliff[pool]);
            let oneInstallmentValue = stake[pool].sub(valueAtCliff).sub(prepaymentValue).div(numberOfInstallments[pool]);

            let paidValue;
            let numberOfInstallmentsMade = daysPastFromCliff;
            if (numberOfInstallmentsMade.gt(numberOfInstallments[pool])) { // if greater
                paidValue = stake[pool];
            } else {
                paidValue = valueAtCliff.add(prepaymentValue).add(oneInstallmentValue.mul(numberOfInstallmentsMade));
            }

            const balanceAtFirstIntallment = await token.balanceOf(address[pool]);
            balanceAtFirstIntallment.should.be.bignumber.equal(paidValue);
            
            let lastBalance = balanceAtFirstIntallment;
            const installmentsNumber = numberOfInstallments[pool].toNumber();
            for (let i = numberOfInstallmentsMade.toNumber(); i < installmentsNumber;) {
                let installmentValue = oneInstallmentValue;
                let step = 1;

                if (i === Math.floor(installmentsNumber / 2)) {
                    step = Math.floor(installmentsNumber / 4); // to test that more than 1 installment will be made
                    installmentValue = oneInstallmentValue.mul(new BN(step));
                }
                if (i === installmentsNumber - 1) {
                    step = 5; // to test that there will be no more installments than available
                    const installmentsValue = numberOfInstallments[pool].sub(new BN(1)).mul(oneInstallmentValue);
                    paidValue =  valueAtCliff.add(prepaymentValue).add(installmentsValue);
                    installmentValue = stake[pool].sub(paidValue);
                }
                nextTimestamp = nextTimestamp.add(DAY_IN_SECONDS.mul(new BN(step)));
                await distribution.setTimestamp(nextTimestamp);                

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
            (await distribution.tokensLeft(pool)).should.be.bignumber.equal(new BN(0));
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
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
            const daysPastFromCliff = numberOfInstallments[ECOSYSTEM_FUND].add(new BN(5));
            await makeAllInstallments(ECOSYSTEM_FUND, daysPastFromCliff);
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
            await makeAllInstallments(FOUNDATION_REWARD, new BN(11));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (FOUNDATION_REWARD) - 3 (time past more than cliff + all installments)', async () => {
            const args = [FOUNDATION_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const daysPastFromCliff = numberOfInstallments[FOUNDATION_REWARD].add(new BN(5));
            await makeAllInstallments(FOUNDATION_REWARD, daysPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING) - 1', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(PRIVATE_OFFERING);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING) - 2 (time past more than cliff)', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(PRIVATE_OFFERING, new BN(44));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING) - 3 (time past more than cliff + all installments)', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const daysPastFromCliff = numberOfInstallments[PRIVATE_OFFERING].add(new BN(5));
            await makeAllInstallments(PRIVATE_OFFERING, daysPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (ADVISORS_REWARD) - 1', async () => {
            const args = [ADVISORS_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(ADVISORS_REWARD);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (ADVISORS_REWARD) - 2 (time past more than cliff)', async () => {
            const args = [ADVISORS_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(ADVISORS_REWARD, new BN(44));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (ADVISORS_REWARD) - 3 (time past more than cliff + all installments)', async () => {
            const args = [ADVISORS_REWARD, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const daysPastFromCliff = numberOfInstallments[ADVISORS_REWARD].add(new BN(5));
            await makeAllInstallments(ADVISORS_REWARD, daysPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot make installment if not initialized', async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await privateOfferingDistribution.addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants();
            await advisorsRewardDistribution.setDistributionAddress(distribution.address);
            await advisorsRewardDistribution.finalizeParticipants();
            await distribution.preInitialize(token.address, INITIAL_STAKE_AMOUNT).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('not initialized');
            await distribution.initialize().should.be.fulfilled;
            const distributionStartTimestamp = await distribution.distributionStartTimestamp.call();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await distribution.setTimestamp(nextTimestamp);
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
        });
        it('cannot make installment for wrong pool', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp.call();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await distribution.setTimestamp(nextTimestamp);
            await distribution.makeInstallment(7).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(0).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
        });
        it('should revert if no installments available', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp.call();
            const nextTimestamp = distributionStartTimestamp.add(cliff[PRIVATE_OFFERING]).toNumber();
            await distribution.setTimestamp(nextTimestamp);
            await distribution.makeInstallment(PRIVATE_OFFERING, { from: randomAccount() }).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('no installments available');
        });
    });
});
