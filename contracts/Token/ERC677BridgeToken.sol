pragma solidity 0.5.9;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./ERC677.sol";

contract ERC677BridgeToken is Ownable, ERC677, ERC20Detailed, ERC20Burnable, ERC20Mintable {

    address public bridgeContract;
    uint256 public created;

    event ContractFallbackCallFailed(address from, address to, uint value);

    constructor(address _distributionAddress) ERC20Detailed("DPOS staking token", "DPOS", 18) public {
        uint256 _supply = 100000000 * 10**18;
        _mint(_distributionAddress, _supply);
        created = now; // solium-disable-line security/no-block-members
    }

    function setBridgeContract(address _bridgeContract) public onlyOwner {
        require(_bridgeContract != address(0) && isContract(_bridgeContract), "wrong address");
        bridgeContract = _bridgeContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this), "not a valid recipient");
        _;
    }

    function transferAndCall(
        address _to,
        uint _value,
        bytes calldata _data
    ) external validRecipient(_to) returns (bool) {
        superTransfer(_to, _value);
        emit Transfer(msg.sender, _to, _value, _data);

        if (isContract(_to)) {
            require(contractFallback(_to, _value, _data), "contract call failed");
        }
        return true;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        superTransfer(_to, _value);
        if (isContract(_to) && !contractFallback(_to, _value, new bytes(0))) {
            require(_to != bridgeContract, "you can't transfer to bridge contract");
            emit ContractFallbackCallFailed(msg.sender, _to, _value);
        }
        return true;
    }

    function claimTokens(address _token, address payable _to) public onlyOwner {
        require(_to != address(0), "empty address");
        if (_token == address(0)) {
            _to.transfer(address(this).balance);
            return;
        }

        ERC20Detailed token = ERC20Detailed(_token);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(_to, balance), "transfer failed");
    }

    function renounceOwnership() public onlyOwner {
        revert("not implemented");
    }

    function getTokenInterfacesVersion() public pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 0, 0);
    }

    function superTransfer(address _to, uint256 _value) internal {
        bool _success = super.transfer(_to, _value);
        require(_success, "transfer failed");
    }

    function isContract(address _addr) internal view returns (bool) {
        uint length;
        // solium-disable-next-line security/no-inline-assembly
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function contractFallback(
        address _to,
        uint _value,
        bytes memory _data
    ) private returns (bool success) {
        string memory _signature = "onTokenTransfer(address,uint256,bytes)";
        // solium-disable-next-line security/no-low-level-calls
        (success, ) = _to.call(abi.encodeWithSignature(_signature, msg.sender, _value, _data));
    }
}
