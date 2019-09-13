# DPOS Token Distribution script

This script allows you to make distribution of DPOS token timely and automatically.

The script assumes `dpos-token` contracts have already been deployed and initialized (all the steps listed in https://github.com/poanetwork/dpos-token/blob/master/README.md have been passed).

## Run

Before running add `.env` file in root folder:
```
WALLET_PATH=*****       // custom path for keystore file (default: '/distribution_script/wallet.json')
WALLET_PASSWORD=*****   // password to your wallet stored in keystore file
NETWORK=*****           // name of the network: mainnet, kovan, development (default: mainnet)
INFURA_ID=*****         // Infura project id
```

Then run:
```
npm run distribution-script
```

It will start the server at port `3000` that will be making installments automatically. Also it will provide health-check API described below.

### What happens when you run the script

At first start the script creates the local database (`db.json`) and initializes it with the required data from the `Distribution` smart contract (`distribution start timestamp`, `staking epoch duration`, and pools data like `stake`, `cliff`, etc.).


Then it calculates the time frame when it should call the smart contract based on `distribution start timestamp` and `staking epoch duration`, and starts the calls with intervals: each call creates a job (https://github.com/kelektiv/node-cron) that should do the same call after 1 staking epoch duration. The function `call()` checks if installment is available and tries to make it for each pool.


If the server accidentally restarts after, say, 6 days since the moment of staking epoch beginning, then it will try to make installments at time of restart and next call will be in 1 day (if staking epoch duration is 7 days).

## API
### GET /health-check

This endpoint returns the current values of the `Distribution` contract and pools. It has `ok` and `errors` fields for each pool for cases when something goes wrong.


Response example:
```
{
  "distributionStartDate": "2019-08-22T14:20:15.000Z",
  "balance": "18536024305555555555555560",                          // distribution contract balance
  "pools": [
    {
      "pool": "ECOSYSTEM_FUND",
      "lastInstallmentDateFromScript": "2019-08-20T12:10:47.110Z",  // date of the last intallment that was made by this script
      "lastInstallmentDateFromEvent": "2019-08-20T12:10:47.000Z",   // date of the last installment (anyone can make an installment)
      "timeFromLastInstallment": "8 days",                          // time from "lastInstallmentDateFromEvent"
      "numberOfInstallmentsMade": 10,
      "numberOfInstallmentsLeft": 86,
      "stake": "12500000",
      "tokensLeft": "10950000",
      "tokensDistributed": "1550000",
      "ok": false,                                                  // true if no errors
      "errors": [
        "Too much time has passed since last installment"
      ]
    }
  ]
}
```
Possible errors:
1. `"Too much time has passed since last installment"` - when `timeFromLastInstallment` is more than `staking epoch duration`.
2. `"Expected number of made installment to equal 10 but got 9"` - when expected (possible) number of installments is more than `numberOfInstallmentsMade`.
3. `"Expected distributed value to equal 125000 but got 125001"` - when something went wrong and we have the wrong distributed value.

## Files structure
- `/contracts` - folder that contains `json`-files with contracts addresses and abis;\
- `constants.js` - contains the constant variables of the script. Used by the `contracts.js`, `router.js`, and `worker.js`;\
- `contracts.js` - contains the logic of all interactions with smart contracts. Used by the `router.js` and `worker.js`;\
- `index.js` - starting point. Runs the server on specified port;\
- `router.js` - contains health-check API. Outputs the response for `GET /health-check` request. Used by the `index.js`;\
- `worker.js` - contains the logic to periodically call Distribution smart contract (each staking epoch duration) and store the contract's and call's data in local database. Used by the `index.js`.




## Database
Example of data stored in `db.json`:
```
{
    "stakingEpochDuration": 604800,           // (in seconds)
    "distributionStartTimestamp": 1567446114, // (in seconds)
    "stake": {                                // pools stakes
        "1": "73000000000000000000000000",
        "2": "12500000000000000000000000",
        "4": "8500000000000000000000000",
        "5": "4000000000000000000000000"
    },
    "tokensLeft": {                           // remaining tokens for each pool
        "1": "0",
        "2": "12500000000000000000000000",
        "4": "2935156250000000000000000",
        "5": "2577777777777777777777784"
    },
    "cliff": {                                // pools cliffs
        "1": 12,
        "2": 48,
        "4": 4,
        "5": 12
    },
    "valueAtCliff": {                         // pools values at cliff
        "1": "0",
        "2": "1250000000000000000000000",
        "4": "850000000000000000000000",
        "5": "800000000000000000000000"
    },
    "numberOfInstallments": {                 // total number of installment for each pool
        "1": 0,
        "2": 96,
        "4": 32,
        "5": 36
    },
    "numberOfInstallmentsMade": {             // number of made installments for each pool
        "1": 0,
        "2": 0,
        "4": 15,
        "5": 7
    },
    "lastInstallmentTimestamp": {             // last installment time for each pool (in seconds)
        "1": 1567446150182,
        "4": 1567446171167,
        "5": 1567446171294
    },
    "wasValueAtCliffPaid": {                  // was value at cliff paid for each pool
        "1": false,
        "2": false,
        "4": true,
        "5": true
    },
    "installmentsEnded": {                    // are installments ended for each pool
        "1": true,
        "2": false,
        "4": false,
        "5": false
    }
}
```
Pools:\
1 - Staking Reward,\
2 - Ecosystem Fund,\
4 - Private Offering,\
5 - Foundation Reward.
