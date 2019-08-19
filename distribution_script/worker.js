const fs = require('fs');
const path = require('path');
const CronJob = require('cron').CronJob;

const {
    REWARD_FOR_STAKING,
    ECOSYSTEM_FUND,
    PRIVATE_OFFERING,
    FOUNDATION_REWARD,
    poolNames,
    pools,
} = require('./constants');

const contracts = require('./contracts');

let db;
initializeDatabase();

function initializeDatabase() {
    try {
        db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
    } catch (error) {
        db = {
            initialized: false,
            stakingEpochDuration: 0,
            distributionStartTimestamp: 0,
            stake: {},
            tokensLeft: {},
            cliff: {},
            valueAtCliff: {},
            numberOfInstallments: {},
            numberOfInstallmentsMade: {},
            lastInstallmentTimestamp: {},
            wasValueAtCliffPaid: {},
            installmentsEnded: {},
        };
        updateDatabase();
    }
}

function updateDatabase() {
    fs.writeFileSync(path.join(__dirname, 'db.json'), JSON.stringify(db, null, 4), 'utf8');
}

async function updateDynamicPoolData(pool) {
    const data = await Promise.all(
        [
            'numberOfInstallmentsMade',
            'wasValueAtCliffPaid',
            'installmentsEnded',
            'tokensLeft',
        ].map(variable => contracts.get(variable, pool))
    );
    db.numberOfInstallmentsMade[pool] = Number(data[0]);
    db.wasValueAtCliffPaid[pool] = data[1];
    db.installmentsEnded[pool] = data[2];
    db.tokensLeft[pool] = data[3];
}

async function initialize() {
    if (db.initialized) return;

    const data = await Promise.all([
        contracts.get('distributionStartTimestamp'),
        contracts.get('stakingEpochDuration'),
    ]);
    db.distributionStartTimestamp = Number(data[0]);
    db.stakingEpochDuration = Number(data[1]);

    if (db.distributionStartTimestamp === 0) {
        throw Error('the distribution is not initialized');
    }

    await Promise.all(
        pools.map(async pool => {
            const data = await Promise.all(
                [
                    'cliff',
                    'numberOfInstallments',
                    'stake',
                    'valueAtCliff',
                ].map(variable => contracts.get(variable, pool))
            );
            db.cliff[pool] = data[0] / db.stakingEpochDuration;
            db.numberOfInstallments[pool] = Number(data[1]);
            db.stake[pool] = data[2];
            db.valueAtCliff[pool] = data[3];
            await updateDynamicPoolData(pool);
        })
    );
    db.initialized = true;
    updateDatabase();
}

async function unlockRewardForStaking() {
    try {
        const now = Date.now() / 1000;
        const pastEpochs = (now - db.distributionStartTimestamp) / db.stakingEpochDuration;

        if (pastEpochs < db.cliff[REWARD_FOR_STAKING] || db.installmentsEnded[REWARD_FOR_STAKING]) {
            console.log('Installments are not active for', poolNames[REWARD_FOR_STAKING]);
            return;
        }

        await contracts.unlockRewardForStaking();
        await updateDynamicPoolData(REWARD_FOR_STAKING);
        db.lastInstallmentTimestamp[REWARD_FOR_STAKING] = Math.floor(Date.now() / 1000);

        console.log('Reward for Staking has been unlocked');
    } catch (error) {
        console.log(error);
    }
}

async function makeInstallment(pool) {
    try {
        const now = Date.now() / 1000;
        const pastEpochs = (now - db.distributionStartTimestamp) / db.stakingEpochDuration;

        if (pastEpochs < db.cliff[pool] || db.installmentsEnded[pool]) {
            console.log('Installments are not active for', poolNames[pool]);
            return;
        }

        if (!db.wasValueAtCliffPaid[pool] || pastEpochs > db.cliff[pool] + db.numberOfInstallmentsMade[pool]) {
            await contracts.makeInstallment(pool);
            await updateDynamicPoolData(pool);
            db.lastInstallmentTimestamp[pool] = Math.floor(Date.now() / 1000);

            console.log('Installment has been made for', poolNames[pool]);
        }
    } catch (error) {
        console.log(error);
    }
}

async function call() {
    try {
        console.log('call');

        await unlockRewardForStaking();
        await makeInstallment(ECOSYSTEM_FUND);
        await makeInstallment(PRIVATE_OFFERING);
        await makeInstallment(FOUNDATION_REWARD);

        updateDatabase();
    } catch (error) {
        console.log(error);
    }
}

initialize().then(() => {
    new CronJob(`*/${db.stakingEpochDuration} * * * * *`, call, null, true);
});
