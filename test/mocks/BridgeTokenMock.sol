pragma solidity 0.5.9;

import "../../contracts/Token/ERC677BridgeToken.sol";

contract BridgeTokenMock is ERC677BridgeToken {
    // solium-disable-next-line no-empty-blocks
    constructor (address _distributionAddress) ERC677BridgeToken(_distributionAddress) public {}
    function () external payable {}
}
