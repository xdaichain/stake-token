pragma solidity 0.5.10;

import "../../contracts/PrivateOfferingDistribution.sol";

contract PrivateOfferingDistributionMock is PrivateOfferingDistribution {
    constructor(
        address[] memory _participants,
        uint256[] memory _stakes
    ) PrivateOfferingDistribution(_participants, _stakes) public {} // solium-disable-line

    function setDistributionAddress(address _distributionAddress) external {
        distributionAddress = _distributionAddress;
    }
}
