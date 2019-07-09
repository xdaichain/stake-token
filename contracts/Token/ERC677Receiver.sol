pragma solidity 0.5.10;

/// @dev The functional for the contracts that want to support ERC677
contract ERC677Receiver {
    /// @dev The callback for the "transferAndCall" method
    /// @param _from The address of the sender
    /// @param _value Received value
    /// @param _data Custom data
    /// @return Success status
    function onTokenTransfer(address _from, uint _value, bytes calldata _data) external returns (bool);
}
