pragma solidity 0.5.9;

import '../../contracts/Token/ERC677Receiver.sol';

contract RecipientMock is ERC677Receiver {
    address public from;
    uint256 public value;
    string public customString;

    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool) {
        from = _from;
        value = _value;
        customString = abi.decode(_data, (string));
    }
}
