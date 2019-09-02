pragma solidity 0.5.10;

import "../../contracts/PrivateOfferingDistribution.sol";

contract PrivateOfferingDistributionMock is PrivateOfferingDistribution {
    function setDistributionAddress(address _distributionAddress) external {
        distributionAddress = _distributionAddress;
    }

    function setToken(address _tokenAddress) external {
        token = IERC677BridgeToken(_tokenAddress);
    }
}
