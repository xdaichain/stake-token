pragma solidity 0.5.10;

interface IPrivateOfferingDistribution {
    function initialize(address _tokenAddress) external;
    function poolStake() external pure returns (uint256);
}
