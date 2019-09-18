
const { BN, toWei } = web3.utils;

const ERROR_MSG = 'VM Exception while processing transaction: revert';

const TOKEN_NAME = 'DPOS staking token';
const TOKEN_SYMBOL = 'DPOS';

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const WEEK_IN_SECONDS = new BN(604800);
const DAY_IN_SECONDS = new BN(86400);

const REWARD_FOR_STAKING = 1;
const ECOSYSTEM_FUND = 2;
const PUBLIC_OFFERING = 3;
const PRIVATE_OFFERING = 4;
const FOUNDATION_REWARD = 5;
const EXCHANGE_RELATED_ACTIVITIES = 6;

function getPoolAddresses(accounts) {
    return {
        [REWARD_FOR_STAKING]: accounts[1],
        [ECOSYSTEM_FUND]: accounts[2],
        [PUBLIC_OFFERING]: accounts[3],
        [FOUNDATION_REWARD]: accounts[4],
        [EXCHANGE_RELATED_ACTIVITIES]: accounts[5],
    };
}

const stake = {
    [REWARD_FOR_STAKING]: new BN(toWei('73000000')),
    [ECOSYSTEM_FUND]: new BN(toWei('12500000')),
    [PUBLIC_OFFERING]: new BN(toWei('1000000')),
    [PRIVATE_OFFERING]: new BN(toWei('8500000')),
    [FOUNDATION_REWARD]: new BN(toWei('4000000')),
    [EXCHANGE_RELATED_ACTIVITIES]: new BN(toWei('1000000')),
};

const cliff = {
    [REWARD_FOR_STAKING]: new BN(12).mul(WEEK_IN_SECONDS),
    [ECOSYSTEM_FUND]: new BN(48).mul(WEEK_IN_SECONDS),
    [PUBLIC_OFFERING]: new BN(0),
    [PRIVATE_OFFERING]: new BN(4).mul(WEEK_IN_SECONDS),
    [FOUNDATION_REWARD]: new BN(12).mul(WEEK_IN_SECONDS),
};

const percentAtCliff = {
    [ECOSYSTEM_FUND]: 10,
    [PRIVATE_OFFERING]: 10,
    [FOUNDATION_REWARD]: 20,
};

const numberOfInstallments = {
    [ECOSYSTEM_FUND]: new BN(672),
    [PRIVATE_OFFERING]: new BN(224),
    [FOUNDATION_REWARD]: new BN(252),
};

const PRIVATE_OFFERING_PRERELEASE = 25; // 25%

const SUPPLY = new BN(toWei('100000000'));

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
    WEEK_IN_SECONDS,
    DAY_IN_SECONDS,
    REWARD_FOR_STAKING,
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
