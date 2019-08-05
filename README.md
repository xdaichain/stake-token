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
1. Deploy `Distribution` contract. Pass staking epoch duration, the addresses of all participants and private offering participants stakes amounts to the constructor.

2. Deploy `ERC677BridgeToken` contract. The total supply is minted at that moment to the `Distribution` contract address that should be passed to the constructor.

3. Call `initialize` function of the `Distribution` contract with `ERC677BridgeToken` address as a parameter. It releases Public Offering, Exchange Related Activities, and 25% of Private Offering tokens. The countdown for cliff periods and installments starts from this moment.
