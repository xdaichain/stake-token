
const { BN, toWei } = web3.utils;

const ERROR_MSG = 'VM Exception while processing transaction: revert';

const TOKEN_NAME = 'STAKE';
const TOKEN_SYMBOL = 'STAKE';

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const WEEK_IN_SECONDS = new BN(604800);
const DAY_IN_SECONDS = new BN(86400);

const ECOSYSTEM_FUND = 1;
const PUBLIC_OFFERING = 2;
const PRIVATE_OFFERING = 3;
const ADVISORS_REWARD = 4;
const FOUNDATION_REWARD = 5;
const LIQUIDITY_FUND = 6;

const INITIAL_STAKE_AMOUNT = new BN(toWei('260000'));

function getPoolAddresses(accounts) {
    return {
        [ECOSYSTEM_FUND]: accounts[1],
        [PUBLIC_OFFERING]: accounts[2],
        [FOUNDATION_REWARD]: accounts[3],
        [LIQUIDITY_FUND]: accounts[4],
    };
}

const stake = {
    [ECOSYSTEM_FUND]: new BN(toWei('4000000')),
    [PUBLIC_OFFERING]: new BN(toWei('400000')),
    [PRIVATE_OFFERING]: new BN(toWei('1970951')),
    [ADVISORS_REWARD]: new BN(toWei('651000')),
    [FOUNDATION_REWARD]: new BN(toWei('699049')),
    [LIQUIDITY_FUND]: new BN(toWei('816500')),
};

const cliff = {
    [ECOSYSTEM_FUND]: new BN(336).mul(DAY_IN_SECONDS),
    [PUBLIC_OFFERING]: new BN(0),
    [PRIVATE_OFFERING]: new BN(28).mul(DAY_IN_SECONDS),
    [ADVISORS_REWARD]: new BN(84).mul(DAY_IN_SECONDS),
    [FOUNDATION_REWARD]: new BN(84).mul(DAY_IN_SECONDS),
};

const percentAtCliff = {
    [ECOSYSTEM_FUND]: 20,
    [PRIVATE_OFFERING]: 10,
    [ADVISORS_REWARD]: 20,
    [FOUNDATION_REWARD]: 20,
};

const numberOfInstallments = {
    [ECOSYSTEM_FUND]: new BN(336),
    [PRIVATE_OFFERING]: new BN(224),
    [ADVISORS_REWARD]: new BN(252),
    [FOUNDATION_REWARD]: new BN(252),
};

const prerelease = {
    [PRIVATE_OFFERING]: 25,
};

const SUPPLY = new BN(toWei('8537500'));

function getPrivateOfferingData(accounts) {
    return {
        privateOfferingParticipants: [accounts[6], accounts[7]],
        privateOfferingParticipantsStakes: [new BN(toWei('100000')), new BN(toWei('1800000'))],
    };
}

function getAdvisorsRewardData(accounts) {
    return {
        advisorsRewardParticipants: [accounts[6], accounts[7]],
        advisorsRewardParticipantsStakes: [new BN(toWei('600000')), new BN(toWei('50000'))],
    };
}

module.exports = accounts => ({
    ERROR_MSG,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    EMPTY_ADDRESS,
    WEEK_IN_SECONDS,
    DAY_IN_SECONDS,
    ECOSYSTEM_FUND,
    PUBLIC_OFFERING,
    PRIVATE_OFFERING,
    ADVISORS_REWARD,
    FOUNDATION_REWARD,
    LIQUIDITY_FUND,
    INITIAL_STAKE_AMOUNT,
    owner: accounts[0],
    address: getPoolAddresses(accounts),
    stake,
    cliff,
    percentAtCliff,
    numberOfInstallments,
    prerelease,
    SUPPLY,
    ...getPrivateOfferingData(accounts),
    ...getAdvisorsRewardData(accounts),
});
