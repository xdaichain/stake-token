const DistributionMock = artifacts.require('DistributionMock');
const MultipleDistribution = artifacts.require('MultipleDistribution');
const MultipleDistributionMock = artifacts.require('MultipleDistributionMock');
const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken');
const BridgeTokenMock = artifacts.require('BridgeTokenMock');
const EmptyContract = artifacts.require('EmptyContract');

const { BN, toWei, fromWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('MultipleDistribution', async accounts => {

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
    } = require('./utils/constants')(accounts);

    let privateOfferingDistribution;
    let advisorsRewardDistribution;
    let distribution;
    let token;

    function createToken(distributionAddress, privateOfferingDistributionAddress) {
        return ERC677MultiBridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distributionAddress,
            privateOfferingDistributionAddress,
            advisorsRewardDistribution
        );
    }

    function createMultipleDistribution() {
        return MultipleDistribution.new(PRIVATE_OFFERING).should.be.fulfilled;
    }

    async function createDistribution(privateOffering, advisorsReward) {
        return DistributionMock.new(
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            privateOffering.address,
            advisorsReward.address,
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

    function toLowerCase(array) {
        return array.map(item => item.toLowerCase());
    }

    function compareAddresses(array1, array2) {
        const sameSize = array1.length === array2.length;
        return sameSize && toLowerCase(array1).slice().sort().every((value, index) =>
            value === toLowerCase(array2).slice().sort()[index]
        );
    }

    function compareStakes(array1, array2) {
        const sameSize = array1.length === array2.length;
        return sameSize && array1.every((value, index) => value.eq(array2[index]));
    }

    async function addParticipants(participants, participantsStakes) {
        const { logs } = await privateOfferingDistribution.addParticipants(
            participants,
            participantsStakes
        ).should.be.fulfilled;
        compareAddresses(logs[0].args.participants, participants);
        compareStakes(logs[0].args.stakes, participantsStakes);
        logs[0].args.caller.should.be.equal(owner);
        const stakes = await Promise.all(participants.map(participant =>
            privateOfferingDistribution.participantStake.call(participant)
        ));
        participantsStakes.forEach((stake, index) => stake.should.be.bignumber.equal(stakes[index]));
    }

    async function addAndFinalizeParticipants(participants, participantsStakes) {
        await privateOfferingDistribution.addParticipants(participants, participantsStakes).should.be.fulfilled;
        const { logs } = await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
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
        let numberOfParticipants = participants.length;
        if (sumOfStakes.lt(stake[PRIVATE_OFFERING])) {
            numberOfParticipants += 1;
        }
        logs[0].args.numberOfParticipants.toNumber().should.be.equal(numberOfParticipants);
    }

    async function prepare(
        participants = privateOfferingParticipants,
        stakes = privateOfferingParticipantsStakes
    ) {
        privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
        advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
        distribution = await createDistribution(privateOfferingDistribution, advisorsRewardDistribution);
        await privateOfferingDistribution.setDistributionAddress(distribution.address);
        await privateOfferingDistribution.addParticipants(participants, stakes);
        await privateOfferingDistribution.finalizeParticipants();
        await advisorsRewardDistribution.setDistributionAddress(distribution.address);
        await advisorsRewardDistribution.finalizeParticipants();
        token = await BridgeTokenMock.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distribution.address,
            privateOfferingDistribution.address,
            advisorsRewardDistribution.address
        );
        await distribution.setToken(token.address);
        await distribution.initializePrivateOfferingDistribution();
        await distribution.initializeAdvisorsRewardDistribution();
    }

    async function withdrawOrBurn(method, participant, participantStake, maxBalance) {
        const paidAmountBefore = await privateOfferingDistribution.paidAmount(participant);
        const maxShare = maxBalance.mul(participantStake).div(stake[PRIVATE_OFFERING]);
        const currentShare = maxShare.sub(paidAmountBefore);
        const balanceBefore = await token.balanceOf.call(participant);
        const sender = method === 'burn' ? owner : participant;
        const { logs } = await privateOfferingDistribution[method]({ from: sender }).should.be.fulfilled;
        logs[0].args.value.should.be.bignumber.equal(currentShare);
        if (method === 'withdraw') {
            logs[0].args.recipient.should.be.equal(participant);
        }
        const paidAmountAfter = await privateOfferingDistribution.paidAmount(participant);
        const balanceAfter = await token.balanceOf.call(participant);
        paidAmountAfter.should.be.bignumber.equal(paidAmountBefore.add(currentShare));
        balanceAfter.should.be.bignumber.equal(balanceBefore.add(currentShare));
    }

    function withdraw(participant, participantStake, maxBalance) {
        return withdrawOrBurn('withdraw', participant, participantStake, maxBalance);
    }

    function burn(zeroStake, maxBalance) {
        return withdrawOrBurn('burn', EMPTY_ADDRESS, zeroStake, maxBalance);
    }

    async function validateParticipantsShares(participants, participantsStakes, maxBalance) {
        await Promise.all(participants.map(async (participant, index) => {
            const [balance, paidAmount] = await Promise.all([
                token.balanceOf.call(participant),
                privateOfferingDistribution.paidAmount.call(participant),
            ]);
            const totalShare = maxBalance.mul(participantsStakes[index]).div(stake[PRIVATE_OFFERING]);
            balance.should.be.bignumber.equal(totalShare);
            paidAmount.should.be.bignumber.equal(totalShare);
        }));
    }

    describe('constructor', async () => {
        it('should fail if wrong number of pool', async () => {
            await MultipleDistribution.new(2).should.be.rejectedWith('wrong pool number');
            await MultipleDistribution.new(0).should.be.rejectedWith('wrong pool number');
            await MultipleDistribution.new(7).should.be.rejectedWith('wrong pool number');

            let instance = await MultipleDistribution.new(PRIVATE_OFFERING).should.be.fulfilled;
            (await instance.poolStake.call()).should.be.bignumber.equal(stake[PRIVATE_OFFERING]);
        });
    });
    describe('addParticipants', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should be added', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
        });
        it('should be added 50 participants', async () => {
            const participants = await Promise.all([...Array(50)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(50)].map(() => new BN(toWei(String(random(1, 39400)))));
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
                [toWei('1800000'), toWei('100000')],
            ).should.be.fulfilled;
            await privateOfferingDistribution.addParticipants(
                [accounts[6], accounts[7]],
                [toWei('3000000'), toWei('4000000')],
            ).should.be.rejectedWith('participant already added');
            await privateOfferingDistribution.addParticipants(
                [accounts[8], accounts[9]],
                [toWei('2000000'), toWei('4000000')],
            ).should.be.rejectedWith('wrong sum of values');
        });
        it('cannot be added if finalized', async () => {
            const participants = await Promise.all([...Array(10)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(10)].map(() => new BN(toWei(String(random(1, 197000)))));
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
        it('should be added and validated (250 participants)', async () => {
            const participants = await Promise.all([...Array(250)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(250)].map(() => new BN(toWei(String(random(1, 7880)))));
            await addParticipants(participants.slice(0, 50), participantsStakes.slice(0, 50));
            await addParticipants(participants.slice(50, 100), participantsStakes.slice(50, 100));
            await addParticipants(participants.slice(100, 150), participantsStakes.slice(100, 150));
            await addParticipants(participants.slice(150, 200), participantsStakes.slice(150, 200));
            await addParticipants(participants.slice(200, 250), participantsStakes.slice(200, 250));

            const participantsFromContract = await privateOfferingDistribution.getParticipants.call();
            compareAddresses(participants, participantsFromContract).should.be.equal(true);

            const sumOfStakesFromContract = await privateOfferingDistribution.sumOfStakes();
            const sumOfStakes = participantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            sumOfStakes.should.be.bignumber.equal(sumOfStakesFromContract);
        });
        it('should fail if not an owner', async () => {
            await privateOfferingDistribution.addParticipants(
                privateOfferingParticipants,
                privateOfferingParticipantsStakes,
                { from: accounts[10] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('should be added after 1 participant has been removed', async () => {
            await addParticipants([accounts[10], accounts[11]], [new BN(100), new BN(200)]);
            await privateOfferingDistribution.removeParticipant(accounts[11]);
            await addParticipants([accounts[12], accounts[13]], [new BN(300), new BN(400)]);
            (await privateOfferingDistribution.getParticipants.call()).should.be.deep.equal([
                accounts[10],
                accounts[12],
                accounts[13]
            ]);
            (await privateOfferingDistribution.sumOfStakes.call()).should.be.bignumber.equal(new BN(800));
        });
        it('should be added after all participants have been removed', async () => {
            await addParticipants([accounts[10], accounts[11]], [new BN(100), new BN(200)]);
            await privateOfferingDistribution.removeParticipant(accounts[10]);
            await privateOfferingDistribution.removeParticipant(accounts[11]);
            await addParticipants([accounts[12], accounts[13]], [new BN(300), new BN(400)]);
            (await privateOfferingDistribution.getParticipants.call()).should.be.deep.equal([
                accounts[12],
                accounts[13]
            ]);
            (await privateOfferingDistribution.sumOfStakes.call()).should.be.bignumber.equal(new BN(700));
        });
        it('should add removed participant', async () => {
            await addParticipants([accounts[10], accounts[11]], [new BN(100), new BN(200)]);
            await privateOfferingDistribution.removeParticipant(accounts[11]);
            await addParticipants([accounts[11], accounts[13]], [new BN(300), new BN(400)]);
            (await privateOfferingDistribution.getParticipants.call()).should.be.deep.equal([
                accounts[10],
                accounts[11],
                accounts[13]
            ]);
            (await privateOfferingDistribution.sumOfStakes.call()).should.be.bignumber.equal(new BN(800));
        });
    });
    describe('editParticipant', () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should be edited', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            const participant = privateOfferingParticipants[0];
            const newStake = privateOfferingParticipantsStakes[0].add(new BN(1));
            const { logs } = await privateOfferingDistribution.editParticipant(participant, newStake).should.be.fulfilled;
            logs[0].args.participant.should.be.equal(participant);
            logs[0].args.oldStake.should.be.bignumber.equal(privateOfferingParticipantsStakes[0]);
            logs[0].args.newStake.should.be.bignumber.equal(newStake);
            logs[0].args.caller.should.be.equal(owner);
        });
        it('should fail if invalid address', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.editParticipant(EMPTY_ADDRESS, '1').should.be.rejectedWith('invalid address');
        });
        it('should fail if not an owner', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.editParticipant(
                privateOfferingParticipants[0],
                '1',
                { from: accounts[10] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('should fail if finalized', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            await privateOfferingDistribution.editParticipant(
                privateOfferingParticipants[0],
                '1'
            ).should.be.rejectedWith('already finalized');
        });
        it('should fail if participant does not exist', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.editParticipant(
                accounts[10],
                '1'
            ).should.be.rejectedWith("the participant doesn't exist");
        });
        it('should fail if new stake is 0', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.editParticipant(
                privateOfferingParticipants[0],
                0
            ).should.be.rejectedWith("the participant stake must be more than 0");
        });
        it('should fail if wrong sum of stakes after editing', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            const sum = privateOfferingParticipantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            const notUsedStake = stake[PRIVATE_OFFERING].sub(sum);
            const newStake = privateOfferingParticipantsStakes[0].add(notUsedStake).add(new BN(1));
            await privateOfferingDistribution.editParticipant(
                privateOfferingParticipants[0],
                newStake
            ).should.be.rejectedWith("wrong sum of values");
        });
    });
    describe('removeParticipant', () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should be removed', async () => {
            await addParticipants([accounts[10], accounts[11], accounts[12]], [new BN(100), new BN(200), new BN(300)]);
            (await privateOfferingDistribution.getParticipants.call()).should.be.deep.equal([
                accounts[10],
                accounts[11],
                accounts[12]
            ]);
            const { logs } = await privateOfferingDistribution.removeParticipant(accounts[10]).should.be.fulfilled;
            logs[0].args.participant.should.be.equal(accounts[10]);
            logs[0].args.stake.should.be.bignumber.equal(new BN(100));
            logs[0].args.caller.should.be.equal(owner);
            (await privateOfferingDistribution.getParticipants.call()).should.be.deep.equal([
                accounts[12],
                accounts[11]
            ]);
        });
        it('should fail if invalid address', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.removeParticipant(EMPTY_ADDRESS).should.be.rejectedWith('invalid address');
        });
        it('should fail if not an owner', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.removeParticipant(
                privateOfferingParticipants[0],
                { from: accounts[10] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('should fail if finalized', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            await privateOfferingDistribution.removeParticipant(
                privateOfferingParticipants[0]
            ).should.be.rejectedWith('already finalized');
        });
        it('should fail if participant does not exist', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.removeParticipant(
                accounts[10]
            ).should.be.rejectedWith("the participant doesn't exist");
        });
        it('should remove some participants', async () => {
            const participants = await Promise.all([...Array(250)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(250)].map(() => new BN(toWei(String(random(1, 7880)))));
            await addParticipants(participants.slice(0, 50), participantsStakes.slice(0, 50));
            await addParticipants(participants.slice(50, 100), participantsStakes.slice(50, 100));
            await addParticipants(participants.slice(100, 150), participantsStakes.slice(100, 150));
            await addParticipants(participants.slice(150, 200), participantsStakes.slice(150, 200));
            await addParticipants(participants.slice(200, 250), participantsStakes.slice(200, 250));

            const participantsFromContract = await privateOfferingDistribution.getParticipants.call();
            compareAddresses(participants, participantsFromContract).should.be.equal(true);

            async function remove(index) {
                const sumOfStakesBefore = await privateOfferingDistribution.sumOfStakes.call();
                const participant = participants.splice(index, 1)[0];
                const stake = participantsStakes.splice(index, 1)[0];
                await privateOfferingDistribution.removeParticipant(participant).should.be.fulfilled;
                (await privateOfferingDistribution.participantStake.call(participant)).should.be.bignumber.equal(new BN(0));
                const participantsFromContract = await privateOfferingDistribution.getParticipants.call();
                compareAddresses(participants, participantsFromContract).should.be.equal(true);
                const sumOfStakesAfter = await privateOfferingDistribution.sumOfStakes.call();
                sumOfStakesAfter.should.be.bignumber.equal(sumOfStakesBefore.sub(stake));
            }
            await remove(0);
            await remove(0);
            await remove(participants.length - 1);
            await remove(Math.floor(participants.length / 2));
            await remove(Math.floor(participants.length / 4));
            await remove(Math.floor(participants.length / 4 * 3));
            await remove(0);
            await remove(participants.length - 1);
            await remove(participants.length - 1);
            await remove(0);
        });
        it('should remove all participants', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            for (let i = 0; i < privateOfferingParticipants.length; i++) {
                await privateOfferingDistribution.removeParticipant(privateOfferingParticipants[i]);
            }
            const length = (await privateOfferingDistribution.getParticipants.call()).length;
            length.should.be.equal(0);
            (await privateOfferingDistribution.sumOfStakes.call()).should.be.bignumber.equal(new BN(0));
        });
    });
    describe('finalizeParticipants', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING).should.be.fulfilled;
        });
        it('should be finalized', async () => {
            await addAndFinalizeParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
        });
        it('should be finalized with sum of stakes which is less than the whole pool stake', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('1800000')), new BN(toWei('100000'))];
            await addAndFinalizeParticipants(participants, participantsStakes);
        });
        it('should be finalized with 250 participants', async () => {
            const participants = await Promise.all([...Array(250)].map(() => web3.eth.personal.newAccount()));
            const participantsStakes = [...Array(250)].map(() => new BN(toWei(String(random(1, 7880)))));
            await addParticipants(participants.slice(0, 50), participantsStakes.slice(0, 50));
            await addParticipants(participants.slice(50, 100), participantsStakes.slice(50, 100));
            await addParticipants(participants.slice(100, 150), participantsStakes.slice(100, 150));
            await addParticipants(participants.slice(150, 200), participantsStakes.slice(150, 200));
            await addParticipants(participants.slice(200, 250), participantsStakes.slice(200, 250));
            let numberOfParticipants = participants.length;
            const sumOfStakes = participantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            if (sumOfStakes.lt(stake[PRIVATE_OFFERING])) {
                numberOfParticipants += 1;
            }
            const { logs } = await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            logs[0].args.numberOfParticipants.toNumber().should.be.equal(numberOfParticipants);
        });
        it('cannot be finalized twice', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
            await privateOfferingDistribution.finalizeParticipants().should.be.rejectedWith('already finalized');
        });
        it('should fail if not an owner', async () => {
            await addParticipants(privateOfferingParticipants, privateOfferingParticipantsStakes);
            await privateOfferingDistribution.finalizeParticipants(
                { from: accounts[9] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('should be finalized after editing and removing', async () => {
            const participants = [accounts[6], accounts[7], accounts[8]];
            const participantsStakes = [new BN(toWei('1000000')), new BN(toWei('500000')), new BN('500000')];
            await addParticipants(participants, participantsStakes);
            await privateOfferingDistribution.removeParticipant(participants[0]);
            await privateOfferingDistribution.editParticipant(participants[1], new BN(toWei('1500000')));
            await privateOfferingDistribution.finalizeParticipants().should.be.fulfilled;
        });
    });
    describe('initialize', async () => {
        let distributionAddress = owner;
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING).should.be.fulfilled;
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
        it('should fail if not finalized', async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING).should.be.fulfilled;
            await privateOfferingDistribution.setDistributionAddress(distributionAddress);
            await privateOfferingDistribution.initialize(accounts[9]).should.be.rejectedWith('not finalized');
        });
    });
    describe('setDistributionAddress', async () => {
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistribution.new(PRIVATE_OFFERING);
            advisorsRewardDistribution = await MultipleDistribution.new(ADVISORS_REWARD);
            distribution = await createDistribution(privateOfferingDistribution, advisorsRewardDistribution);
        });
        it('should be set', async () => {
            const { logs } = await privateOfferingDistribution.setDistributionAddress(
                distribution.address
            ).should.be.fulfilled;
            logs[0].args.distribution.should.be.equal(distribution.address);
            logs[0].args.caller.should.be.equal(owner);
            const distributionAddress = await privateOfferingDistribution.distributionAddress();
            distributionAddress.should.be.equal(distribution.address);
        });
        it('cannot be set twice', async () => {
            await privateOfferingDistribution.setDistributionAddress(
                distribution.address
            ).should.be.fulfilled;
            await privateOfferingDistribution.setDistributionAddress(
                distribution.address
            ).should.be.rejectedWith('already set');
        });
        it('should fail if not an owner', async () => {
            await privateOfferingDistribution.setDistributionAddress(
                distribution.address,
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

            const anotherPrivateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING);
            const anotherAdvisorsRewardDistribution = await MultipleDistributionMock.new(ADVISORS_REWARD);
            const anotherDistribution = await createDistribution(anotherPrivateOfferingDistribution, anotherAdvisorsRewardDistribution);
            await privateOfferingDistribution.setDistributionAddress(
                anotherDistribution.address
            ).should.be.rejectedWith('wrong address');
        });
    });
    describe('withdraw', () => {
        it('should be withdrawn', async () => {
            await prepare(privateOfferingParticipants, privateOfferingParticipantsStakes);
            const value = new BN(toWei('100'));
            await distribution.transferTokens(privateOfferingDistribution.address, value);
            const maxBalance = await privateOfferingDistribution.maxBalance.call();
            const balance = await token.balanceOf.call(privateOfferingDistribution.address);
            maxBalance.should.be.bignumber.equal(value);
            balance.should.be.bignumber.equal(value);
            const currentShare = value.mul(privateOfferingParticipantsStakes[0]).div(stake[PRIVATE_OFFERING]);
            const { logs } = await privateOfferingDistribution.withdraw({ from: privateOfferingParticipants[0] }).should.be.fulfilled;
            logs[0].args.recipient.should.be.equal(privateOfferingParticipants[0]);
            logs[0].args.value.should.be.bignumber.equal(currentShare);
            const participantBalance = await token.balanceOf.call(privateOfferingParticipants[0]);
            participantBalance.should.be.bignumber.equal(currentShare);
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('should be withdrawn 10 times by 20 participants', async () => {
            const participants = accounts.slice(10, 30);
            const participantsStakes = participants.map(() => new BN(toWei(String(random(1, 98540)))));
            await prepare(participants, participantsStakes);
            let maxBalanceShouldBe = new BN(0);
            for (let i = 0; i < 10; i ++) {
                const value = new BN(toWei('100')).mul(new BN(i + 1));
                maxBalanceShouldBe = maxBalanceShouldBe.add(value);
                await distribution.transferTokens(privateOfferingDistribution.address, value);
                const maxBalance = await privateOfferingDistribution.maxBalance.call();
                maxBalance.should.be.bignumber.equal(maxBalanceShouldBe);
                for (let j = 0; j < participants.length; j++) {
                    await withdraw(participants[j], participantsStakes[j], maxBalance);
                }
            }
            await validateParticipantsShares(participants, participantsStakes, maxBalanceShouldBe);
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('should be withdrawn in random order', async () => {
            const participants = [accounts[6], accounts[7], accounts[8], accounts[9]]
            const participantsStakes = [
                new BN(toWei('65000')),
                new BN(toWei('1833000')),
                new BN(toWei('22000')),
                new BN(toWei('1')),
            ];
            await prepare(participants, participantsStakes);

            let maxBalanceShouldBe = new BN(0);

            async function deposit(value) {
                value = new BN(toWei(value));
                await distribution.transferTokens(privateOfferingDistribution.address, value);
                maxBalanceShouldBe = maxBalanceShouldBe.add(value);
                const maxBalance = await privateOfferingDistribution.maxBalance.call();
                maxBalance.should.be.bignumber.equal(maxBalanceShouldBe);
            }

            function _withdraw(participant, stake) {
                return withdraw(participant, stake, maxBalanceShouldBe);
            }

            await deposit('100');
            await _withdraw(participants[0], participantsStakes[0]);
            await deposit('300');
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('500');
            await _withdraw(participants[2], participantsStakes[2]);
            await _withdraw(participants[0], participantsStakes[0]);
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('12321');
            await _withdraw(participants[0], participantsStakes[0]);
            await deposit('11');
            await _withdraw(participants[2], participantsStakes[2]);
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('2');
            await _withdraw(participants[3], participantsStakes[3]);
            await _withdraw(participants[2], participantsStakes[2]);
            await _withdraw(participants[1], participantsStakes[1]);
            await _withdraw(participants[0], participantsStakes[0]);

            await validateParticipantsShares(participants, participantsStakes, maxBalanceShouldBe);
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('cannot be withdrawn by not participant', async () => {
            const participants = [accounts[6], accounts[7]]
            const participantsStakes = [new BN(toWei('650000')), new BN(toWei('1033000'))];
            await prepare(participants, participantsStakes);

            await distribution.transferTokens(privateOfferingDistribution.address, new BN(toWei('100')));
            await privateOfferingDistribution.withdraw({ from: accounts[8] }).should.be.rejectedWith('you are not a participant');
        });
        it('cannot be withdrawn when no tokens available', async () => {
            const participants = [accounts[6], accounts[7]]
            const participantsStakes = [new BN(toWei('650000')), new BN(toWei('1033000'))];
            await prepare(participants, participantsStakes);

            const params = { from: accounts[6] };
            await privateOfferingDistribution.withdraw(params).should.be.rejectedWith('no tokens available to withdraw');
            await distribution.transferTokens(privateOfferingDistribution.address, new BN(toWei('100')));
            await privateOfferingDistribution.withdraw(params).should.be.fulfilled;
            await privateOfferingDistribution.withdraw(params).should.be.rejectedWith('no tokens available to withdraw');
        });
    });
    describe('burn', () => {
        it('should be burnt', async () => {
            const participants = [accounts[6], accounts[7], accounts[8], accounts[9]];
            const participantsStakes = [
                new BN(toWei('65000')),
                new BN(toWei('1833000')),
                new BN(toWei('22000')),
                new BN(toWei('1')),
            ];
            await prepare(participants, participantsStakes);
            const sumOfStakes = participantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            const zeroAddressStake = stake[PRIVATE_OFFERING].sub(sumOfStakes);
            const value = new BN(toWei('123321'));
            const currentShare = value.mul(zeroAddressStake).div(stake[PRIVATE_OFFERING]);
            await distribution.transferTokens(privateOfferingDistribution.address, value);
            const { logs } = await privateOfferingDistribution.burn().should.be.fulfilled;
            logs[0].args.value.should.be.bignumber.equal(currentShare);
            const balance = await token.balanceOf.call(EMPTY_ADDRESS);
            balance.should.be.bignumber.equal(currentShare);
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('should be burnt after withdrawals', async () => {
            const participants = [accounts[6], accounts[7], accounts[8], accounts[9]]
            const participantsStakes = [
                new BN(toWei('65000')),
                new BN(toWei('1833000')),
                new BN(toWei('22000')),
                new BN(toWei('1')),
            ];
            await prepare(participants, participantsStakes);

            const sumOfStakes = participantsStakes.reduce((acc, cur) => acc.add(cur), new BN(0));
            const zeroAddressStake = stake[PRIVATE_OFFERING].sub(sumOfStakes);

            let maxBalanceShouldBe = new BN(0);

            async function deposit(value) {
                value = new BN(toWei(value));
                await distribution.transferTokens(privateOfferingDistribution.address, value);
                maxBalanceShouldBe = maxBalanceShouldBe.add(value);
                const maxBalance = await privateOfferingDistribution.maxBalance.call();
                maxBalance.should.be.bignumber.equal(maxBalanceShouldBe);
            }

            function _withdraw(participant, stake) {
                return withdraw(participant, stake, maxBalanceShouldBe);
            }

            function _burn(stake) {
                return burn(stake, maxBalanceShouldBe);
            }

            await deposit('100');
            await _withdraw(participants[0], participantsStakes[0]);
            await deposit('300');
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('500');
            await _withdraw(participants[2], participantsStakes[2]);
            await _burn(zeroAddressStake);
            await _withdraw(participants[0], participantsStakes[0]);
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('12321');
            await _burn(zeroAddressStake);
            await _withdraw(participants[0], participantsStakes[0]);
            await deposit('11');
            await _withdraw(participants[2], participantsStakes[2]);
            await _withdraw(participants[1], participantsStakes[1]);
            await deposit('2');
            await _withdraw(participants[3], participantsStakes[3]);
            await _withdraw(participants[2], participantsStakes[2]);
            await _withdraw(participants[1], participantsStakes[1]);
            await _withdraw(participants[0], participantsStakes[0]);
            await _burn(zeroAddressStake);

            participants.push(EMPTY_ADDRESS);
            participantsStakes.push(zeroAddressStake);
            await validateParticipantsShares(participants, participantsStakes, maxBalanceShouldBe);
            (await token.totalSupply.call()).should.be.bignumber.equal(SUPPLY);
        });
        it('cannot be burnt by not an owner', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('650000')), new BN(toWei('1033000'))];
            await prepare(participants, participantsStakes);
            await privateOfferingDistribution.burn({ from: accounts[1] }).should.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('cannot be burnt if zero address stake is zero', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('970951')), new BN(toWei('1000000'))];
            await prepare(participants, participantsStakes);
            await distribution.transferTokens(privateOfferingDistribution.address, new BN(toWei('100')));
            await privateOfferingDistribution.burn().should.be.rejectedWith('you are not a participant');
        });
        it('cannot be burnt when no tokens available', async () => {
            const participants = [accounts[6], accounts[7]];
            const participantsStakes = [new BN(toWei('650000')), new BN(toWei('1033000'))];
            await prepare(participants, participantsStakes);
            await distribution.transferTokens(privateOfferingDistribution.address, new BN(toWei('100')));
            await privateOfferingDistribution.burn().should.be.fulfilled;
            await privateOfferingDistribution.burn().should.be.rejectedWith('no tokens available to withdraw');
        });
    });
    describe('onTokenTransfer', () => {
        const distributionAddress = accounts[8];
        const tokenAddress = accounts[9];
        beforeEach(async () => {
            privateOfferingDistribution = await MultipleDistributionMock.new(PRIVATE_OFFERING);
            await privateOfferingDistribution.setDistributionAddress(distributionAddress);
            await privateOfferingDistribution.setToken(tokenAddress);
        });
        it('should be called', async () => {
            const value = new BN(toWei('100'));
            await privateOfferingDistribution.onTokenTransfer(
                distributionAddress,
                value,
                '0x',
                { from: tokenAddress }
            ).should.be.fulfilled;
            const maxBalance = await privateOfferingDistribution.maxBalance();
            maxBalance.should.be.bignumber.equal(value);
        });
        it('should fail if "from" value is not the distribution contract', async () => {
            const value = new BN(toWei('100'));
            await privateOfferingDistribution.onTokenTransfer(
                accounts[10],
                value,
                '0x',
                { from: tokenAddress }
            ).should.be.rejectedWith('the _from value can only be the distribution contract');
        });
        it('should fail if caller is not the token contract', async () => {
            const value = new BN(toWei('100'));
            await privateOfferingDistribution.onTokenTransfer(
                distributionAddress,
                value,
                '0x',
                { from: owner }
            ).should.be.rejectedWith('the caller can only be the token contract');
        });
    });
});
