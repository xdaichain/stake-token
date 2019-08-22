# Distribution script

## Files
- **index.js** - starting point. Runs the server on specified port
- **worker.js** - contains the logic to periodically call Distribution smart contract (each staking epoch duration) and store the contract's and call's data in local database (db.json file)
- **router.js** - contains health check API
- **contract.js** - contains the logic of all interactions with smart contracts
- **constants.js** - contains the constant variables of the script

## Run
Before running you need to make sure that you:
- initialized the distribution
- set the bridge contract address
- approved tokens from REWARD_FOR_STAKING pool address to distribution address
```
WALLET_PATH=**** WALLET_PASSWORD=**** NETWORK=**** INFURA_ID=**** npm run distribution-script
```
WALLET_PATH - custom path for keystore file
WALLET_PASSWORD - password to your wallet stored in keystore file
NETWORK - name of the network (mainnet, kovan). If no one is specified the local network will be used
INFURA_ID - Infura project id

### What happens when you run the script
At first start the script creates the local database (`db.json`) and initialize it with the required data from Distribution smart contract. Then it calculates the time frame when it should call the smart contract based on `distribution start timestamp` and `staking epoch duration`, and starts the calls with intervals (each call create a job that should do the same call after 1 staking epoch duration). The function `call()` checks if installment is available and tries to make it for each pool

## API
### GET /health-check
Response example:
```
{
    "distributionStartDate": "2019-08-22T14:20:15.000Z",
    "balance": "18536024305555555555555560", // distribution contract balance
    "pools": [
        {
            "pool": "ECOSYSTEM_FUND",
            "lastInstallmentDateFromScript": "2019-08-20T12:10:47.110Z", // date of the last intallment that was made by this script
            "lastInstallmentDateFromEvent": "2019-08-20T12:10:47.000Z", // date of the last installment (anyone can make an installment)
            "timeFromLastInstallment": "8 days", // time from "lastInstallmentDateFromEvent"
            "numberOfInstallmentsMade": 10,
            "numberOfInstallmentsLeft": 86,
            "stake": "12500000",
            "tokensLeft": "10950000",
            "tokensDistributed": "1550000",
            "ok": false, // true if no errors
            "errors": [
                "Too much time has passed since last installment"
            ]
        }
    ]
}
```
Possible errors:
1. `"Too much time has passed since last installment"` - when `timeFromLastInstallment` is more than `staking epoch duration`
2. `"Expected number of made installment to equal 10 but got 9"` - when expected (possible) number of installments is more than `numberOfInstallmentsMade`
3. `"Expected distributed value to equal 125000 but got 125001"` - when something went wrong and we have the wrong distributed value
