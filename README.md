# DPOS Token Distribution
A repository for DPOS token initialization and distribution used by POSDAO implementation

## Related links:
- Documentation: https://poanetwork.github.io/dpos-token/
- Distribution model: https://forum.poa.network/t/dpos-staking-token-rewards-and-emission-model/2469
- POSDAO repository: https://github.com/poanetwork/posdao-contracts
- POSDAO White Paper: https://forum.poa.network/t/posdao-white-paper/2208

## Usage
### Install Dependencies
```
npm install
```
### Testing
```
npm run test
```

### Deployment

1. Deploy `PrivateOfferingDistribution` contract, pass the `_privateOfferingParticipants`, `_privateOfferingParticipantsStakes` arrays to its `addParticipants` function, and then call `finalizeParticipants` function. \
\
The `finalizeParticipants` function will add `address(0)` to the participant set if the share of the `address(0)` is not zero.

2. Deploy the `Distribution` contract. Pass staking epoch duration, the addresses of all participants (including the `PrivateOfferingDistribution` address) to its constructor.

3. Call the `PrivateOfferingDistribution.setDistributionAddress` to set the address of the `Distribution` contract inside the `PrivateOfferingDistribution` contract.

4. Deploy the `ERC677BridgeToken` contract (and pass `Distribution` and `PrivateOfferingDistribution` contracts addresses to the constructor).

5. Call `initialize` function of the `Distribution` contract with `ERC677BridgeToken` address as a parameter. It releases Public Offering, Exchange Related Activities, and 25% of Private Offering tokens. The countdown for cliff periods and installments starts from this moment.

### Test deployment (Kovan)
Run your local node.
Uncomment the line with `distribution.initialize()` call in `2_deploy_contracts.js` and run:
```
REWARD_FOR_STAKING_ADDRESS=0xd35114b4cef03065b0fa585d1c2e15e8fb589507 ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 EXCHANGE_RELATED_ACTIVITIES_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea PRIVATE_OFFERING_DATA=./example.csv ./node_modules/.bin/truffle migrate --reset --network kovan
```
Note: don't forget to change the input data
