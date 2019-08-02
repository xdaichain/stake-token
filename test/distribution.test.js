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
    const STAKING_EPOCH_DURATION = new BN(120960);

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

    describe('constructor', async () => {
        it('should be created', async () => {
            await createDistribution();
        });
        it('cannot be created with wrong values', async () => {
            await Distribution.new(
                0,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('staking epoch duration must be more than 0');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                EMPTY_ADDRESS,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                EMPTY_ADDRESS,
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                EMPTY_ADDRESS,
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                EMPTY_ADDRESS,
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                EMPTY_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                [EMPTY_ADDRESS, accounts[5]],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                [accounts[4], EMPTY_ADDRESS],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                [toWei('4000000'), toWei('5000000')]    // sum is bigger than Private Offering stake
            ).should.be.rejectedWith('the sum of participants stakes is more than the whole stake');
            await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                [accounts[4]],                          // different arrays sizes
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('different arrays sizes');
        });
        it('should be created with modified Private Offering stake', async () => {
            const newParticipantsStakes = [new BN(toWei('3000000')), new BN(toWei('2500000'))];
            distribution = await Distribution.new(
                STAKING_EPOCH_DURATION,
                address[REWARD_FOR_STAKING],
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants,
                newParticipantsStakes
            ).should.be.fulfilled;

            const realPrivateOfferingStake = newParticipantsStakes[0].add(newParticipantsStakes[1]);
            const expectedEcosystemFund = stake[ECOSYSTEM_FUND].add(stake[PRIVATE_OFFERING]).sub(realPrivateOfferingStake);

            (await distribution.stake(PRIVATE_OFFERING)).should.be.bignumber.equal(realPrivateOfferingStake);
            (await distribution.stake(ECOSYSTEM_FUND)).should.be.bignumber.equal(expectedEcosystemFund);
        });
    });

    describe('initialize', async () => {
        beforeEach(async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
        });
        it('should be initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);

            const { logs } = await distribution.initialize(token.address).should.be.fulfilled;
            logs[0].args.token.should.be.equal(token.address);
            logs[0].args.caller.should.be.equal(owner);

            const balances = await getBalances([
                address[PUBLIC_OFFERING],
                address[EXCHANGE_RELATED_ACTIVITIES],
                privateOfferingParticipants[0],
                privateOfferingParticipants[1],
            ]);

            balances[0].should.be.bignumber.equal(stake[PUBLIC_OFFERING]);
            balances[1].should.be.bignumber.equal(stake[EXCHANGE_RELATED_ACTIVITIES]);

            const privateOfferingPrepayment = calculatePercentage(stake[PRIVATE_OFFERING], PRIVATE_OFFERING_PRERELEASE);
            const privateOfferingPrepaymentValues = [
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[0]).div(stake[PRIVATE_OFFERING]),
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[1]).div(stake[PRIVATE_OFFERING]),
            ];
            balances[2].should.be.bignumber.equal(privateOfferingPrepaymentValues[0]);
            balances[3].should.be.bignumber.equal(privateOfferingPrepaymentValues[1]);

            function validateInstallmentEvent(index, pool, value) {
                logs[index].args.pool.toNumber().should.be.equal(pool);
                logs[index].args.value.should.be.bignumber.equal(value);
                logs[index].args.caller.should.be.equal(owner);
            }
            validateInstallmentEvent(1, PUBLIC_OFFERING, stake[PUBLIC_OFFERING]);
            validateInstallmentEvent(2, EXCHANGE_RELATED_ACTIVITIES, stake[EXCHANGE_RELATED_ACTIVITIES]);
            validateInstallmentEvent(3, PRIVATE_OFFERING, privateOfferingPrepayment);
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
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await EmptyContract.new();
            await distribution.setBridgeAddress(bridge.address).should.be.fulfilled;
        });
        it('should be unlocked', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock()
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await token.approve(distribution.address, stake[REWARD_FOR_STAKING], { from: address[REWARD_FOR_STAKING] });
            const { logs } = await distribution.unlockRewardForStaking().should.be.fulfilled;
            logs[0].args.bridge.should.be.equal(bridge.address);
            logs[0].args.poolAddress.should.be.equal(address[REWARD_FOR_STAKING]);
            logs[0].args.value.should.be.bignumber.equal(stake[REWARD_FOR_STAKING]);
            logs[0].args.caller.should.be.equal(owner);
            (await token.balanceOf(bridge.address)).should.be.bignumber.equal(stake[REWARD_FOR_STAKING]);
        });
        it('should fail if bridge address is not set', async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await EmptyContract.new();
            const distributionStartBlock = await distribution.distributionStartBlock()
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking().should.be.rejectedWith('invalid address');
        });
        it('should fail if tokens are not approved', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock()
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking().should.be.rejectedWith('SafeMath: subtraction overflow.');
        });
        it('cannot be unlocked before time', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).sub(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking().should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot be unlocked if not initialized', async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.unlockRewardForStaking().should.be.rejectedWith('not initialized');
        });
        it('cannot be unlocked twice', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await token.approve(distribution.address, stake[REWARD_FOR_STAKING], { from: address[REWARD_FOR_STAKING] });
            await distribution.unlockRewardForStaking().should.be.fulfilled;
            await distribution.unlockRewardForStaking().should.be.rejectedWith('installments are not active for this pool');
        });
        it('can be unlocked by anyone', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await token.approve(distribution.address, stake[REWARD_FOR_STAKING], { from: address[REWARD_FOR_STAKING] });
            await distribution.unlockRewardForStaking({ from: accounts[9] }).should.be.fulfilled;
        });
    });
    describe('makeInstallment', async () => {
        beforeEach(async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
        });
        async function makeAllInstallments(pool) {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const cliffBlock = distributionStartBlock.add(cliff[pool]);
            let newBlock = cliffBlock.add(new BN(1));
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(pool, { from: address[pool] }).should.be.fulfilled;
            const valueAtCliff = calculatePercentage(stake[pool], percentAtCliff[pool]); // 10%
            const balanceAtCliff = await token.balanceOf(address[pool]);
            balanceAtCliff.should.be.bignumber.equal(valueAtCliff);

            let installmentValue = stake[pool].sub(valueAtCliff).div(numberOfInstallments[pool]);
            let lastBalance = balanceAtCliff;
            const installmentsNumber = numberOfInstallments[pool].toNumber();
            for (let i = 0; i < installmentsNumber; i++) {
                newBlock = newBlock.add(STAKING_EPOCH_DURATION);
                await distribution.setBlock(newBlock);

                if (i === installmentsNumber - 1) { // the last installment
                    installmentValue = await distribution.tokensLeft(pool);
                } 

                const { logs } = await distribution.makeInstallment(pool, { from: address[pool] }).should.be.fulfilled;
                logs[0].args.pool.toNumber().should.be.equal(pool);
                logs[0].args.value.should.be.bignumber.equal(installmentValue);
                logs[0].args.caller.should.be.equal(address[pool]);
                
                const newBalance = await token.balanceOf(address[pool]);
                newBalance.should.be.bignumber.equal(lastBalance.add(installmentValue));
                lastBalance = newBalance;
            }
            (await token.balanceOf(address[pool])).should.be.bignumber.equal(stake[pool]);
        }
        it('should make all installments (ECOSYSTEM_FUND)', async () => {
            const args = [ECOSYSTEM_FUND, { from: address[ECOSYSTEM_FUND] }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(ECOSYSTEM_FUND);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (FOUNDATION_REWARD)', async () => {
            const args = [FOUNDATION_REWARD, { from: address[FOUNDATION_REWARD] }];
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
            await makeAllInstallments(FOUNDATION_REWARD);
            await distribution.makeInstallment(...args).should.be.rejectedWith('installments are not active for this pool');
        });
        it('should make all installments (PRIVATE_OFFERING)', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const prereleaseValue = calculatePercentage(stake[PRIVATE_OFFERING], PRIVATE_OFFERING_PRERELEASE); // 25%
            const valueAtCliff = calculatePercentage(stake[PRIVATE_OFFERING], percentAtCliff[PRIVATE_OFFERING]); // 10%
            const installmentValue = stake[PRIVATE_OFFERING]
                                        .sub(valueAtCliff)
                                        .sub(prereleaseValue)
                                        .div(numberOfInstallments[PRIVATE_OFFERING]);
            
            let balances = await getBalances(privateOfferingParticipants);
            let newBlock = distributionStartBlock.add(cliff[PRIVATE_OFFERING]);

            async function makeInstallmentForPrivateOffering(value) {
                await distribution.setBlock(newBlock);
                const { logs } = await distribution.makeInstallment(PRIVATE_OFFERING, { from: owner }).should.be.fulfilled;
                logs[0].args.pool.toNumber().should.be.equal(PRIVATE_OFFERING);
                logs[0].args.value.should.be.bignumber.equal(value);
                logs[0].args.caller.should.be.equal(owner);
                const participantsStakes = privateOfferingParticipantsStakes.map(partStake =>
                    value.mul(partStake).div(stake[PRIVATE_OFFERING])
                );
                const newBalances = await getBalances(privateOfferingParticipants);
                newBalances.forEach((newBalance, index) => {
                    newBalance.should.be.bignumber.equal(balances[index].add(participantsStakes[index]));
                });
                balances = newBalances;
                newBlock = newBlock.add(STAKING_EPOCH_DURATION);
            }

            await makeInstallmentForPrivateOffering(valueAtCliff);

            for (let i = 0; i < numberOfInstallments[PRIVATE_OFFERING].toNumber(); i++) {
                await makeInstallmentForPrivateOffering(installmentValue);
            }
            
            const installmentsSum = valueAtCliff
                                        .add(prereleaseValue)
                                        .add(numberOfInstallments[PRIVATE_OFFERING]
                                        .mul(installmentValue));
            const change = stake[PRIVATE_OFFERING].sub(installmentsSum);
            (await distribution.tokensLeft(PRIVATE_OFFERING)).should.be.bignumber.equal(change);

            await distribution.makeInstallment(
                PRIVATE_OFFERING,
                { from: owner }
            ).should.be.rejectedWith('installments are not active for this pool');
        });
        async function makeInstallment(pool) {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const cliffBlock = distributionStartBlock.add(cliff[pool]);
            const newBlock = cliffBlock.add(STAKING_EPOCH_DURATION).add(new BN(1));
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(pool, { from: accounts[9] }).should.be.fulfilled;
        }
        it('anyone can make installment (ECOSYSTEM_FUND)', async () => {
            await makeInstallment(ECOSYSTEM_FUND);
        });
        it('anyone can make installment (FOUNDATION_REWARD)', async () => {
            await makeInstallment(FOUNDATION_REWARD);
        });
        it('anyone can make installment (PRIVATE_OFFERING)', async () => {
            await makeInstallment(PRIVATE_OFFERING);
        });
        it('cannot make installment if not initialized', async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('not initialized');
            await distribution.initialize(token.address).should.be.fulfilled;
            const distributionStartBlock = await distribution.distributionStartBlock();
            let newBlock = distributionStartBlock.add(cliff[PRIVATE_OFFERING]);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('cannot make installment for wrong pool', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlock = distributionStartBlock.add(cliff[PRIVATE_OFFERING]);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(7).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(0).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should revert if no installments available', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlock = distributionStartBlock.add(cliff[PRIVATE_OFFERING]);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('no installments available');
        });
    });
    describe('changePoolAddress', async () => {
        beforeEach(async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
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
        it('should fail if not initialized', async () => {
            distribution = await createDistribution();
            await distribution.changePoolAddress(
                ECOSYSTEM_FUND,
                accounts[8],
                { from: address[ECOSYSTEM_FUND] },
            ).should.be.rejectedWith('not initialized');
        });
    });
    describe('setBridgeAddress', async () => {
        let bridge;

        beforeEach(async () => {
            distribution = await createDistribution();
            token = await createToken(distribution.address);
            await distribution.initialize(token.address).should.be.fulfilled;
            bridge = await EmptyContract.new();
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
