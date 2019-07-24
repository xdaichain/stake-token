pragma solidity 0.5.10;

import "../../contracts/Token/ERC677BridgeToken.sol";

contract BridgeTokenMock is ERC677BridgeToken {
    // solium-disable-next-line no-empty-blocks
    constructor (
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _distributionAddress
    ) ERC677BridgeToken(_name, _symbol, _decimals, _distributionAddress) public {}

    function () external payable {}
}
