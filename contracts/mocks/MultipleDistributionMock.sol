pragma solidity 0.5.12;

import "../MultipleDistribution.sol";

contract MultipleDistributionMock is MultipleDistribution {
    constructor (uint8 _pool) MultipleDistribution(_pool) public {} // solium-disable-line

    function setDistributionAddress(address _distributionAddress) external {
        distributionAddress = _distributionAddress;
    }

    function setToken(address _tokenAddress) external {
        token = IERC677MultiBridgeToken(_tokenAddress);
    }
}
