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

## Roles

### Owner

The owner is supposed to be a MultiSig Wallet contract. The owner can only call the following functions:

- `ERC677BridgeToken.transferOwnership` to transfer ownership of the `ERC677BridgeToken` contract to another address;
- `ERC677BridgeToken.setBridgeContract` to set the address of bridge contract;
- `ERC677BridgeToken.claimTokens` to transfer coins or specified tokens to the specified address if someone sent coins/tokens to the contract mistakenly;
- `Distribution.transferOwnership` to transfer ownership of the `Distribution` contract to another address;
- `Distribution.initialize` to initialize `Distribution` and `PrivateOfferingDistribution` contracts;
- `Distribution.setBridgeAddress` to set the address of bridge contract to use the address in the `Distribution.unlockRewardForStaking` function;
- `PrivateOfferingDistribution.transferOwnership` to transfer ownership of the `PrivateOfferingDistribution` contract to another address;
- `PrivateOfferingDistribution.addParticipants` to add Private Offering participants before initializing;
- `PrivateOfferingDistribution.finalizeParticipants` to finalize the list of Private Offering participants;
- `PrivateOfferingDistribution.setDistributionAddress` to set the `Distribution` contract address;
- `PrivateOfferingDistribution.burn` to burn unallocated tokens.

### Any address

The following methods can be called by anyone:

- `Distribution.unlockRewardForStaking` to transfer part of tokens to the bridge contract;
- `Distribution.makeInstallment` to transfer weekly installment to specified pool.

### Private Offering participant

- `PrivateOfferingDistribution.withdraw` to withdraw participant share.
