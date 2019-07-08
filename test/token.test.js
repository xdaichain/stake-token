const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const EmptyContract = artifacts.require('EmptyContract');
const RecipientMock = artifacts.require('RecipientMock');
const TokenMock = artifacts.require('TokenMock');
const BridgeTokenMock = artifacts.require('BridgeTokenMock');

const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Token', async accounts => {
    const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
    const SUPPLY = new BN(toWei('100000000'));
    const owner = accounts[0];
    let token;
    let bridge;
    let recipient;

    describe('constructor', () => {
        it('should be created', async () => {
            token = await ERC677BridgeToken.new(accounts[1]).should.be.fulfilled;
            (await token.balanceOf(accounts[1])).should.be.bignumber.equal(SUPPLY);
            (await token.name()).should.be.equal('DPOS staking token');
            (await token.symbol()).should.be.equal('DPOS');
            (await token.decimals()).toNumber().should.be.equal(18);

        });
        it('should fail if invalid address', async () => {
            await ERC677BridgeToken.new(EMPTY_ADDRESS).should.be.rejectedWith('ERC20: mint to the zero address');
        });
    });
    describe('setBridgeContract', () => {
        beforeEach(async () => {
            token = await ERC677BridgeToken.new(accounts[1]);
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
        beforeEach(async () => {
            token = await ERC677BridgeToken.new(accounts[1]);
            recipient = await RecipientMock.new();
        });
        it('should transfer and call', async () => {
            const value = new BN(toWei('1'));
            const customString = 'Hello';
            const data = web3.eth.abi.encodeParameters(['string'], [customString]);
            await token.transferAndCall(recipient.address, value, data, { from: accounts[1] }).should.be.fulfilled;
            (await token.balanceOf(recipient.address)).should.be.bignumber.equal(value);
            (await recipient.from()).should.be.equal(accounts[1]);
            (await recipient.value()).should.be.bignumber.equal(value);
            (await recipient.customString()).should.be.equal(customString);
        });
        it('should fail if wrong custom data', async () => {
            const value = new BN(toWei('1'));
            const data = web3.eth.abi.encodeParameters(['uint256'], ['123']);
            await token.transferAndCall(
                recipient.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith('contract call failed');
        });
    });
    describe('transfer', () => {
        beforeEach(async () => {
            token = await ERC677BridgeToken.new(accounts[1]);
            recipient = await RecipientMock.new();
        });
        it('should transfer', async () => {
            const value = new BN(toWei('1'));
            await token.transfer(accounts[2], value, { from: accounts[1] }).should.be.fulfilled;
            (await token.balanceOf(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge contract', async () => {
            const value = new BN(toWei('1'));
            bridge = await EmptyContract.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.transfer(
                bridge.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to bridge contract");
        });
    });
    describe('transferFrom', () => {
        beforeEach(async () => {
            token = await ERC677BridgeToken.new(accounts[1]);
            recipient = await RecipientMock.new();
        });
        it('should transfer', async () => {
            const value = new BN(toWei('1'));
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(accounts[1], accounts[2], value).should.be.fulfilled;
            (await token.balanceOf(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge contract', async () => {
            const value = new BN(toWei('1'));
            bridge = await EmptyContract.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(
                accounts[1],
                bridge.address,
                value,
            ).should.be.rejectedWith("you can't transfer to bridge contract");
        });
    });
    describe('claimTokens', () => {
        const value = new BN(toWei('1'));
        let anotherToken;

        beforeEach(async () => {
            token = await ERC677BridgeToken.new(accounts[1]);
            recipient = await RecipientMock.new();
            anotherToken = await TokenMock.new();

            await anotherToken.mint(accounts[2], value).should.be.fulfilled;
            await anotherToken.transfer(token.address, value, { from: accounts[2] }).should.be.fulfilled;
            (await anotherToken.balanceOf(token.address)).should.be.bignumber.equal(value);
        });
        it('should claim tokens', async () => {
            await token.claimTokens(anotherToken.address, accounts[3]).should.be.fulfilled;
            (await anotherToken.balanceOf(accounts[3])).should.be.bignumber.equal(value);
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
            token = await BridgeTokenMock.new(accounts[1]);
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
            token = await ERC677BridgeToken.new(accounts[1]);
            await token.renounceOwnership().should.be.rejectedWith('not implemented');
        });
    });
});
