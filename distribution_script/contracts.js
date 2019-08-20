const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const Distribution = require('../build/contracts/Distribution.json');
const ERC677BridgeToken = require('../build/contracts/ERC677BridgeToken.json');
const { REWARD_FOR_STAKING } = require('./constants');

let networkId;
let url = `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURA_ID}`;

switch (process.env.NETWORK) {
    case 'mainnet':
        networkId = '1';
        break;
    case 'kovan':
        networkId = '42';
        break;
    default:
        networkId = '5777';
        url = 'http://localhost:8545';
        break;
}

const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);

const distribution = new web3.eth.Contract(Distribution.abi, Distribution.networks[networkId].address);
const token = new web3.eth.Contract(ERC677BridgeToken.abi, ERC677BridgeToken.networks[networkId].address);

const keyObject = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallet.json'), 'utf8'));
const account = web3.eth.accounts.decrypt(keyObject, process.env.PASSWORD);
web3.eth.accounts.wallet.add(account);

distribution.options.from = account.address;


async function unlockRewardForStaking() {
    const gas = await distribution.methods.unlockRewardForStaking().estimateGas();
    return distribution.methods.unlockRewardForStaking().send({ gas });
}

async function makeInstallment(pool) {
    const gas = await distribution.methods.makeInstallment(pool).estimateGas();
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

function getRewardForStakingUnlockedEvents() {
    return distribution.getPastEvents('RewardForStakingUnlocked', { fromBlock: 0 });
}

function getBlock(blockNumber) {
    return web3.eth.getBlock(blockNumber);
}

async function getLastInstallmentDate(pool) {
    let events;
    if (pool === REWARD_FOR_STAKING) {
        events = await getRewardForStakingUnlockedEvents();
    } else {
        events = await getInstallmentsEvents(pool);
    }
    const lastEvent = events.sort((a, b) => a.blockNumber < b.blockNumber)[0];
    let date = null;
    if (lastEvent) {
        const block = await getBlock(lastEvent.blockNumber);
        date = new Date(block.timestamp * 1000);
    }
    return date;
}

module.exports = {
    unlockRewardForStaking,
    makeInstallment,
    get,
    getDistributionBalance,
    getLastInstallmentDate,
};
