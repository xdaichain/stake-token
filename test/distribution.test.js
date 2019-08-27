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


contract('Distribution', async accounts => {

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
        );
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
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
        });

        it('should be created', async () => {
            distribution = await createDistribution(privateOfferingDistribution.address);
        });
        it('cannot be created with wrong values', async () => {
            const defaultArgs = [
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                privateOfferingDistribution.address,
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES]
            ];
            let args;
            args = [...defaultArgs];
            args[0] = 0;
            await Distribution.new(...args).should.be.rejectedWith('staking epoch duration must be more than 0');
            args = [...defaultArgs];
            args[1] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[2] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[3] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[4] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[5] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
            args = [...defaultArgs];
            args[6] = EMPTY_ADDRESS;
            await Distribution.new(...args).should.be.rejectedWith('invalid address');
        });
    });

    describe('initialize', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
        });
        it('should be initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);

            const data = await distribution.initialize(token.address).should.be.fulfilled;
            const log = data.logs.find(item =>
                item.event === 'Initialized' && item.address.toLowerCase() === distribution.address.toLowerCase()
            );
            log.args.token.should.be.equal(token.address);
            log.args.caller.should.be.equal(owner);

            const balances = await getBalances([
                address[PUBLIC_OFFERING],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingDistribution.address,
            ]);

            balances[0].should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            balances[1].should.be.bignumber.equal(stake[EXCHANGE_RELATED_ACTIVITIES]);
            
            const privateOfferingPrepayment = calculatePercentage(stake[PRIVATE_OFFERING], PRIVATE_OFFERING_PRERELEASE);
            balances[2].should.be.bignumber.equal(privateOfferingPrepayment);

            function validateInstallmentEvent(pool, value) {
                const log = data.logs.find(item =>
                    item.event === 'InstallmentMade' && item.args.pool.toNumber() === pool
                );
                log.args.value.should.be.bignumber.equal(value);
                log.args.caller.should.be.equal(owner);
            }
            validateInstallmentEvent(PUBLIC_OFFERING, stake[PUBLIC_OFFERING]);
            validateInstallmentEvent(EXCHANGE_RELATED_ACTIVITIES, stake[EXCHANGE_RELATED_ACTIVITIES]);
            validateInstallmentEvent(PRIVATE_OFFERING, privateOfferingPrepayment);
        });
        it('cannot be initialized with not a token address', async () => {
            await distribution.initialize(accounts[9]).should.be.rejectedWith(ERROR_MSG);
        });
        it('cannot be initialized twice', async () => {
            await distribution.initialize(token.address).should.be.fulfilled;
            await distribution.initialize(token.address).should.be.rejectedWith('already initialized');
        });
        it('cannot be initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.initialize(token.address).should.be.rejectedWith('wrong contract balance');
        });
    });
    describe('unlockRewardForStaking', async () => {
        let bridge;

        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await RecipientMock.new();
            await distribution.setBridgeAddress(bridge.address).should.be.fulfilled;
        });
        async function unlock(timePastFromStart) {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(timePastFromStart).toNumber();
            await mineBlock(nextTimestamp);
            await token.approve(distribution.address, stake[REWARD_FOR_STAKING], { from: address[REWARD_FOR_STAKING] });
            const caller = randomAccount();
            const { logs } = await distribution.unlockRewardForStaking({ from: caller }).should.be.fulfilled;
            logs[0].args.bridge.should.be.equal(bridge.address);
            logs[0].args.poolAddress.should.be.equal(address[REWARD_FOR_STAKING]);
            logs[0].args.value.should.be.bignumber.equal(stake[REWARD_FOR_STAKING]);
            logs[0].args.caller.should.be.equal(caller);
            (await token.balanceOf(bridge.address)).should.be.bignumber.equal(stake[REWARD_FOR_STAKING]);
        }
        it('should be unlocked', async () => {
            await unlock(cliff[REWARD_FOR_STAKING]);
        });
        it('should be unlocked if time past more than cliff', async () => {
            await unlock(cliff[REWARD_FOR_STAKING].mul(new BN(15)));
        });
        it('should fail if bridge address is not set', async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await RecipientMock.new();
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[REWARD_FOR_STAKING]).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.unlockRewardForStaking({
                from: randomAccount()
            }).should.be.rejectedWith('invalid address');
        });
        it('should fail if tokens are not approved', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[REWARD_FOR_STAKING]).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.unlockRewardForStaking().should.be.rejectedWith('SafeMath: subtraction overflow.');
        });
        it('cannot be unlocked before time', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[REWARD_FOR_STAKING]).sub(new BN(1)).toNumber();
            await mineBlock(nextTimestamp);
            await distribution.unlockRewardForStaking({
                from: randomAccount()
            }).should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot be unlocked if not initialized', async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await distribution.unlockRewardForStaking({
                from: randomAccount()
            }).should.be.rejectedWith('not initialized');
        });
        it('cannot be unlocked twice', async () => {
            const distributionStartTimestamp = await distribution.distributionStartTimestamp();
            const nextTimestamp = distributionStartTimestamp.add(cliff[REWARD_FOR_STAKING]).toNumber();
            await mineBlock(nextTimestamp);
            await token.approve(distribution.address, stake[REWARD_FOR_STAKING], { from: address[REWARD_FOR_STAKING] });
            await distribution.unlockRewardForStaking({
                from: randomAccount()
            }).should.be.fulfilled;
            await distribution.unlockRewardForStaking({
                from: randomAccount()
            }).should.be.rejectedWith('installments are not active for this pool');
        });
    });
    describe('makeInstallment', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            address[PRIVATE_OFFERING] = privateOfferingDistribution.address;
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
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
        it.skip('should make all installments (PRIVATE_OFFERING) - 3 (time past more than cliff + all installments)', async () => {
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
    describe('changePoolAddress', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
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
    describe('setBridgeAddress', async () => {
        let bridge;

        beforeEach(async () => {
            privateOfferingDistribution = await createPrivateOfferingDistribution();
            distribution = await createDistribution(privateOfferingDistribution.address);
            token = await createToken(distribution.address, privateOfferingDistribution.address);
            await privateOfferingDistribution.setDistributionAddress(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await RecipientMock.new();
        });
        it('should be set', async () => {
            const { logs } = await distribution.setBridgeAddress(bridge.address).should.be.fulfilled;
            logs[0].args.bridge.should.be.equal(bridge.address);
            logs[0].args.caller.should.be.equal(owner);
            (await distribution.bridgeAddress()).should.be.equal(bridge.address);
        });
        it('should fail if not a contract', async () => {
            await distribution.setBridgeAddress(accounts[8]).should.be.rejectedWith('not a contract address');
        });
        it('should fail if not an owner', async () => {
            await distribution.setBridgeAddress(
                bridge.address,
                { from: accounts[8] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
    });
});
