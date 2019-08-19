const express = require('express');
const fs = require('fs');
const path = require('path');
const { BN, fromWei } = require('web3').utils;
const { STAKING_EPOCH_DURATION, poolNames, pools } = require('./constants');
const contracts = require('./contracts');

const router = express.Router();

router.get('/health-check', async (req, res) => {
    const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

    const now = Date.now() / 1000; // in seconds

    const data = pools.map(pool => {
        const data = {
            pool: poolNames[pool],
            lastInstallmentDate: new Date(db.lastInstallmentTimestamp[pool] * 1000),
            timeFromLastInstallment: Math.floor(now - db.lastInstallmentTimestamp[pool]), // in seconds
            numberOfInstallmentsMade: db.numberOfInstallmentsMade[pool],
            numberOfInstallmentsLeft: db.numberOfInstallments[pool] - db.numberOfInstallmentsMade[pool],
            stake: fromWei(db.stake[pool]),
            tokensLeft: fromWei(db.tokensLeft[pool]),
            tokensDistributed: fromWei(new BN(db.stake[pool]).sub(new BN(db.tokensLeft[pool])).toString()),
            ok: true,
        };
        return data;
    });

    res.send({
        balance: await contracts.getDistributionBalance(),
        pools: data,
    });
});

module.exports = router;
