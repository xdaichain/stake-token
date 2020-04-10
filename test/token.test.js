const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeTokenMock');
const EmptyContract = artifacts.require('EmptyContract');
const RecipientMock = artifacts.require('RecipientMock');
const TokenMock = artifacts.require('TokenMock');
const BridgeMock = artifacts.require('BridgeMock');
const BridgeTokenMock = artifacts.require('BridgeTokenMock');
const DistributionMock = artifacts.require('DistributionMock');
const MultipleDistribution = artifacts.require('MultipleDistribution');

const { BN, toWei } = web3.utils;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();

const ethUtil = require('ethereumjs-util');
const permitSign = require('./utils/eip712.sign.permit');


contract('Token', async accounts => {

    const {
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
        SUPPLY,
        privateOfferingParticipants,
        privateOfferingParticipantsStakes,
    } = require('./utils/constants')(accounts);

    let token;
    let bridge;
    let recipient;
    let distribution;
    let privateOfferingDistribution;
    let advisorsRewardDistribution;

    function createToken() {
        return ERC677MultiBridgeToken.new(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            distribution.address,
            privateOfferingDistribution.address,
            advisorsRewardDistribution.address
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
            privateOfferingDistribution.address,
            advisorsRewardDistribution.address,
            address[FOUNDATION_REWARD],
            address[LIQUIDITY_FUND],
        );
    }

    describe('constructor', () => {
        it('should be created', async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken().should.be.fulfilled;
            (await token.balanceOf.call(distribution.address)).should.be.bignumber.equal(SUPPLY);
            (await token.name.call()).should.be.equal('STAKE');
            (await token.symbol.call()).should.be.equal('STAKE');
            (await token.decimals.call()).toNumber().should.be.equal(18);

        });
        it('should fail if invalid address', async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();

            await ERC677MultiBridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                EMPTY_ADDRESS,
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address
            ).should.be.rejectedWith('not a contract');
            await ERC677MultiBridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                accounts[1],
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address
            ).should.be.rejectedWith('not a contract');

            const emptyContract = await EmptyContract.new();
            await ERC677MultiBridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                emptyContract.address,
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address
            ).should.be.rejectedWith('revert');

            await ERC677MultiBridgeToken.new(
                TOKEN_NAME,
                TOKEN_SYMBOL,
                distribution.address,
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address
            ).should.be.fulfilled;
        });
    });
    describe('addBridge', () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            bridge = await EmptyContract.new();
        });
        it('should add', async () => {
            await token.addBridge(bridge.address).should.be.fulfilled;
            (await token.bridgeList.call()).should.be.deep.equal([bridge.address]);
        });
        it('should fail if invalid or wrong address', async () => {
            await token.addBridge(EMPTY_ADDRESS).should.be.rejectedWith('not a contract address');
            await token.addBridge(accounts[2]).should.be.rejectedWith('not a contract address');
        });
        it('should fail if not an owner', async () => {
            await token.addBridge(
                bridge.address,
                { from: accounts[1] }
            ).should.be.rejectedWith('Ownable: caller is not the owner');
        });
    });
    describe('transferAndCall', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
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
            (await token.balanceOf.call(recipient.address)).should.be.bignumber.equal(value);
            (await recipient.from.call()).should.be.equal(accounts[1]);
            (await recipient.value.call()).should.be.bignumber.equal(value);
            (await recipient.customString.call()).should.be.equal(customString);
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
        it('should fail if recipient is bridge, Distribution, or MultipleDistribution contracts', async () => {
            const customString = 'Hello';
            const data = web3.eth.abi.encodeParameters(['string'], [customString]);
            bridge = await EmptyContract.new();
            await token.addBridge(bridge.address).should.be.fulfilled;
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
                privateOfferingDistribution.address,
                value,
                data,
                { from: accounts[1] }
            ).should.be.rejectedWith("contract call failed");
        });
    });
    describe('transfer', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer', async () => {
            await token.transfer(accounts[2], value, { from: accounts[1] }).should.be.fulfilled;
            (await token.balanceOf.call(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge, Distribution, or MultipleDistribution contracts', async () => {
            bridge = await EmptyContract.new();
            await token.addBridge(bridge.address).should.be.fulfilled;
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
                privateOfferingDistribution.address,
                value,
                { from: accounts[1] }
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
        });
    });
    describe('transferFrom', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer', async () => {
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.transferFrom(accounts[1], accounts[2], value).should.be.fulfilled;
            (await token.balanceOf.call(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge, Distribution, or MultipleDistribution contracts', async () => {
            bridge = await EmptyContract.new();
            await token.addBridge(bridge.address).should.be.fulfilled;
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
                privateOfferingDistribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
            await token.transferFrom(
                accounts[1],
                advisorsRewardDistribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to AdvisorsReward contract");
        });
    });
    describe('move', () => {
        const value = new BN(toWei('1'));

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            recipient = await RecipientMock.new();
            await distribution.setToken(token.address);
            await distribution.transferTokens(accounts[1], value);
        });
        it('should transfer', async () => {
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.move(accounts[1], accounts[2], value).should.be.fulfilled;
            (await token.balanceOf.call(accounts[2])).should.be.bignumber.equal(value);
        });
        it('should fail if recipient is bridge, Distribution, or MultipleDistribution contracts', async () => {
            bridge = await EmptyContract.new();
            await token.addBridge(bridge.address).should.be.fulfilled;
            await token.approve(owner, value, { from: accounts[1] }).should.be.fulfilled;
            await token.move(
                accounts[1],
                bridge.address,
                value,
            ).should.be.rejectedWith("you can't transfer to bridge contract");
            await token.move(
                accounts[1],
                distribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to Distribution contract");
            await token.move(
                accounts[1],
                privateOfferingDistribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to PrivateOffering contract");
            await token.move(
                accounts[1],
                advisorsRewardDistribution.address,
                value,
            ).should.be.rejectedWith("you can't transfer to AdvisorsReward contract");
        });
    });
    describe('mint', () => {
        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
        });
        it('should mint', async () => {
            const bridge = await BridgeMock.new(token.address).should.be.fulfilled;
            await token.addBridge(bridge.address).should.be.fulfilled;
            (await token.balanceOf.call(accounts[5])).should.be.bignumber.equal(new BN('0'));
            await bridge.doMint(accounts[5], '100').should.be.fulfilled;
            (await token.balanceOf.call(accounts[5])).should.be.bignumber.equal(new BN('100'));
        });
        it('should fail if sender is not bridge', async () => {
            await token.mint(accounts[5], '100').should.be.rejectedWith("caller is not the bridge");
        });
    });
    describe('permit', () => {
        const privateKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501210';
        const infinite = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
        let holder;
        let spender;
        let nonce;
        let expiry;
        let allowed;

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();

            holder = accounts[10];
            spender = accounts[11];
            nonce = await token.nonces.call(holder);
            expiry = 0;
            allowed = true;

            holder.toLowerCase().should.be.equal(
                ethUtil.bufferToHex(ethUtil.privateToAddress(privateKey)).toLowerCase()
            ); // make sure privateKey is holder's key

            // Mint some extra tokens for the `holder`
            const bridge = await BridgeMock.new(token.address).should.be.fulfilled;
            await token.addBridge(bridge.address).should.be.fulfilled;
            await bridge.doMint(holder, '10000').should.be.fulfilled;
            (await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('10000'));
        });
        it('should permit', async () => {
            // Holder signs the `permit` params with their privateKey
            const signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            (await token.allowance.call(holder, spender)).should.be.bignumber.equal(new BN('0'));

            // An arbitrary address calls the `permit` function
            const { logs } = await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;

            logs[0].event.should.be.equal('Approval');
            logs[0].args.owner.should.be.equal(holder);
            logs[0].args.spender.should.be.equal(spender);
            logs[0].args.value.should.be.bignumber.equal(infinite);

            // Now allowance is infinite
            (await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite);

            // The caller of `permit` can't spend holder's funds
            await token.transferFrom(holder, accounts[12], '10000').should.be.rejectedWith('SafeMath: subtraction overflow');
            (await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('10000'));

            // Spender can transfer all holder's funds
            await token.transferFrom(holder, accounts[12], '10000', { from: spender }).should.be.fulfilled;
            (await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('0'));
            (await token.balanceOf.call(accounts[12])).should.be.bignumber.equal(new BN('10000'));
            (await token.nonces.call(holder)).should.be.bignumber.equal(nonce.add(new BN('1')));

            // The allowance is still infinite after transfer
            (await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite);
        });
        it('should fail when invalid expiry', async () => {
            expiry = 900;

            const signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            await token.setNow(1000).should.be.fulfilled;
            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.rejectedWith('invalid expiry');

            await token.setNow(800).should.be.fulfilled;
            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;
        });
        it('should consider expiry', async () => {
            expiry = 900;

            const signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            await token.setNow(800).should.be.fulfilled;
            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;
            (await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN(expiry));

            // Spender can transfer holder's funds
            await token.setNow(899).should.be.fulfilled;
            await token.transferFrom(holder, accounts[12], '6000', { from: spender }).should.be.fulfilled;
            (await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('4000'));
            (await token.balanceOf.call(accounts[12])).should.be.bignumber.equal(new BN('6000'));

            // Spender can't transfer the remaining holder's funds because of expiry
            await token.setNow(901).should.be.fulfilled;
            await token.transferFrom(holder, accounts[12], '4000', { from: spender }).should.be.rejectedWith('expiry is in the past');
        });
        it('should disallow unlimited allowance', async () => {
            expiry = 900;
            await token.setNow(800).should.be.fulfilled;

            let signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;

            (await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite);
            (await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN(expiry));

            // Spender can transfer holder's funds
            await token.transferFrom(holder, accounts[12], '6000', { from: spender }).should.be.fulfilled;
            (await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('4000'));
            (await token.balanceOf.call(accounts[12])).should.be.bignumber.equal(new BN('6000'));

            nonce = nonce - 0 + 1;
            allowed = false;

            signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;

            (await token.allowance.call(holder, spender)).should.be.bignumber.equal(new BN('0'));
            (await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN('0'));

            // Spender can't transfer the remaining holder's funds because of zero allowance
            await token.transferFrom(holder, accounts[12], '4000', { from: spender }).should.be.rejectedWith('SafeMath: subtraction overflow');
        });
        it('should fail when invalid signature or parameters', async () => {
            let signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            allowed = !allowed;

            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.rejectedWith('invalid signature or parameters');

            allowed = !allowed;

            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.s, // here should be `signature.r` in a correct case
                signature.r  // here should be `signature.s` in a correct case
            ).should.be.rejectedWith('invalid signature or parameters');

            signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce: nonce - 0 + 1,
                expiry,
                allowed
            }, privateKey);

            await token.permit(
                holder,
                spender,
                nonce - 0 + 1,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.rejectedWith('invalid nonce');

            signature = permitSign({
                name: await token.name.call(),
                version: await token.version.call(),
                chainId: "1",
                verifyingContract: token.address
            }, {
                holder,
                spender,
                nonce,
                expiry,
                allowed
            }, privateKey);

            await token.permit(
                holder,
                spender,
                nonce,
                expiry,
                allowed,
                signature.v,
                signature.r,
                signature.s
            ).should.be.fulfilled;
        });
    });
    describe('claimTokens', () => {
        const value = new BN(toWei('1'));
        let anotherToken;

        beforeEach(async () => {
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
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
                privateOfferingDistribution.address,
                advisorsRewardDistribution.address
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
            privateOfferingDistribution = await createMultipleDistribution(PRIVATE_OFFERING);
            advisorsRewardDistribution = await createMultipleDistribution(ADVISORS_REWARD);
            distribution = await createDistribution();
            token = await createToken();
            await token.renounceOwnership().should.be.rejectedWith('not implemented');
        });
    });
});
