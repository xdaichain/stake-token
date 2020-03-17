const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const EmptyContract = artifacts.require('EmptyContract');
const RecipientMock = artifacts.require('RecipientMock');
const TokenMock = artifacts.require('TokenMock');
const BridgeTokenMock = artifacts.require('BridgeTokenMock');
const DistributionMock = artifacts.require('DistributionMock');
const MultipleDistribution = artifacts.require('MultipleDistribution');

const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Token', async accounts => {

    const {
        TOKEN_NAME,
        TOKEN_SYMBOL,
        EMPTY_ADDRESS,
        ECOSYSTEM_FUND,
        PUBLIC_OFFERING,
        PRIVATE_OFFERING_1,
        PRIVATE_OFFERING_2,
        FOUNDATION_REWARD,
        LIQUIDITY_FUND,
        owner,
        address,
        SUPPLY,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
    } = require('./constants')(accounts);

    let token;
    let bridge;
    let recipient;
    let distribution;
    let privateOfferingDistribution_1;
    let privateOfferingDistribution_2;

    function createToken() {
        return ERC677BridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distribution.address,
            privateOfferingDistribution_1.address,
            privateOfferingDistribution_2.address
        );
    }

    async function createMultipleDistribution(number) {
        const contract = await MultipleDistribution.new(number).should.be.fulfilled;
        await contract.finalizeParticipants();
        return contract;
    }

    function createDistribution() {
        return DistributionMock.new(
            address[ECOSYSTEM_FUND],
            address[PUBLIC_OFFERING],
            privateOfferingDistribution_1.address,
            privateOfferingDistribution_2.address,
            address[FOUNDATION_REWARD],
            address[LIQUIDITY_FUND],
        );
    }

    describe('constructor', () => {
        it('should be created', async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken().should.be.fulfilled;
            (await token.balanceOf(distribution.address)).should.be.bignumber.equal(SUPPLY);
            (await token.name()).should.be.equal('STAKE');
            (await token.symbol()).should.be.equal('STAKE');
            (await token.decimals()).toNumber().should.be.equal(18);

        });
        it('should fail if invalid address', async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();

            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                EMPTY_ADDRESS,
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address
            ).should.be.rejectedWith('not a contract');
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                accounts[1],
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address
            ).should.be.rejectedWith('not a contract');
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                EMPTY_ADDRESS,
                privateOfferingDistribution_2.address
            ).should.be.rejectedWith('not a contract');
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                accounts[1],
                privateOfferingDistribution_2.address
            ).should.be.rejectedWith('not a contract');
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                privateOfferingDistribution_1.address,
                EMPTY_ADDRESS
            ).should.be.rejectedWith('not a contract');
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                privateOfferingDistribution_1.address,
                accounts[1]
            ).should.be.rejectedWith('not a contract');

            const emptyContract = await EmptyContract.new();
            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                emptyContract.address,
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address
            ).should.be.rejectedWith('revert');

            await ERC677BridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address
            ).should.be.fulfilled;
        });
    });
    describe('setBridgeContract', () => {
        beforeEach(async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            bridge = await EmptyContract.new();
        });
        it('should set', async () => {
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            (await token.bridgeContract()).should.be.equal(bridge.address);
        });
        it('should fail if invalid or wrong address', async () => {
            await token.setBridgeContract(EMPTY_ADDRESS).should.be.rejectedWith('wrong address');
            await token.setBridgeContract(accounts[2]).should.be.rejectedWith('wrong address');
        });
        it('should fail if not an owner', async () => {
            await token.setBridgeContract(
                bridge.address,
                { from: accounts[1] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
    });
    describe('transferAndCall', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer and call', async () => {
            const customString = 'Hello';
            const data = web3.eth.abi.encodeParameters(['string'], [customString]);
            await token.transferAndCall(recipient.address, value, data, { from: accounts[1] }).should.be.fulfilled;
            (await token.balanceOf(recipient.address)).should.be.bignumber.equal(value);
            (await recipient.from()).should.be.equal(accounts[1]);
            (await recipient.value()).should.be.bignumber.equal(value);
            (await recipient.customString()).should.be.equal(customString);
        });
        it('should fail if wrong custom data', async () => {
            const data = web3.eth.abi.encodeParameters(['uint256'], ['123']);
            await token.transferAndCall(
                recipient.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith('contract call failed');
        });
        it('should fail if recipient is bridge, Distribution or MultipleDistribution contracts', async () => {
            const customString = 'Hello';
            const data = web3.eth.abi.encodeParameters(['string'], [customString]);
            bridge = await EmptyContract.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.transferAndCall(
                bridge.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith("contract call failed");
            await token.transferAndCall(
                distribution.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith("contract call failed");
            await token.transferAndCall(
                privateOfferingDistribution_1.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith("contract call failed");
            await token.transferAndCall(
                privateOfferingDistribution_2.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith("contract call failed");
        });
    });
    describe('transfer', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer', async () => {
            await token.transfer(accounts[2], value, { from: accounts[1] }).should.be.fulfilled;
            (await token.balanceOf(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge, Distribution or MultipleDistribution contracts', async () => {
            bridge = await EmptyContract.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.transfer(
                bridge.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to bridge contract");
            await token.transfer(
                distribution.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to Distribution contract");
            await token.transfer(
                privateOfferingDistribution_1.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
            await token.transfer(
                privateOfferingDistribution_2.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
        });
    });
    describe('transferFrom', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer', async () => {
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(accounts[1], accounts[2], value).should.be.fulfilled;
            (await token.balanceOf(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge, Distribution or MultipleDistribution contracts', async () => {
            bridge = await EmptyContract.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(
                accounts[1],
                bridge.address,
                value,
            ).should.be.rejectedWith("you can't transfer to bridge contract");
            await token.transferFrom(
                accounts[1],
                distribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to Distribution contract");
            await token.transferFrom(
                accounts[1],
                privateOfferingDistribution_1.address,
                value,
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
            await token.transferFrom(
                accounts[1],
                privateOfferingDistribution_2.address,
                value,
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
        });
    });
    describe('claimTokens', () => {
        const value = new BN(toWei('1'));
        let anotherToken;

        beforeEach(async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            anotherToken = await TokenMock.new();

            await anotherToken.mint(accounts[2], value).should.be.fulfilled;
            await anotherToken.transfer(token.address, value, { from: accounts[2] }).should.be.fulfilled;
            (await anotherToken.balanceOf.call(token.address)).should.be.bignumber.equal(value);
        });
        it('should claim tokens', async () => {
            await token.claimTokens(anotherToken.address, accounts[3]).should.be.fulfilled;
            (await anotherToken.balanceOf.call(accounts[3])).should.be.bignumber.equal(value);
        });
        it('should fail if invalid recipient', async () => {
            await token.claimTokens(
                anotherToken.address,
                EMPTY_ADDRESS
            ).should.be.rejectedWith('not a valid recipient');
            await token.claimTokens(
                anotherToken.address,
                token.address
            ).should.be.rejectedWith('not a valid recipient');
        });
        it('should fail if not an owner', async () => {
            await token.claimTokens(
                anotherToken.address,
                accounts[3],
                { from: accounts[1] }
            ).should.be.rejectedWith('Ownable: caller is not the owner.');
        });
        async function claimTokens(to) {
            token = await BridgeTokenMock.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                privateOfferingDistribution_1.address,
                privateOfferingDistribution_2.address,
            );
            const balanceBefore = new BN(await web3.eth.getBalance(to));

            await web3.eth.sendTransaction({ from: owner, to: token.address, value });
            await token.claimTokens(EMPTY_ADDRESS, to).should.be.fulfilled;

            const balanceAfter = new BN(await web3.eth.getBalance(to));
            balanceAfter.should.be.bignumber.equal(balanceBefore.add(value));
        }
        it('should claim eth', async () => {
            await claimTokens(accounts[3]);
        });
        it('should claim eth to non-payable contract', async () => {
            const nonPayableContract = await EmptyContract.new();
            await claimTokens(nonPayableContract.address);
        });
    });
    describe('renounceOwnership', () => {
        it('should fail (not implemented)', async () => {
            privateOfferingDistribution_1 = await createMultipleDistribution(PRIVATE_OFFERING_1);
            privateOfferingDistribution_2 = await createMultipleDistribution(PRIVATE_OFFERING_2);
            distribution = await createDistribution();
            token = await createToken();
            await token.renounceOwnership().should.be.rejectedWith('not implemented');
        });
    });
});
