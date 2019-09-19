
const { BN, toWei } = web3.utils;

const ERROR_MSG = 'VM Exception while processing transaction: revert';

const TOKEN_NAME = 'DPOS staking token';
const TOKEN_SYMBOL = 'DPOS';

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const STAKING_EPOCH_DURATION = new BN(604800);

const ECOSYSTEM_FUND = 1;
const PUBLIC_OFFERING = 2;
const PRIVATE_OFFERING = 3;
const FOUNDATION_REWARD = 4;
const EXCHANGE_RELATED_ACTIVITIES = 5;

function getPoolAddresses(accounts) {
    return {
        [ECOSYSTEM_FUND]: accounts[1],
        [PUBLIC_OFFERING]: accounts[2],
        [FOUNDATION_REWARD]: accounts[3],
        [EXCHANGE_RELATED_ACTIVITIES]: accounts[4],
    };
}

const stake = {
    [ECOSYSTEM_FUND]: new BN(toWei('12500000')),
    [PUBLIC_OFFERING]: new BN(toWei('1000000')),
    [PRIVATE_OFFERING]: new BN(toWei('8500000')),
    [FOUNDATION_REWARD]: new BN(toWei('4000000')),
    [EXCHANGE_RELATED_ACTIVITIES]: new BN(toWei('1000000')),
};

const cliff = {
    [ECOSYSTEM_FUND]: new BN(48).mul(STAKING_EPOCH_DURATION),
    [PUBLIC_OFFERING]: new BN(0),
    [PRIVATE_OFFERING]: new BN(4).mul(STAKING_EPOCH_DURATION),
    [FOUNDATION_REWARD]: new BN(12).mul(STAKING_EPOCH_DURATION),
};

const percentAtCliff = {
    [ECOSYSTEM_FUND]: 10,
    [PRIVATE_OFFERING]: 10,
    [FOUNDATION_REWARD]: 20,
};

const numberOfInstallments = {
    [ECOSYSTEM_FUND]: new BN(96),
    [PRIVATE_OFFERING]: new BN(32),
    [FOUNDATION_REWARD]: new BN(36),
};

const PRIVATE_OFFERING_PRERELEASE = 25; // 25%

const SUPPLY = new BN(toWei('27000000'));

function getPrivateOfferingData(accounts) {
    return {
        privateOfferingParticipants: [accounts[6], accounts[7]],
        privateOfferingParticipantsStakes: [new BN(toWei('3000000')), new BN(toWei('5500000'))],
    };
}

module.exports = accounts => ({
    ERROR_MSG,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    EMPTY_ADDRESS,
    STAKING_EPOCH_DURATION,
    ECOSYSTEM_FUND,
    PUBLIC_OFFERING,
    PRIVATE_OFFERING,
    FOUNDATION_REWARD,
    EXCHANGE_RELATED_ACTIVITIES,
    owner: accounts[0],
    address: getPoolAddresses(accounts),
    stake,
    cliff,
    percentAtCliff,
    numberOfInstallments,
    PRIVATE_OFFERING_PRERELEASE,
    SUPPLY,
    ...getPrivateOfferingData(accounts),
});
