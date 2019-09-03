const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const Distribution = require('./contracts/Distribution.json');
const ERC677BridgeToken = require('./contracts/ERC677BridgeToken.json');
const Bridge = require('../build/contracts/ERC20.json');

let url;
let network = process.env.NETWORK || 'mainnet';

if (network === 'development') {
    url = 'http://localhost:8545';
} else {
    url = `https://${network}.infura.io/v3/${process.env.INFURA_ID}`;
}

const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);

const distribution = new web3.eth.Contract(Distribution.abi, Distribution.address);
const token = new web3.eth.Contract(ERC677BridgeToken.abi, ERC677BridgeToken.address);

web3.eth.accounts.wallet.add(
    web3.eth.accounts.privateKeyToAccount('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d')
);
web3.eth.accounts.wallet.add(
    web3.eth.accounts.privateKeyToAccount('0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1')
);

async function prepare() {
    const data = await new web3.eth.Contract(Bridge.abi).deploy({ data: Bridge.bytecode }).send({
        from: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        gas: 3000000,
    });
    await distribution.methods.setBridgeAddress(data.options.address).send({
        from: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        gas: 3000000,
    });
    console.log(await distribution.methods.bridgeAddress().call());
    await token.methods.approve(distribution._address, '75000000000000000000000000').send({
        from: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
        gas: 3000000,
    });
    console.log(await token.methods.allowance('0xffcf8fdee72ac11b5c542428b35eef5769c409f0', distribution._address).call());
}

fs.unlinkSync(path.join(__dirname, 'db.json'));

const obj = web3.eth.accounts.encrypt('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', '123456qQ');
fs.writeFileSync(path.join(__dirname, 'wallet.json'), JSON.stringify(obj, null, 4), 'utf8');

prepare().then(() => console.log('ok'));
