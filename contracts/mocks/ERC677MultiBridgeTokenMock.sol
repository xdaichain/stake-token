pragma solidity 0.5.12;

import "../Token/ERC677MultiBridgeToken.sol";


contract ERC677MultiBridgeTokenMock is ERC677MultiBridgeToken {
    uint256 private _blockTimestamp;

    constructor(
        string memory _name,
        string memory _symbol,
        address _distributionAddress,
        address _privateOfferingDistributionAddress,
        address _advisorsRewardDistributionAddress
    ) public ERC677MultiBridgeToken(
        _name,
        _symbol,
        _distributionAddress,
        _privateOfferingDistributionAddress,
        _advisorsRewardDistributionAddress
    ) {}

    function setNow(uint256 _timestamp) public {
    	_blockTimestamp = _timestamp;
    }

    function _now() internal view returns(uint256) {
        return _blockTimestamp != 0 ? _blockTimestamp : now;
    }
}
