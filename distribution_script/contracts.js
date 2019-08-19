const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const Distribution = require('../build/contracts/Distribution.json');
const ERC677BridgeToken = require('../build/contracts/ERC677BridgeToken.json');

const provider = new Web3.providers.HttpProvider('http://localhost:8545');
const web3 = new Web3(provider);

const distribution = new web3.eth.Contract(Distribution.abi, Distribution.networks['5777'].address);
const token = new web3.eth.Contract(ERC677BridgeToken.abi, ERC677BridgeToken.networks['5777'].address);

const keyObject = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallet.json'), 'utf8'));
const account = web3.eth.accounts.decrypt(keyObject, process.env.PASSWORD);
web3.eth.accounts.wallet.add(account);

function unlockRewardForStaking() {
    return distribution.methods.unlockRewardForStaking().send({
        from: account.address,
        gas: 3000000,
    });
}

function makeInstallment(pool) {
    return distribution.methods.makeInstallment(pool).send({
        from: account.address,
        gas: 3000000,
    });
}

function get(method, ...args) {
    return distribution.methods[method](...args).call();
}

function getDistributionBalance() {
    return token.methods.balanceOf(distribution._address).call();
}

module.exports = {
    unlockRewardForStaking,
    makeInstallment,
    get,
    getDistributionBalance,
};
