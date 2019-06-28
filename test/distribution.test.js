const Distribution = artifacts.require('Distribution');
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken');

const ERROR_MSG = 'VM Exception while processing transaction: revert';
const BN = web3.utils.BN;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();


contract('Distribution', async accounts => {
    const owner = accounts[0];
    let distribution;
    let token;

    beforeEach(async () => {
        distribution = await Distribution.new();
        token = await ERC677BridgeToken.new(distribution.address);
    });

    describe('initialize', async () => {
        it('should be initialized', async () => {
            await distribution.initialize(
                token.address,
                accounts[1],
                accounts[2],
                accounts[3],
                [accounts[4], accounts[5]],
                [40, 60],
            ).should.be.fulfilled;
        });
    });
});
