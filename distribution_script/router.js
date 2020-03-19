const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { BN, fromWei } = require('web3').utils;
const {
    poolNames,
    pools,
    PRIVATE_OFFERING_1,
    PRIVATE_OFFERING_2,
    DAY_IN_SECONDS,
} = require('./constants');
const contracts = require('./contracts');

const router = express.Router();

function checkNumberOfInstallments(db, pool, tooMuchTimeHasPassed) {
    let error = null;
    let secondsFromCliff = Date.now() / 1000 - (db.distributionStartTimestamp + db.cliff[pool] * DAY_IN_SECONDS);
    if (secondsFromCliff < 0) {
        secondsFromCliff = 0;
    }
    let expectedNumberInstallmentsMade = Math.floor(secondsFromCliff / DAY_IN_SECONDS);
    expectedNumberInstallmentsMade = Math.min(expectedNumberInstallmentsMade, db.numberOfInstallments[pool]);
    const diff = expectedNumberInstallmentsMade - db.numberOfInstallmentsMade[pool];
    if (diff > 1 || diff < 0 || (diff === 1 && tooMuchTimeHasPassed)) {
        error = `Expected number of made installments to equal ${expectedNumberInstallmentsMade} but got ${db.numberOfInstallmentsMade[pool]}`;
    }
    return error;
}

function checkDistributedValue(db, pool) {
    let error = null;
    let [stake, valueAtCliff, numberOfInstallments] = [
        new BN(db.stake[pool]),
        new BN(db.valueAtCliff[pool]),
        new BN(db.numberOfInstallments[pool]),
    ];
    let preinstallmentValue = new BN(0);
    let installmentValue = new BN(0);
    if (pool === PRIVATE_OFFERING_1) {
        preinstallmentValue = stake.mul(new BN(25)).div(new BN(100)); // 25%
        const preinstallmentAndCliffValue = stake.mul(new BN(35)).div(new BN(100)); // 35%
        installmentValue = stake.sub(preinstallmentAndCliffValue).div(numberOfInstallments);
    } else if (pool === PRIVATE_OFFERING_2) {
        preinstallmentValue = stake.mul(new BN(15)).div(new BN(100)); // 15%
        const preinstallmentAndCliffValue = stake.mul(new BN(20)).div(new BN(100)); // 20%
        installmentValue = stake.sub(preinstallmentAndCliffValue).div(numberOfInstallments);
    } else if (numberOfInstallments.toNumber() > 0) {
        installmentValue = stake.sub(valueAtCliff).sub(preinstallmentValue).div(numberOfInstallments);
    }
    
    let expectedValue = preinstallmentValue;
    const cliffTime = db.distributionStartTimestamp + db.cliff[pool] * DAY_IN_SECONDS;
    if ((Date.now() / 1000) >= cliffTime && db.wasValueAtCliffPaid[pool]) {
        const installmentsMadeValue = new BN(db.numberOfInstallmentsMade[pool]).mul(installmentValue);
        expectedValue = expectedValue.add(valueAtCliff.add(installmentsMadeValue));
    }
    const distributedValue = new BN(db.stake[pool]).sub(new BN(db.tokensLeft[pool]));
    if (!distributedValue.eq(expectedValue)) {
        error = `Expected distributed value to equal ${expectedValue} but got ${distributedValue}`;
    }
    return error;
}

router.get('/health-check', async (req, res) => {
    const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

    const responseData = {
        distributionStartDate: new Date(db.distributionStartTimestamp * 1000),
        distributionContractTokenBalance: await contracts.getDistributionBalance(),
        walletEthBalance: await contracts.getWalletBalance(),
        ok: true,
        errors: [],
    };

    responseData.pools = await Promise.all(pools.map(async pool => {
        let lastInstallmentDateFromEvent = await contracts.getLastInstallmentDate(pool);

        const secondsFrom = time => Math.floor((new Date() - new Date(time)) / 1000);

        let timeFromLastInstallment = null;
        let secondsFromLastInstallment = 0;
        if (lastInstallmentDateFromEvent) {
            secondsFromLastInstallment = secondsFrom(lastInstallmentDateFromEvent);
            timeFromLastInstallment = moment(lastInstallmentDateFromEvent).fromNow();
        }

        const lastDBUpdateDate = db.lastDBUpdateDate[pool];
        let timeFromLastDBUpdate = null;
        let secondsFromLastDBUpdate = 0;
        if (lastDBUpdateDate) {
            secondsFromLastDBUpdate = secondsFrom(lastDBUpdateDate);
            timeFromLastDBUpdate = moment(lastDBUpdateDate).fromNow();
        }
        
        const data = {
            pool: poolNames[pool],
            lastInstallmentDateFromScript: new Date(db.lastInstallmentTimestamp[pool]),
            lastInstallmentDateFromEvent,
            timeFromLastInstallment,
            numberOfInstallmentsMade: db.numberOfInstallmentsMade[pool],
            numberOfInstallmentsLeft: db.numberOfInstallments[pool] - db.numberOfInstallmentsMade[pool],
            stake: db.stake[pool],
            tokensLeft: db.tokensLeft[pool],
            tokensDistributed: new BN(db.stake[pool]).sub(new BN(db.tokensLeft[pool])).toString(),
            lastDBUpdateDate,
            timeFromLastDBUpdate,
            errors: [],
        };

        if (!db.installmentsEnded[pool]) {
            let tooMuchTimeHasPassed = false;
            if (timeFromLastInstallment === null) {
                data.errors.push('Time passed since the last installment is unknown');
            }
            if (secondsFromLastInstallment > DAY_IN_SECONDS * 1.1) {
                tooMuchTimeHasPassed = true;
                data.errors.push('Too much time has passed since last installment');
            }       
            if (secondsFromLastDBUpdate > DAY_IN_SECONDS) {
                data.errors.push('Too much time has passed since last DB update');
            }
            data.errors.push(
                checkNumberOfInstallments(db, pool, tooMuchTimeHasPassed),
                checkDistributedValue(db, pool),
            );
            data.errors = data.errors.filter(error => !!error);
            if (data.errors.length > 0) {
                responseData.ok = false;
            }
        }

        return data;
    }));

    const sumOfTokensLeft = responseData.pools.reduce((acc, cur) => acc.add(new BN(cur.tokensLeft)), new BN(0))
    if (!sumOfTokensLeft.eq(new BN(responseData.distributionContractTokenBalance))) {
        responseData.errors.push('The sum of tokens left is not equal to contract balance');
        responseData.ok = false;
    }

    res.send(responseData);
});

router.get('/private-offering-1', async (req, res) => {
    const data = await contracts.getWithdrawnEventsForPrivateOffering_1();
    res.send(data);
});

router.get('/private-offering-2', async (req, res) => {
    const data = await contracts.getWithdrawnEventsForPrivateOffering_2();
    res.send(data);
});

module.exports = router;
