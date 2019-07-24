const Distribution = artifacts.require('DistributionMock');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const ERC20 = artifacts.require('ERC20');

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
    const TOKEN_DECIMALS = 18;

    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
    const STAKING_EPOCH_DURATION = new BN(120960);

    const REWARD_FOR_STAKING = 1;
    const ECOSYSTEM_FUND = 2;
    const PUBLIC_OFFERING = 3;
    const PRIVATE_OFFERING = 4;
    const FOUNDATION_REWARD = 5;

    const owner = accounts[0];

    const address = {
        [ECOSYSTEM_FUND]: accounts[1],
        [PUBLIC_OFFERING]: accounts[2],
        [FOUNDATION_REWARD]: accounts[3],
    };

    const stake = {
        [REWARD_FOR_STAKING]: new BN(toWei('73000000')),
        [ECOSYSTEM_FUND]: new BN(toWei('15000000')),
        [PUBLIC_OFFERING]: new BN(toWei('4000000')),
        [PRIVATE_OFFERING]: new BN(toWei('4000000')),
        [FOUNDATION_REWARD]: new BN(toWei('4000000')),
    };

    const cliff = {
        [REWARD_FOR_STAKING]: new BN(12).mul(STAKING_EPOCH_DURATION),
        [ECOSYSTEM_FUND]: new BN(48).mul(STAKING_EPOCH_DURATION),
        [PUBLIC_OFFERING]: new BN(0),
        [PRIVATE_OFFERING]: new BN(0),
        [FOUNDATION_REWARD]: new BN(12).mul(STAKING_EPOCH_DURATION),
    };

    const percentAtCliff = {
        [ECOSYSTEM_FUND]: 10,
        [PRIVATE_OFFERING]: 35,
        [FOUNDATION_REWARD]: 20,
    };

    const numberOfInstallments = {
        [ECOSYSTEM_FUND]: new BN(96),
        [PRIVATE_OFFERING]: new BN(36),
        [FOUNDATION_REWARD]: new BN(48),
    };

    const SUPPLY = new BN(toWei('100000000'));

    let distribution;
    let token;

    const privateOfferingParticipants = [accounts[4], accounts[5]];
    const privateOfferingParticipantsStakes = [new BN(toWei('1000000')), new BN(toWei('3000000'))];

    function createToken(distributionAddress) {
        return ERC677BridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_DECIMALS,
            distributionAddress,
        );
    }

    describe('initialize', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(STAKING_EPOCH_DURATION);
            token = await createToken(distribution.address);
        });
        it('should be initialized', async () => {
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);

            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;

            (await token.balanceOf(address[PUBLIC_OFFERING])).should.be.bignumber.equal(stake[PUBLIC_OFFERING]);

            const privateOfferingPrepayment = calculatePercentage(stake[PRIVATE_OFFERING], percentAtCliff[PRIVATE_OFFERING]);
            const privateOfferingPrepaymentValues = [
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[0]).div(stake[PRIVATE_OFFERING]),
                privateOfferingPrepayment.mul(privateOfferingParticipantsStakes[1]).div(stake[PRIVATE_OFFERING]),
            ];
            (await token.balanceOf(accounts[4])).should.be.bignumber.equal(privateOfferingPrepaymentValues[0]);
            (await token.balanceOf(accounts[5])).should.be.bignumber.equal(privateOfferingPrepaymentValues[1]);
        });
        it('cannot be initialized with wrong values', async () => {
            await distribution.initialize(
                accounts[9],                            // not a token address
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith(ERROR_MSG);
            await distribution.initialize(
                token.address,
                EMPTY_ADDRESS,
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                EMPTY_ADDRESS,
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                EMPTY_ADDRESS,
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                [EMPTY_ADDRESS, accounts[5]],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                [accounts[4], EMPTY_ADDRESS],
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('invalid address');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                [toWei('1000000'), toWei('4000000')]    // sum is not equal to PRIVATE_OFFERING
            ).should.be.rejectedWith('wrong sum of values');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                [accounts[4]],                          // different arrays sizes
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('different arrays sizes');
        });
        it('cannot be initialized twice', async () => {
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('already initialized');
        });
        it('cannot be initialized with wrong token', async () => {
            token = await ERC20.new();
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.rejectedWith('wrong contract balance');
        });
    });
    describe('unlockRewardForStaking', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(STAKING_EPOCH_DURATION);
            token = await createToken(distribution.address);
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
        });
        it('should be unlocked', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock()
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.fulfilled;
            (await token.balanceOf(accounts[8])).should.be.bignumber.equal(stake[REWARD_FOR_STAKING]);
        });
        it('cannot be unlocked before time', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]);
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('installments are not active for this pool');
        });
        it('cannot be unlocked if not initialized', async () => {
            distribution = await Distribution.new(STAKING_EPOCH_DURATION);
            token = await createToken(distribution.address);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('not initialized');
        });
        it('cannot be unlocked twice', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8]).should.be.fulfilled;
            await distribution.unlockRewardForStaking(accounts[8]).should.be.rejectedWith('installments are not active for this pool');
        });
        it('can be unlocked only by owner', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(accounts[8], { from: accounts[9] }).should.be.rejectedWith('Ownable: caller is not the owner');
            await distribution.unlockRewardForStaking(accounts[8], { from: owner }).should.be.fulfilled;
        });
        it('cannot be sent to invalid bridge address', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlockNumber = distributionStartBlock.add(cliff[REWARD_FOR_STAKING]).add(new BN(1));
            await distribution.setBlock(newBlockNumber);
            await distribution.unlockRewardForStaking(EMPTY_ADDRESS).should.be.rejectedWith('invalid address');
        });
    });
    describe('makeInstallment', async () => {
        beforeEach(async () => {
            distribution = await Distribution.new(STAKING_EPOCH_DURATION);
            token = await createToken(distribution.address);
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
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

            const installmentValue = stake[pool].sub(valueAtCliff).div(numberOfInstallments[pool]);
            let lastBalance = balanceAtCliff;
            const installmentsNumber = numberOfInstallments[pool].toNumber();
            for (let i = 0; i < installmentsNumber; i++) {
                newBlock = newBlock.add(STAKING_EPOCH_DURATION);
                await distribution.setBlock(newBlock);
                await distribution.makeInstallment(pool, { from: address[pool] }).should.be.fulfilled;
                
                if (i === installmentsNumber - 1) break; // the last installment

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
            function getBalances(addresses) {
                return Promise.all(addresses.map(addr => token.balanceOf(addr)));
            }

            const distributionStartBlock = await distribution.distributionStartBlock();
            const valueAtCliff = calculatePercentage(stake[PRIVATE_OFFERING], percentAtCliff[PRIVATE_OFFERING]);
            const installmentValue = stake[PRIVATE_OFFERING].sub(valueAtCliff).div(numberOfInstallments[PRIVATE_OFFERING]);
            
            let balances = await getBalances(privateOfferingParticipants);
            const participantsStakes = privateOfferingParticipantsStakes.map(partStake =>
                installmentValue.mul(partStake).div(stake[PRIVATE_OFFERING])
            );
            let newBlock = distributionStartBlock;
            for (let i = 0; i < numberOfInstallments[PRIVATE_OFFERING].toNumber(); i++) {
                newBlock = newBlock.add(STAKING_EPOCH_DURATION);
                await distribution.setBlock(newBlock);
                await distribution.makeInstallment(PRIVATE_OFFERING, { from: owner }).should.be.fulfilled;
                const newBalances = await getBalances(privateOfferingParticipants);
                newBalances.forEach((newBalance, index) => {
                    newBalance.should.be.bignumber.equal(balances[index].add(participantsStakes[index]));
                });
                balances = newBalances;
            }
            const installmentsSum = valueAtCliff.add(numberOfInstallments[PRIVATE_OFFERING].mul(installmentValue));
            const change = stake[PRIVATE_OFFERING].sub(installmentsSum);
            (await token.balanceOf(owner)).should.be.bignumber.equal(change);

            await distribution.makeInstallment(
                PRIVATE_OFFERING,
                { from: owner }
            ).should.be.rejectedWith('installments are not active for this pool');
        });
        async function tryToMakeInstallmentFromNotAuthorizedAddress(pool, testAddresses) {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const cliffBlock = distributionStartBlock.add(cliff[pool]);
            const newBlock = cliffBlock.add(STAKING_EPOCH_DURATION).add(new BN(1));
            await distribution.setBlock(newBlock);
            await Promise.all(
                testAddresses.map(addr =>
                    distribution.makeInstallment(pool, { from: addr }).should.be.rejectedWith('not authorized')
                )
            );
            const poolAddress = address[pool] || owner;
            await distribution.makeInstallment(pool, { from: poolAddress }).should.be.fulfilled;
        }
        it('cannot make installment from not authorized address (ECOSYSTEM_FUND)', async () => {
            await tryToMakeInstallmentFromNotAuthorizedAddress(
                ECOSYSTEM_FUND,
                [owner, address[FOUNDATION_REWARD]]
            );
        });
        it('cannot make installment from not authorized address (FOUNDATION_REWARD)', async () => {
            await tryToMakeInstallmentFromNotAuthorizedAddress(
                FOUNDATION_REWARD,
                [owner, address[ECOSYSTEM_FUND]]
            );
        });
        it('cannot make installment from not authorized address (PRIVATE_OFFERING)', async () => {
            await tryToMakeInstallmentFromNotAuthorizedAddress(
                PRIVATE_OFFERING,
                [address[FOUNDATION_REWARD], address[ECOSYSTEM_FUND]]
            );
        });
        it('cannot make installment if not initialized', async () => {
            distribution = await Distribution.new(STAKING_EPOCH_DURATION);
            token = await createToken(distribution.address);
            const distributionStartBlock = await distribution.distributionStartBlock();
            let newBlock = distributionStartBlock.add(STAKING_EPOCH_DURATION);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('not initialized');
            await distribution.initialize(
                token.address,
                address[ECOSYSTEM_FUND],
                address[PUBLIC_OFFERING],
                address[FOUNDATION_REWARD],
                privateOfferingParticipants,
                privateOfferingParticipantsStakes
            ).should.be.fulfilled;
            newBlock = newBlock.add(STAKING_EPOCH_DURATION);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('cannot make installment for wrong pool', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlock = distributionStartBlock.add(STAKING_EPOCH_DURATION);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(6).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(0).should.be.rejectedWith('wrong pool');
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should revert if no installments available', async () => {
            const distributionStartBlock = await distribution.distributionStartBlock();
            const newBlock = distributionStartBlock.add(STAKING_EPOCH_DURATION);
            await distribution.setBlock(newBlock);
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.fulfilled;
            await distribution.makeInstallment(PRIVATE_OFFERING).should.be.rejectedWith('no installments available');
        });
    });
});
