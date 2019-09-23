pragma solidity 0.5.10;

import "../../contracts/PrivateOfferingDistribution.sol";

contract PrivateOfferingDistributionMock is PrivateOfferingDistribution {
    constructor (uint8 _pool) PrivateOfferingDistribution(_pool) public {} // solium-disable-line

    function setDistributionAddress(address _distributionAddress) external {
        distributionAddress = _distributionAddress;
    }

    function setToken(address _tokenAddress) external {
        token = IERC677BridgeToken(_tokenAddress);
    }
}
