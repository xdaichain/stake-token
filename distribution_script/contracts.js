const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const Distribution = require('./contracts/Distribution.json');
const PrivateOfferingDistribution_1 = require('./contracts/PrivateOfferingDistribution_1.json');
const PrivateOfferingDistribution_2 = require('./contracts/PrivateOfferingDistribution_2.json');
const ERC677BridgeToken = require('./contracts/ERC677BridgeToken.json');

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
const privateOfferingDistribution_1 = new web3.eth.Contract(PrivateOfferingDistribution_1.abi, PrivateOfferingDistribution_1.address);
const privateOfferingDistribution_2 = new web3.eth.Contract(PrivateOfferingDistribution_2.abi, PrivateOfferingDistribution_2.address);
const token = new web3.eth.Contract(ERC677BridgeToken.abi, ERC677BridgeToken.address);

const walletPath = process.env.WALLET_PATH || path.join(__dirname, 'wallet.json');
const keyObject = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
const account = web3.eth.accounts.decrypt(keyObject, process.env.WALLET_PASSWORD);
web3.eth.accounts.wallet.add(account);

distribution.options.from = account.address;

async function makeInstallment(pool) {
    let gas = await distribution.methods.makeInstallment(pool).estimateGas();
    gas = Math.floor(gas * 1.2);
    return distribution.methods.makeInstallment(pool).send({ gas });
}

function get(method, ...args) {
    return distribution.methods[method](...args).call();
}

function getDistributionBalance() {
    return token.methods.balanceOf(distribution.options.address).call();
}

function getInstallmentsEvents(pool) {
    return distribution.getPastEvents('InstallmentMade', { filter: { pool }, fromBlock: 0 });
}

function getBlock(blockNumber) {
    return web3.eth.getBlock(blockNumber);
}

async function getLastInstallmentDate(pool) {
    const blockNumbers = (await getInstallmentsEvents(pool)).map(item => item.blockNumber);
    if (blockNumbers.length === 0) {
        return null;
    }
    const block = await getBlock(Math.max(...blockNumbers));
    return new Date(block.timestamp * 1000);
}

function getWalletBalance() {
    return web3.eth.getBalance(account.address);
}

async function getWithdrawnEvents(contract) {
    let events = await contract.getPastEvents('Withdrawn', { fromBlock: 0 });
    events = await Promise.all(events.map(async e => {
        const block = await web3.eth.getBlock(e.blockNumber);
        return {
            date: new Date(block.timestamp * 1000),
            recipient: e.returnValues.recipient,
            value: e.returnValues.value,
        }
    }));
    return events.sort((a, b) => b.date - a.date);
}

function getWithdrawnEventsForPrivateOffering_1() {
    return getWithdrawnEvents(privateOfferingDistribution_1);
}

function getWithdrawnEventsForPrivateOffering_2() {
    return getWithdrawnEvents(privateOfferingDistribution_2);
}

module.exports = {
    makeInstallment,
    get,
    getDistributionBalance,
    getLastInstallmentDate,
    getWalletBalance,
    getWithdrawnEventsForPrivateOffering_1,
    getWithdrawnEventsForPrivateOffering_2,
};
