pragma solidity 0.5.10;

import "../../contracts/Token/ERC677BridgeToken.sol";

contract BridgeTokenMock is ERC677BridgeToken {
    constructor (
        string memory _name,
        string memory _symbol,
        address _distributionAddress,
        address _privateOfferingDistributionAddress,
        address _advisorsRewardDistributionAddress
    ) ERC677BridgeToken(
        _name,
        _symbol,
        _distributionAddress,
        _privateOfferingDistributionAddress,
        _advisorsRewardDistributionAddress
    ) public {} // solium-disable-line no-empty-blocks

    function () external payable {}
}
