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
    if (db.distributionStartTimestamp) return;

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
    updateDatabase();
}

function getPastEpochs() {
    const now = Date.now() / 1000;
    return Math.floor((now - db.distributionStartTimestamp) / db.stakingEpochDuration);
}

async function makeInstallment(pool) {
    try {
        const pastEpochs = getPastEpochs();

        if (pastEpochs < db.cliff[pool] || db.installmentsEnded[pool]) {
            console.log('Installments are not active for', poolNames[pool]);
            return;
        }

        if (pool === REWARD_FOR_STAKING) {
            await contracts.unlockRewardForStaking();
        } else {
            const isInstallmentAvailable = pastEpochs > db.cliff[pool] + db.numberOfInstallmentsMade[pool];
            if (!db.wasValueAtCliffPaid[pool] || isInstallmentAvailable) {
                await contracts.makeInstallment(pool);
            } else {
                console.log('No installments available for', poolNames[pool]);
            }
        }

        await updateDynamicPoolData(pool);
        db.lastInstallmentTimestamp[pool] = Date.now();

        console.log('Installment has been made for', poolNames[pool]);
    } catch (error) {
        console.log(error);
    }
}

function installmentsActive() {
    const activePools = pools.map(pool => db.installmentsEnded[pool]).filter(bool => !bool);
    return activePools.length > 0;
}

async function call(callTimestamp) {
    try {
        console.log('call');

        for (let i = 0; i < pools.length; i++) {
            await makeInstallment(pools[i]);
        }

        updateDatabase();

        if (installmentsActive()) {
            const nextTimestamp = callTimestamp + (db.stakingEpochDuration * 1000);
            const nextDate = new Date(nextTimestamp);
            new CronJob(nextDate, () => call(nextTimestamp), null, true);
        } else {
            console.log('All installments were made!');
        }
    } catch (error) {
        console.log(error);
    }
}

initialize().then(() => {
    const pastEpochs = getPastEpochs(); // past epochs since Distribution initialization
    const lastEpochTimestamp = (db.distributionStartTimestamp + pastEpochs * db.stakingEpochDuration) * 1000; // milliseconds
    call(lastEpochTimestamp);
});
