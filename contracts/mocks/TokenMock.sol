pragma solidity 0.5.12;

import "../Token/ERC20.sol";

contract TokenMock is ERC20 {
    function mint(address _account, uint256 _amount) external returns(bool) {
        _mint(_account, _amount);
        return true;
    }
}
