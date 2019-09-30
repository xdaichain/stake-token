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
PORT=****               // Custom server port
```

Then run:
```
npm run distribution-script
```

It will start the server at specified port (default: `3000`) that will be making installments automatically. Also it will provide health-check API described below.

Go to http://localhost:3000/health-check to see installments details (change the port to the specified one).


### What happens when you run the script

At first start the script creates the local database (`db.json`) and initializes it with the required data from the `Distribution` smart contract (`distribution start timestamp` and pools data like `stake`, `cliff`, etc.).


Then it calculates the time frame when it should call the smart contract based on `distribution start timestamp` and `installment periodicity (1 day)`, and starts the calls with intervals: each call creates a job (https://github.com/kelektiv/node-cron) that should do the same call after 1 day. The function `call()` checks if installment is available and tries to make it for each pool.


If the server accidentally restarts after, say, 6 days since the moment of staking epoch beginning, then it will try to make installments at time of restart and next call will be in 1 day (if staking epoch duration is 7 days).

If the installment for some pool fails then the script retries to make this instalment 10 times with 1 hour interval.

## API
### GET /health-check

This endpoint returns the current values of the `Distribution` contract and pools. It has common field `ok` and common and separate for each pool fields `errors` for cases when something goes wrong.


Response example:
```
{
  "distributionStartDate": "2019-08-22T14:20:15.000Z",
  "distributionContractTokenBalance": "18536024305555555555555560",
  "walletEthBalance": "99747459900000000000",   // the balance of the wallet that is used in the script
  "ok": false,  // true if no errors
  "errors": [],
  "pools": [
    {
      "pool": "ECOSYSTEM_FUND",
      "lastInstallmentDateFromScript": "2019-08-20T12:10:47.110Z",  // date of the last intallment that was made by this script
      "lastInstallmentDateFromEvent": "2019-08-20T12:10:47.000Z",   // date of the last installment (anyone can make an installment)
      "timeFromLastInstallment": "1 day",                          // time from "lastInstallmentDateFromEvent"
      "numberOfInstallmentsMade": 70,
      "numberOfInstallmentsLeft": 602,
      "stake": "12500000000000000000000000",
      "tokensLeft": "10950000000000000000000000",
      "tokensDistributed": "1550000000000000000000000",
      "lastDBUpdateDate": "2019-09-30T10:31:04.048Z",   // date of the last successful DB update
      "timeFromLastDBUpdate": "a few seconds ago", // time from "lastDBUpdateDate"
      "errors": [
        "Too much time has passed since last installment"
      ]
    }
  ]
}
```
Possible errors:
1. `"Time passed since the last installment is unknown"` - when `timeFromLastInstallment` is unknown for some reason.
2. `"Too much time has passed since last installment"` - when `timeFromLastInstallment` is more than 1 day.
3. `"Expected number of made installments to equal 10 but got 9"` - when expected (possible) number of installments is more than `numberOfInstallmentsMade`.
4. `"Expected distributed value to equal 125000 but got 125001"` - when something went wrong and we have the wrong distributed value.
5. `"Too much time has passed since last DB update"` - when the time that passed since last successful DB update is greater than 1 day
6. `"The sum of tokens left is not equal to contract balance"` - when the sum of tokens left for each pool is not equal to the contract token balance

## Files structure
- `/contracts` - folder that contains `json`-files with contracts addresses and ABIs;\
- `constants.js` - contains the constant variables of the script. Used by the `contracts.js`, `router.js`, and `worker.js`;\
- `contracts.js` - contains the logic of all interactions with smart contracts. Used by the `router.js` and `worker.js`;\
- `index.js` - starting point. Runs the server on specified port;\
- `router.js` - contains health-check API. Outputs the response for `GET /health-check` request. Used by the `index.js`;\
- `worker.js` - contains the logic to periodically call Distribution smart contract (each staking epoch duration) and store the contract's and call's data in local database. Used by the `index.js`.




## Database
Example of data stored in `db.json`:
```
{
    "distributionStartTimestamp": 1567446114, // (in seconds)
    "stake": {                                // pools stakes
        "1": "73000000000000000000000000",
        "3": "12500000000000000000000000",
        "4": "8500000000000000000000000",
        "5": "4000000000000000000000000"
    },
    "tokensLeft": {                           // remaining tokens for each pool
        "1": "0",
        "3": "12500000000000000000000000",
        "4": "2935156250000000000000000",
        "5": "2577777777777777777777784"
    },
    "cliff": {                                // pools cliffs
        "1": 12,
        "3": 48,
        "4": 4,
        "5": 12
    },
    "valueAtCliff": {                         // pools values at cliff
        "1": "0",
        "3": "1250000000000000000000000",
        "4": "850000000000000000000000",
        "5": "800000000000000000000000"
    },
    "numberOfInstallments": {                 // total number of installment for each pool
        "1": 0,
        "3": 96,
        "4": 32,
        "5": 36
    },
    "numberOfInstallmentsMade": {             // number of made installments for each pool
        "1": 0,
        "3": 0,
        "4": 15,
        "5": 7
    },
    "lastInstallmentTimestamp": {             // last installment time for each pool (in seconds)
        "1": 1567446150182,
        "3": 1567446150182,
        "4": 1567446171167,
        "5": 1567446171294
    },
    "wasValueAtCliffPaid": {                  // was value at cliff paid for each pool
        "1": false,
        "3": false,
        "4": true,
        "5": true
    },
    "installmentsEnded": {                    // are installments ended for each pool
        "1": true,
        "3": false,
        "4": false,
        "5": false
    },
    "lastDBUpdateDate": {                     // date of the last successful DB update
        "1": "2019-09-30T10:31:07.189Z",
        "3": "2019-09-30T10:31:07.477Z",
        "4": "2019-09-30T10:31:07.661Z",
        "5": "2019-09-30T10:31:07.793Z"
    }
}
```
Pools:\
1 - Ecosystem Fund,\
3 - Private Offering 1,\
4 - Private Offering 2,\
5 - Foundation Reward.
