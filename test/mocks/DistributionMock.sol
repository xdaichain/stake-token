pragma solidity 0.5.10;

import "../../contracts/Distribution.sol";

contract DistributionMock is Distribution {
    uint256 timestamp;

    constructor(
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _privateOfferingAddress_1,
        address _privateOfferingAddress_2,
        address _foundationAddress,
        address _liquidityFundAddress
    ) Distribution(
        _ecosystemFundAddress,
        _publicOfferingAddress,
        _privateOfferingAddress_1,
        _privateOfferingAddress_2,
        _foundationAddress,
        _liquidityFundAddress
    ) public {} // solium-disable-line

    function setToken(address _tokenAddress) external {
        token = IERC677BridgeToken(_tokenAddress);
    }

    function transferTokens(address _to, uint256 _value) external {
        token.transfer(_to, _value);
    }

    function initializePrivateOfferingDistribution() external {
        IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING_1]).initialize(address(token));
    }

    function _now() internal view returns (uint256) {
        return timestamp > 0 ? timestamp : now; // solium-disable-line security/no-block-members
    }

    function setTimestamp(uint256 _timestamp) external {
        timestamp = _timestamp;
    }
}
