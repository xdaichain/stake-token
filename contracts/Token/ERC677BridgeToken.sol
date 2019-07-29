pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./ERC677.sol";
import "./Sacrifice.sol";
import "../Distribution.sol";

contract ERC677BridgeToken is Ownable, ERC677, ERC20Detailed {
    using SafeERC20 for IERC20;

    address public bridgeContract;

    event ContractFallbackCallFailed(address from, address to, uint value);

    /// @param _distributionAddress The address of the deployed distribution contract
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _distributionAddress
    ) ERC20Detailed(_name, _symbol, _decimals) public {
        require(_isContract(_distributionAddress), "not a contract address");
        uint256 supply = Distribution(_distributionAddress).supply();
        require(supply > 0, "the supply must be more than 0");
        _mint(_distributionAddress, supply);
    }

    /// @dev Checks that the recipient address is valid
    /// @param _recipient Recipient address
    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this), "not a valid recipient");
        _;
    }

    /// @dev Extends transfer method with callback
    /// @param _to The address of the recipient
    /// @param _value The value to transfer
    /// @param _data Custom data
    /// @return Success status
    function transferAndCall(
        address _to,
        uint _value,
        bytes calldata _data
    ) external validRecipient(_to) returns (bool) {
        _superTransfer(_to, _value);
        emit Transfer(msg.sender, _to, _value, _data);

        if (_isContract(_to)) {
            require(_contractFallback(msg.sender, _to, _value, _data), "contract call failed");
        }
        return true;
    }

    /// @dev Sets the bridge contract address
    /// @param _bridgeContract The address of the bridge contract
    function setBridgeContract(address _bridgeContract) public onlyOwner {
        require(_bridgeContract != address(0) && _isContract(_bridgeContract), "wrong address");
        bridgeContract = _bridgeContract;
    }

    /// @dev Extends transfer method with event when the callback failed
    /// @param _to The address of the recipient
    /// @param _value The value to transfer
    /// @return Success status
    function transfer(address _to, uint256 _value) public returns (bool) {
        _superTransfer(_to, _value);
        _callAfterTransfer(msg.sender, _to, _value);
        return true;
    }

    /// @dev Extends transferFrom method with event when the callback failed
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The value to transfer
    /// @return Success status
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        _superTransferFrom(_from, _to, _value);
        _callAfterTransfer(_from, _to, _value);
        return true;
    }

    /// @dev Transfers specified tokens to the specified address
    /// @param _token The token address to transfer
    /// @param _to The address of the recipient
    function claimTokens(address _token, address payable _to) public onlyOwner validRecipient(_to) {
        if (_token == address(0)) {
            uint256 value = address(this).balance;
            if (!_to.send(value)) { // solium-disable-line security/no-send
                (new Sacrifice).value(value)(_to);
            }
        } else {
            IERC20 token = IERC20(_token);
            uint256 balance = token.balanceOf(address(this));
            token.safeTransfer(_to, balance);
        }
    }

    /// @dev The removed implementation of the ownership renouncing
    function renounceOwnership() public onlyOwner {
        revert("not implemented");
    }

    /// @dev Calls transfer method and reverts if it fails
    /// @param _to The address of the recipient
    /// @param _value The value to transfer
    function _superTransfer(address _to, uint256 _value) internal {
        bool success = super.transfer(_to, _value);
        require(success, "transfer failed");
    }

    /// @dev Calls transferFrom method and reverts if it fails
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The value to transfer
    function _superTransferFrom(address _from, address _to, uint256 _value) internal {
        bool success = super.transferFrom(_from, _to, _value);
        require(success, "transfer failed");
    }

    /// @dev Emits an event when the callback failed
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The transferred value
    function _callAfterTransfer(address _from, address _to, uint256 _value) internal {
        if (_isContract(_to) && !_contractFallback(_from, _to, _value, new bytes(0))) {
            require(_to != bridgeContract, "you can't transfer to bridge contract");
            emit ContractFallbackCallFailed(_from, _to, _value);
        }
    }

    /// @dev Checks if the given address is a contract
    /// @param _addr The address to check
    /// @return Check result
    function _isContract(address _addr) internal view returns (bool) {
        uint length;
        // solium-disable-next-line security/no-inline-assembly
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    /// @dev Makes a callback after the transfer of tokens
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The transferred value
    /// @param _data Custom data
    /// @return Success status
    function _contractFallback(
        address _from,
        address _to,
        uint _value,
        bytes memory _data
    ) private returns (bool success) {
        string memory signature = "onTokenTransfer(address,uint256,bytes)";
        // solium-disable-next-line security/no-low-level-calls
        (success, ) = _to.call(abi.encodeWithSignature(signature, _from, _value, _data));
    }
}
