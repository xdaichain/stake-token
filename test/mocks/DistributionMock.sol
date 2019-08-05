pragma solidity 0.5.10;

import "../../contracts/Distribution.sol";

contract DistributionMock is Distribution {
    uint256 blockNumber;

    constructor(
        uint256 _stakingEpochDuration,
        address _rewardForStakingAddress,
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _foundationAddress,
        address _exchangeRelatedActivitiesAddress,
        address[] memory _privateOfferingParticipants,
        uint256[] memory _privateOfferingParticipantsStakes
    ) Distribution(
        _stakingEpochDuration,
        _rewardForStakingAddress,
        _ecosystemFundAddress,
        _publicOfferingAddress,
        _foundationAddress,
        _exchangeRelatedActivitiesAddress,
        _privateOfferingParticipants,
        _privateOfferingParticipantsStakes
    ) public {} // solium-disable-line

    function setBlock(uint256 _blockNumber) external {
        blockNumber = _blockNumber;
    }

    function currentBlock() public view returns (uint256) {
        return blockNumber == 0 ? block.number : blockNumber;
    }

    function setToken(address _tokenAddress) external {
        token = IERC677BridgeToken(_tokenAddress);
    }

    function transferTokens(address _to, uint256 _value) external {
        token.transfer(_to, _value);
    }
}
