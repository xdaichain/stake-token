pragma solidity 0.5.12;

import "../Distribution.sol";

contract DistributionMock is Distribution {
    uint256 timestamp;

    constructor(
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _privateOfferingAddress,
        address _advisorsRewardAddress,
        address _foundationAddress,
        address _liquidityFundAddress
    ) Distribution(
        _ecosystemFundAddress,
        _publicOfferingAddress,
        _privateOfferingAddress,
        _advisorsRewardAddress,
        _foundationAddress,
        _liquidityFundAddress
    ) public {} // solium-disable-line

    function setToken(address _tokenAddress) external {
        token = IERC677MultiBridgeToken(_tokenAddress);
    }

    function transferTokens(address _to, uint256 _value) external {
        token.transfer(_to, _value);
    }

    function initializePrivateOfferingDistribution() external {
        IMultipleDistribution(poolAddress[PRIVATE_OFFERING]).initialize(address(token));
    }

    function initializeAdvisorsRewardDistribution() external {
        IMultipleDistribution(poolAddress[ADVISORS_REWARD]).initialize(address(token));
    }

    function _now() internal view returns (uint256) {
        return timestamp > 0 ? timestamp : now; // solium-disable-line security/no-block-members
    }

    function setTimestamp(uint256 _timestamp) external {
        timestamp = _timestamp;
    }
}
