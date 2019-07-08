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
}
