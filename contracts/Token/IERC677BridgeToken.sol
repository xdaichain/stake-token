pragma solidity 0.5.10;

interface IERC677BridgeToken {
    function transfer(address _to, uint256 _value) external returns (bool);
    function transferDistribution(address _to, uint256 _value) external returns (bool);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
    function balanceOf(address _account) external view returns (uint256);
}
