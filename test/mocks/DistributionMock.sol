pragma solidity 0.5.10;

import "../../contracts/Distribution.sol";

contract DistributionMock is Distribution {
    uint256 blockNumber;

    constructor(uint256 _blockTime) Distribution(_blockTime) public {} // solium-disable-line

    function setBlock(uint256 _blockNumber) external {
        blockNumber = _blockNumber;
    }

    function currentBlock() public view returns (uint256) {
        return blockNumber == 0 ? block.number : blockNumber;
    }

    function setToken(address _tokenAddress) external {
        token = ERC677BridgeToken(_tokenAddress);
    }

    function transferTokens(address _to, uint256 _value) external {
        token.transfer(_to, _value);
    }
}
