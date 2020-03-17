pragma solidity 0.5.10;

interface IMultipleDistribution {
    function initialize(address _tokenAddress) external;
    function poolStake() external view returns (uint256);
}
