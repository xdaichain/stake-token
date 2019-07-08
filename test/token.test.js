const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');
const BridgeMock = artifacts.require('BridgeMock');
const RecipientMock = artifacts.require('RecipientMock');

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
            bridge = await BridgeMock.new();
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
            bridge = await BridgeMock.new();
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
            bridge = await BridgeMock.new();
            await token.setBridgeContract(bridge.address).should.be.fulfilled;
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(
                accounts[1],
                bridge.address,
                value,
            ).should.be.rejectedWith("you can't transfer to bridge contract");
        });
    });
});
