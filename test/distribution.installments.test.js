const Distribution = artifacts.require('DistributionMock');
const PrivateOfferingDistribution = artifacts.require('PrivateOfferingDistribution');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');

const { mineBlock } = require('./helpers/ganache');

const { BN } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Distribution', async accounts => {

    const {
        TOKEN_NAME,
        TOKEN_SYMBOL,
        STAKING_EPOCH_DURATION,
        REWARD_FOR_STAKING,
        ECOSYSTEM_FUND,
        PUBLIC_OFFERING,
        PRIVATE_OFFERING,
        FOUNDATION_REWARD,
        EXCHANGE_RELATED_ACTIVITIES,
        address,
        stake,
        cliff,
        percentAtCliff,
        numberOfInstallments,
        PRIVATE_OFFERING_PRERELEASE,
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

    async function createPrivateOfferingDistribution() {
        const contract = await PrivateOfferingDistribution.new().should.be.fulfilled;
        await contract.finalizeParticipants();
        return contract;
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

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomAccount() {
        return accounts[random(10, 19)];
    }

    describe('makeInstallment', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            address[PRIVATE_OFFERING] = privateOfferingDistribution.address;
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.preInitialize(token.address).should.be.fulfilled;
            await distribution.initialize().should.be.fulfilled;
        });
        async function makeAllInstallments(pool, epochsPastFromCliff = new BN(0)) {
            let prepaymentValue = new BN(0);
            if (pool === PRIVATE_OFFERING) {
                prepaymentValue = calculatePercentage(stake[PRIVATE_OFFERING], PRIVATE_OFFERING_PRERELEASE);
            }
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            let nextTimestamp = distributionStartTimestamp.add(cliff[pool]).add(STAKING_EPOCH_DURATION.mul(epochsPastFromCliff));
            await mineBlock(nextTimestamp.toNumber());
            await distribution.makeInstallment(pool, { from: randomAccount() }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(stake[pool], percentAtCliff[pool]);
            let oneInstallmentValue = stake[pool].sub(valueAtCliff).sub(prepaymentValue).div(numberOfInstallments[pool]);

            let paidValue;
            let numberOfInstallmentsMade = epochsPastFromCliff;
            if (numberOfInstallmentsMade.gt(numberOfInstallments[pool])) { // if greater
                paidValue = stake[pool];
            } else {
                paidValue = valueAtCliff.add(prepaymentValue).add(oneInstallmentValue.mul(numberOfInstallmentsMade));
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
                    const installmentsValue = numberOfInstallments[pool].sub(new BN(1)).mul(oneInstallmentValue);
                    paidValue =  valueAtCliff.add(prepaymentValue).add(installmentsValue);
                    installmentValue = stake[pool].sub(paidValue);
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
            (await distribution.tokensLeft(pool)).should.be.bignumber.equal(new BN(0));
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
        it('should make all installments (PRIVATE_OFFERING) - 1', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(PRIVATE_OFFERING);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING) - 2 (time past more than cliff)', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(PRIVATE_OFFERING, new BN(5));
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING) - 3 (time past more than cliff + all installments)', async () => {
            const args = [PRIVATE_OFFERING, { from: randomAccount() }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            const epochsPastFromCliff = numberOfInstallments[PRIVATE_OFFERING].add(new BN(5));
            await makeAllInstallments(PRIVATE_OFFERING, epochsPastFromCliff);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot make installment if not initialized', async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.preInitialize(token.address).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('not initialized');
            await distribution.initialize().should.be.fulfilled;
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
