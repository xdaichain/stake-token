pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "./Token/IERC677BridgeToken.sol";
import "./IPrivateOfferingDistribution.sol";

/// @dev Distributes DPOS tokens for Private Offering
contract PrivateOfferingDistribution is Ownable, IPrivateOfferingDistribution {
    using SafeMath for uint256;
    using Address for address;

    /// @dev Emits when initialize method has been called
    /// @param token The address of ERC677BridgeToken
    /// @param caller The address of the caller
    event Initialized(address token, address caller);

    /// @dev Emits when the distribution address has beed set
    /// @param distribution Distribution address
    /// @param caller The address of the caller
    event DistributionAddressSet(address distribution, address caller);

    uint256 constant TOTAL_STAKE = 8500000 ether;

    /// @dev The instance of ERC677BridgeToken
    IERC677BridgeToken public token;
    /// @dev Distribution contract address
    address public distributionAddress;

    /// @dev Private Offering participants addresses
    address[] public participants;

    /// @dev Participant stake
    mapping (address => uint256) public participantStake;
    /// @dev Amount of tokens that have already been paid
    mapping (address => uint256) public paidAmount;

    /// @dev Contains max balance (sum of all installents) for current epoch
    uint256 public maxBalanceForCurrentEpoch = 0;
    /// @dev Boolean variable that contains whether the contract was initialized
    bool public isInitialized = false;

    /// @dev Checks that the contract is initialized
    modifier initialized() {
        require(isInitialized, "not initialized");
        _;
    }

    /// @dev Sets up Private Offering data
    /// @param _participants The addresses of the Private Offering participants
    /// @param _stakes The amounts of the tokens that belong to each participant
    constructor(
        address[] memory _participants,
        uint256[] memory _stakes
    ) public {
        require(_participants.length == _stakes.length, "different arrays sizes");
        uint256 sumOfStakes = 0;
        for (uint256 i = 0; i < _participants.length; i++) {
            require(_participants[i] != address(0) && _participants[i] != owner(), "invalid address");
            require(_stakes[i] > 0, "the participant stake must be more than 0");
            sumOfStakes = sumOfStakes.add(_stakes[i]);
        }

        uint256 unusedStake = TOTAL_STAKE.sub(sumOfStakes);
        if (unusedStake > 0) {
            uint256 length = _participants.length;
            _participants[length] = address(0);
            _stakes[length] = unusedStake;
        }
        participants = _participants;

        for (uint256 i = 0; i < participants.length; i++) {
            participantStake[participants[i]] = _stakes[i];
        }
    }

    /// @dev Initializes the contract after the token is created
    /// @param _tokenAddress The address of the DPOS token
    function initialize(
        address _tokenAddress
    ) external {
        require(msg.sender == distributionAddress, "wrong sender");
        require(!isInitialized, "already initialized");
        token = IERC677BridgeToken(_tokenAddress);
        isInitialized = true;
        emit Initialized(_tokenAddress, msg.sender);
    }

    /// @dev Sets distribution contract address
    /// @param _distributionAddress Main distribution address
    function setDistributionAddress(address _distributionAddress) external onlyOwner {
        require(_distributionAddress.isContract(), "not a contract address");
        distributionAddress = _distributionAddress;
        emit DistributionAddressSet(distributionAddress, msg.sender);
    }

    function withdraw() external {
        _withdraw(msg.sender);
    }

    function burn() external onlyOwner {
        _withdraw(address(0));
    }

    /// @dev Transfers a share to participant
    function _withdraw(address _sender) internal {
        uint256 stake = participantStake[_sender];
        require(stake > 0, "you are not a participant");

        uint256 maxShareForCurrentEpoch = maxBalanceForCurrentEpoch.mul(stake).div(TOTAL_STAKE);
        uint256 currentShare = maxShareForCurrentEpoch.sub(paidAmount[_sender]);
        require(currentShare > 0, "no tokens available to withdraw");

        token.transferDistribution(_sender, currentShare);
        paidAmount[_sender] = paidAmount[_sender].add(currentShare);
    }

    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes calldata
    ) external returns (bool) {
        if (_from == distributionAddress) {
            maxBalanceForCurrentEpoch = maxBalanceForCurrentEpoch.add(_value);
        }
        return true;
    }
}
