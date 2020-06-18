pragma solidity 0.5.12;

import "../Token/ERC677MultiBridgeToken.sol";

contract BridgeTokenMock is ERC677MultiBridgeToken {
    constructor (
        string memory _name,
        string memory _symbol,
        address _distributionAddress,
        address _privateOfferingDistributionAddress,
        address _advisorsRewardDistributionAddress
    ) ERC677MultiBridgeToken(
        _name,
        _symbol,
        _distributionAddress,
        _privateOfferingDistributionAddress,
        _advisorsRewardDistributionAddress
    ) public {} // solium-disable-line no-empty-blocks

    function () external payable {}
}
