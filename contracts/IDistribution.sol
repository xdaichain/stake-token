pragma solidity 0.5.12;

interface IDistribution {
    function supply() external view returns(uint256);
    function poolAddress(uint8) external view returns(address);
}
