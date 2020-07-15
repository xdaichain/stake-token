pragma solidity 0.5.12;

import "./ERC677BridgeToken.sol";
import "./IERC677MultiBridgeToken.sol";


/**
 * @title ERC677MultiBridgeToken
 * @dev This contract extends ERC677BridgeToken to support several bridges simultaneously.
 */
contract ERC677MultiBridgeToken is IERC677MultiBridgeToken, ERC677BridgeToken {
    address public constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 internal constant MAX_BRIDGES = 50;
    mapping(address => address) public bridgePointers;
    uint256 public bridgeCount;

    event BridgeAdded(address indexed bridge);
    event BridgeRemoved(address indexed bridge);

    constructor(
        string memory _name,
        string memory _symbol,
        address _distributionAddress,
        address _privateOfferingDistributionAddress,
        address _advisorsRewardDistributionAddress
    ) public ERC677BridgeToken(
        _name,
        _symbol,
        _distributionAddress,
        _privateOfferingDistributionAddress,
        _advisorsRewardDistributionAddress
    ) {
        bridgePointers[F_ADDR] = F_ADDR; // empty bridge contracts list
    }

    /// @dev Adds one more bridge contract into the list.
    /// @param _bridge Bridge contract address.
    function addBridge(address _bridge) external onlyOwner {
        require(bridgeCount < MAX_BRIDGES, "can't add one more bridge due to a limit");
        require(_bridge.isContract(), "not a contract address");
        require(!isBridge(_bridge), "bridge already exists");

        address firstBridge = bridgePointers[F_ADDR];
        require(firstBridge != address(0), "first bridge is zero address");
        bridgePointers[F_ADDR] = _bridge;
        bridgePointers[_bridge] = firstBridge;
        bridgeCount = bridgeCount.add(1);

        emit BridgeAdded(_bridge);
    }

    /// @dev Removes one existing bridge contract from the list.
    /// @param _bridge Bridge contract address.
    function removeBridge(address _bridge) external onlyOwner {
        require(isBridge(_bridge), "bridge isn't existed");

        address nextBridge = bridgePointers[_bridge];
        address index = F_ADDR;
        address next = bridgePointers[index];
        require(next != address(0), "zero address found");

        while (next != _bridge) {
            index = next;
            next = bridgePointers[index];

            require(next != F_ADDR && next != address(0), "invalid address found");
        }

        bridgePointers[index] = nextBridge;
        delete bridgePointers[_bridge];
        bridgeCount = bridgeCount.sub(1);

        emit BridgeRemoved(_bridge);
    }

    /// @dev Returns all recorded bridge contract addresses.
    /// @return address[] Bridge contract addresses.
    function bridgeList() external view returns (address[] memory) {
        address[] memory list = new address[](bridgeCount);
        uint256 counter = 0;
        address nextBridge = bridgePointers[F_ADDR];
        require(nextBridge != address(0), "zero address found");

        while (nextBridge != F_ADDR) {
            list[counter] = nextBridge;
            nextBridge = bridgePointers[nextBridge];
            counter++;

            require(nextBridge != address(0), "zero address found");
        }

        return list;
    }

    /// @dev Checks if given address is included into bridge contracts list.
    /// @param _address Bridge contract address.
    /// @return bool true, if given address is a known bridge contract.
    function isBridge(address _address) public view returns (bool) {
        return _address != F_ADDR && bridgePointers[_address] != address(0);
    }
}
