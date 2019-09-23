pragma solidity 0.5.10;

import "../../contracts/Token/ERC677BridgeToken.sol";

contract BridgeTokenMock is ERC677BridgeToken {
    constructor (
        string memory _name,
        string memory _symbol,
        address _distributionAddress,
        address _privateOfferingDistributionAddress_1,
        address _privateOfferingDistributionAddress_2
    ) ERC677BridgeToken(
        _name,
        _symbol,
        _distributionAddress,
        _privateOfferingDistributionAddress_1,
        _privateOfferingDistributionAddress_2
    ) public {} // solium-disable-line no-empty-blocks

    function () external payable {}
}
