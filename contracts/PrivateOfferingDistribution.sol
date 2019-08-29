pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "./Token/IERC677BridgeToken.sol";
import "./IPrivateOfferingDistribution.sol";
import "./IDistribution.sol";

/// @dev Distributes DPOS tokens for Private Offering
contract PrivateOfferingDistribution is Ownable, IPrivateOfferingDistribution {
    using SafeMath for uint256;
    using Address for address;

    /// @dev Emits when initialize method has been called
    /// @param token The address of ERC677BridgeToken
    /// @param caller The address of the caller
    event Initialized(address token, address caller);

    /// @dev Emits when the distribution address has been set
    /// @param distribution Distribution address
    /// @param caller The address of the caller
    event DistributionAddressSet(address distribution, address caller);

    /// @dev Emits when `withdraw` method has been called
    /// @param recipient Recipient address
    /// @param value Transferred value
    event Withdrawn(address recipient, uint256 value);

    /// @dev Emits when `burn` method has been called
    /// @param value Burnt value
    event Burnt(uint256 value);

    uint256 constant TOTAL_STAKE = 8500000 ether;
    uint8 constant PRIVATE_OFFERING = 4;

    /// @dev The instance of ERC677BridgeToken
    IERC677BridgeToken public token;

    /// @dev Distribution contract address
    address public distributionAddress;

    /// @dev Private Offering participants addresses
    address[] public participants;

    /// @dev Stake for a specified Private Offering participant
    mapping (address => uint256) public participantStake;

    /// @dev Amount of tokens that have already been paid
    mapping (address => uint256) public paidAmount;

    /// @dev Contains max balance (sum of all installments) for current epoch
    uint256 public maxBalanceForCurrentEpoch = 0;

    /// @dev Boolean variable that indicates whether the contract was initialized
    bool public isInitialized = false;

    /// @dev Boolean variable that indicates whether the participant set was initialized
    bool public isFinalized = false;

    /// @dev Contains current sum of stakes
    uint256 sumOfStakes = 0;

    /// @dev Checks that the contract is initialized
    modifier initialized() {
        require(isInitialized, "not initialized");
        _;
    }

    /// @dev Checks that the participant set is not finalized
    modifier notFinalized() {
        require(!isFinalized, "already finalized");
        _;
    }

    /// @dev Adds participants
    /// @param _participants The addresses of the Private Offering participants
    /// @param _stakes The amounts of the tokens that belong to each participant
    function addParticipants(
        address[] calldata _participants,
        uint256[] calldata _stakes
    ) external onlyOwner notFinalized {
        require(_participants.length == _stakes.length, "different arrays sizes");

        for (uint256 i = 0; i < _participants.length; i++) {
            require(_participants[i] != address(0), "invalid address");
            require(_stakes[i] > 0, "the participant stake must be more than 0");
            require(participantStake[_participants[i]] == 0, "participant already added");
            participants.push(_participants[i]);
            participantStake[_participants[i]] = _stakes[i];
            sumOfStakes = sumOfStakes.add(_stakes[i]);
        }

        require(sumOfStakes <= TOTAL_STAKE, "wrong sum of values");
    }

    /// @dev Calculates unused stake and disables the following additions
    function finalizeParticipants() external onlyOwner notFinalized {
        uint256 unusedStake = TOTAL_STAKE.sub(sumOfStakes);
        if (unusedStake > 0) {
            participants.push(address(0));
            participantStake[address(0)] = unusedStake;
        }
        isFinalized = true;
    }

    /// @dev Initializes the contract after the token is created
    /// @param _tokenAddress The address of the DPOS token
    function initialize(
        address _tokenAddress
    ) external {
        require(msg.sender == distributionAddress, "wrong sender");
        require(!isInitialized, "already initialized");
        require(isFinalized, "not finalized");
        token = IERC677BridgeToken(_tokenAddress);
        isInitialized = true;
        emit Initialized(_tokenAddress, msg.sender);
    }

    /// @dev Sets the `Distribution` contract address
    /// @param _distributionAddress The `Distribution` contract address
    function setDistributionAddress(address _distributionAddress) external onlyOwner {
        require(distributionAddress == address(0), "already set");
        require(
            address(this) == IDistribution(_distributionAddress).poolAddress(PRIVATE_OFFERING),
            "wrong address"
        );
        distributionAddress = _distributionAddress;
        emit DistributionAddressSet(distributionAddress, msg.sender);
    }

    /// @dev Transfers a share to participant
    function withdraw() external {
        uint256 amount = _withdraw(msg.sender);
        emit Withdrawn(msg.sender, amount);
    }

    /// @dev Transfers unclaimed part to address(0)
    function burn() external onlyOwner {
        uint256 amount = _withdraw(address(0));
        emit Burnt(amount);
    }

    function _withdraw(address _recipient) internal initialized returns(uint256) {
        uint256 stake = participantStake[_recipient];
        require(stake > 0, "you are not a participant");

        uint256 maxShareForCurrentEpoch = maxBalanceForCurrentEpoch.mul(stake).div(TOTAL_STAKE);
        uint256 currentShare = maxShareForCurrentEpoch.sub(paidAmount[_recipient]);
        require(currentShare > 0, "no tokens available to withdraw");

        token.transferDistribution(_recipient, currentShare);
        paidAmount[_recipient] = paidAmount[_recipient].add(currentShare);

        return currentShare;
    }

    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes calldata
    ) external returns (bool) {
        require(_from == distributionAddress, "wrong sender");
        maxBalanceForCurrentEpoch = maxBalanceForCurrentEpoch.add(_value);
        return true;
    }

    function poolStake() external pure returns (uint256) {
        return TOTAL_STAKE;
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }
}
