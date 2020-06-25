# STAKE Token Distribution
A repository for STAKE token initialization and distribution used by POSDAO implementation.

## Related links:
- Security audit: 
  - in xDai's GitHub: [first report](https://github.com/xdaichain/stake-token/blob/master/audit/Quantstamp/DPOS%20token-Audit%20Final%20Report.pdf), [additional (final) report](https://github.com/xdaichain/stake-token/blob/master/audit/Quantstamp/xDAI%20STAKE%20Token%20Distribution%20-%20Additional%20Report.pdf)
  - [in Quantstamp's GitHub](https://github.com/quantstamp/DPOS-token-review)
- Contracts documentation: https://xdaichain.github.io/stake-token/docs/
- Distribution model: https://www.staketoken.net/rounds-1/stake-distribution
- POSDAO contracts repository: https://github.com/poanetwork/posdao-contracts
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

### Deployment and initialization

1. For both `Private Offering` and `Advisors Reward` distributions deploy a separate `MultipleDistribution` contract, pass the `_participants` and `_stakes` arrays to its `addParticipants` function, and then call `finalizeParticipants` function. \
\
The `finalizeParticipants` function will add `address(0)` to the participant set if the share of the `address(0)` is not zero.\
\
The `addParticipants` and `finalizeParticipants` functions must be called before the `Distribution` contract pre-initialization.

2. Deploy the `Distribution` contract. Pass the addresses of all participants (including the `Private Offering` and `Advisors Reward` contract addresses) to its constructor.

3. For both `Private Offering` and `Advisors Reward` contracts call the `MultipleDistribution.setDistributionAddress` to set the address of the `Distribution` contract inside those contracts.

4. Deploy the `ERC677MultiBridgeToken` contract (and pass `Distribution`, `Private Offering`, and `Advisors Reward` contract addresses to the constructor).

5. Call `preInitialize` function of the `Distribution` contract passing it the `ERC677MultiBridgeToken` address and `Initial Stake Amount` as parameters. The `Initial Stake Amount` must be equal to the amount of STAKE tokens initially minted in xDai chain before transitioning to POSDAO. \
\
The `preInitialize` function releases 100% of `Public Offering`, 100% of `Liquidity Fund`, and 25% of `Private Offering` tokens.

6. Call `initialize` function of the `Distribution` contract. The countdown for cliff periods and installments starts from this moment.

### Test deployment and initialization (in Kovan chain)
Run your local node.
Uncomment the lines with `preInitialize` and `initialize` calls in `2_deploy_contracts.js` and run:
```
 ECOSYSTEM_FUND_ADDRESS=0xb28a3211ca4f9bf8058a4199acd95c999c4cdf3b PUBLIC_OFFERING_ADDRESS=0x975fe74ec9cc82afdcd8393ce96abe039c6dba84 FOUNDATION_REWARD_ADDRESS=0xb68d0a5c0566c39e8c2f8e15d8494032fd420da1 LIQUIDITY_FUND_ADDRESS=0x7f29ce8e46d01118888b1692f626d990318018ea INITIAL_STAKE_AMOUNT=220000000000000000000000 PRIVATE_OFFERING_DATA=./example.csv ADVISORS_REWARD_DATA=./example.csv ./node_modules/.bin/truffle migrate --reset --network kovan
```
Note: don't forget to change the input data.

## Contracts

- `Token/ERC677MultiBridgeToken.sol` is a contract representing STAKE token on Ethereum Mainnet. Used by the `Distribution` and `MultipleDistribution` contracts.
- `Distribution.sol` is the main distribution contract containing the distribution amounts, terms, and logic. Distributes initially minted tokens from its balance to `Ecosystem Fund`, `Public Offering`, `Private Offering`, `Advisors Reward`, `Foundation Reward`, and `Liquidity Fund` pools.
- `MultipleDistribution.sol` is a separate distribution contract for `Private Offering` and `Advisors Reward` pools. This contract contains all the corresponding private/advisors participants and allows the participants to withdraw their share of tokens after they are transferred to the contract from the `Distribution` contract.

## User roles

### Owner

The owner is supposed to be a MultiSig Wallet contract. The owner can only call the following functions:

- `ERC677MultiBridgeToken.transferOwnership` to transfer ownership of the `ERC677MultiBridgeToken` contract to another address;
- `ERC677MultiBridgeToken.addBridge` to add the address of a bridge contract;
- `ERC677MultiBridgeToken.removeBridge` to remove the address of a bridge contract;
- `ERC677MultiBridgeToken.claimTokens` to transfer coins or specified tokens to the specified address if someone sent coins/tokens to the contract mistakenly;
- `Distribution.transferOwnership` to transfer ownership of the `Distribution` contract to another address;
- `Distribution.preInitialize` to pre-initialize the `Distribution` contract (unlock tokens for `Public Offering`, `Liquidity Fund`, and 25% of `Private Offering`) and to initialize the `Private Offering` and `Advisors Reward` contracts. `Distribution.preInitialize` can only be called after `Private Offering` and `Advisors Reward` participants are finalized with `MultipleDistribution.finalizeParticipants` function;
- `Distribution.initialize` to initialize the `Distribution` contract;
- `MultipleDistribution.transferOwnership` to transfer ownership of the `MultipleDistribution` contract to another address;
- `MultipleDistribution.addParticipants` to add MultipleDistribution participants before initializing;
- `MultipleDistribution.editParticipant` to change participant's stake before initializing;
- `MultipleDistribution.removeParticipant` to remove a participant before initializing;
- `MultipleDistribution.finalizeParticipants` to finalize the list of MultipleDistribution participants before initializing;
- `MultipleDistribution.setDistributionAddress` to set the `Distribution` contract address;
- `MultipleDistribution.burn` to burn unallocated (excess) tokens (send them to `address(0)` without total supply changing).

### Any address

The following methods can be called by anyone:

- `ERC677MultiBridgeToken` public methods (`transferAndCall`, `transfer`, `transferFrom`, `push`, `pull`, `move`, `approve`, `increaseAllowance`, `decreaseAllowance`, `permit`);
- `Distribution.makeInstallment` to transfer daily installment to specified pool;
- `Distribution.initialize` (if 90 days after pre-initialization are expired) to initialize the `Distribution` contract.

### Ecosystem Fund or Foundation Reward address

- `Distribution.changePoolAddress` to change own pool's address if needed.

### Private Offering or Advisors Reward participant

- `MultipleDistribution.withdraw` to withdraw participant share.

### Bridge

- A bridge contract(s) defined by `ERC677MultiBridgeToken.addBridge` function can mint arbitrary tokens for any account (except zero address) using `ERC677MultiBridgeToken.mint` function.
