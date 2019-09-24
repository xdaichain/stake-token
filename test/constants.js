
const { BN, toWei } = web3.utils;

const ERROR_MSG = 'VM Exception while processing transaction: revert';

const TOKEN_NAME = 'STAKE';
const TOKEN_SYMBOL = 'STAKE';

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const WEEK_IN_SECONDS = new BN(604800);
const DAY_IN_SECONDS = new BN(86400);

const ECOSYSTEM_FUND = 1;
const PUBLIC_OFFERING = 2;
const PRIVATE_OFFERING_1 = 3;
const PRIVATE_OFFERING_2 = 4;
const FOUNDATION_REWARD = 5;
const EXCHANGE_RELATED_ACTIVITIES = 6;

function getPoolAddresses(accounts) {
    return {
        [ECOSYSTEM_FUND]: accounts[1],
        [PUBLIC_OFFERING]: accounts[2],
        [FOUNDATION_REWARD]: accounts[3],
        [EXCHANGE_RELATED_ACTIVITIES]: accounts[4],
    };
}

const stake = {
    [ECOSYSTEM_FUND]: new BN(toWei('10881023')),
    [PUBLIC_OFFERING]: new BN(toWei('1000000')),
    [PRIVATE_OFFERING_1]: new BN(toWei('3908451')),
    [PRIVATE_OFFERING_2]: new BN(toWei('4210526')),
    [FOUNDATION_REWARD]: new BN(toWei('4000000')),
    [EXCHANGE_RELATED_ACTIVITIES]: new BN(toWei('3000000')),
};

const cliff = {
    [ECOSYSTEM_FUND]: new BN(48).mul(WEEK_IN_SECONDS),
    [PUBLIC_OFFERING]: new BN(0),
    [PRIVATE_OFFERING_1]: new BN(4).mul(WEEK_IN_SECONDS),
    [PRIVATE_OFFERING_2]: new BN(4).mul(WEEK_IN_SECONDS),
    [FOUNDATION_REWARD]: new BN(12).mul(WEEK_IN_SECONDS),
};

const percentAtCliff = {
    [ECOSYSTEM_FUND]: 10,
    [PRIVATE_OFFERING_1]: 10,
    [PRIVATE_OFFERING_2]: 5,
    [FOUNDATION_REWARD]: 20,
};

const numberOfInstallments = {
    [ECOSYSTEM_FUND]: new BN(672),
    [PRIVATE_OFFERING_1]: new BN(224),
    [PRIVATE_OFFERING_2]: new BN(224),
    [FOUNDATION_REWARD]: new BN(252),
};

const prerelease = {
    [PRIVATE_OFFERING_1]: 25,
    [PRIVATE_OFFERING_2]: 15,
};

const SUPPLY = new BN(toWei('27000000'));

function getPrivateOfferingData(accounts) {
    return {
        privateOfferingParticipants: [accounts[6], accounts[7]],
        privateOfferingParticipantsStakes: [new BN(toWei('1900000')), new BN(toWei('2000000'))],
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
    PRIVATE_OFFERING_1,
    PRIVATE_OFFERING_2,
    FOUNDATION_REWARD,
    EXCHANGE_RELATED_ACTIVITIES,
    owner: accounts[0],
    address: getPoolAddresses(accounts),
    stake,
    cliff,
    percentAtCliff,
    numberOfInstallments,
    prerelease,
    SUPPLY,
    ...getPrivateOfferingData(accounts),
});
