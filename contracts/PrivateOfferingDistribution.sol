pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "./Token/IERC677BridgeToken.sol";
import "./IPrivateOfferingDistribution.sol";
import "./IDistribution.sol";

/// @dev Distributes STAKE tokens for Private Offering
contract PrivateOfferingDistribution is Ownable, IPrivateOfferingDistribution {
    using SafeMath for uint256;
    using Address for address;

    /// @dev Emits when `initialize` method has been called
    /// @param token The address of ERC677BridgeToken
    /// @param caller The address of the caller
    event Initialized(address token, address caller);

    /// @dev Emits when the Distribution address has been set
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

    /// @dev Emits when `editParticipant` method has been called
    /// @param participant Participant address
    /// @param oldStake Old participant stake
    /// @param newStake New participant stake
    /// @param caller The address of the caller
    event ParticipantEdited(address participant, uint256 oldStake, uint256 newStake, address caller);

    /// @dev Emits when `removeParticipant` method has been called
    /// @param participant Participant address
    /// @param stake Participant stake
    /// @param caller The address of the caller
    event ParticipantRemoved(address participant, uint256 stake, address caller);

    /// @dev Emits when `finalizeParticipants` method has been called
    /// @param numberOfParticipants Number of participants
    /// @param caller The address of the caller
    event ParticipantsFinalized(uint256 numberOfParticipants, address caller);

    uint256 public TOTAL_STAKE;
    uint8 public POOL_NUMBER;

    /// @dev The instance of ERC677BridgeToken
    IERC677BridgeToken public token;

    /// @dev Distribution contract address
    address public distributionAddress;

    /// @dev Private Offering participants addresses
    address[] public participants;

    /// @dev Stake for a specified Private Offering participant
    mapping (address => uint256) public participantStake;

    /// @dev Amount of tokens that have already been paid for a specified Private Offering participant
    mapping (address => uint256) public paidAmount;

    /// @dev Contains max balance (sum of all installments)
    uint256 public maxBalance = 0;

    /// @dev Boolean variable that indicates whether the contract was initialized
    bool public isInitialized = false;

    /// @dev Boolean variable that indicates whether the participant set was finalized
    bool public isFinalized = false;

    /// @dev Contains current sum of stakes
    uint256 public sumOfStakes = 0;

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

    constructor (uint8 _pool) public {
        require(_pool == 3 || _pool == 4, "wrong pool number");
        POOL_NUMBER = _pool;

        if (POOL_NUMBER == 3) {
            TOTAL_STAKE = 3908451 ether;
        } else {
            TOTAL_STAKE = 4210526 ether;
        }
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
    }

    /// @dev Edits participant stake
    /// @param _participant Participant address
    /// @param _newStake New stake of the participant
    function editParticipant(
        address _participant,
        uint256 _newStake
    ) external onlyOwner notFinalized {
        require(_participant != address(0), "invalid address");

        uint256 oldStake = participantStake[_participant];
        require(oldStake > 0, "the participant doesn't exist");
        require(_newStake > 0, "the participant stake must be more than 0");

        sumOfStakes = sumOfStakes.sub(oldStake).add(_newStake);
        require(sumOfStakes <= TOTAL_STAKE, "wrong sum of values");
        participantStake[_participant] = _newStake;

        emit ParticipantEdited(_participant, oldStake, _newStake, msg.sender);
    }

    /// @dev Removes participant
    /// @param _participant Participant address
    function removeParticipant(
        address _participant
    ) external onlyOwner notFinalized {
        require(_participant != address(0), "invalid address");

        uint256 stake = participantStake[_participant];
        require(stake > 0, "the participant doesn't exist");

        uint256 index = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == _participant) {
                index = i;
                break;
            }
        }
        require(participants[index] == _participant, "the participant not found");
        sumOfStakes = sumOfStakes.sub(stake);
        participantStake[_participant] = 0;

        address lastParticipant = participants[participants.length.sub(1)];
        participants[index] = lastParticipant;
        participants.length = participants.length.sub(1);

        emit ParticipantRemoved(_participant, stake, msg.sender);
    }

    /// @dev Calculates unused stake and disables the following additions
    function finalizeParticipants() external onlyOwner notFinalized {
        uint256 unusedStake = TOTAL_STAKE.sub(sumOfStakes);
        if (unusedStake > 0) {
            participants.push(address(0));
            participantStake[address(0)] = unusedStake;
        }
        isFinalized = true;
        emit ParticipantsFinalized(participants.length, msg.sender);
    }

    /// @dev Initializes the contract after the token is created
    /// @param _tokenAddress The address of the STAKE token
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

    /// @dev The removed implementation of the ownership renouncing
    function renounceOwnership() public onlyOwner {
        revert("not implemented");
    }

    /// @dev Sets the `Distribution` contract address
    /// @param _distributionAddress The `Distribution` contract address
    function setDistributionAddress(address _distributionAddress) external onlyOwner {
        require(distributionAddress == address(0), "already set");
        require(
            address(this) == IDistribution(_distributionAddress).poolAddress(POOL_NUMBER),
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

    /// @dev Updates an internal value of the balance to use it for correct
    /// share calculation (see the `_withdraw` function) and prevents transferring
    /// tokens to this contract not from the `Distribution` contract.
    /// @param _from The address from which the tokens are transferred
    /// @param _value The amount of transferred tokens
    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes calldata
    ) external returns (bool) {
        require(msg.sender == address(token), "the caller can only be the token contract");
        require(_from == distributionAddress, "the _from value can only be the distribution contract");
        maxBalance = maxBalance.add(_value);
        return true;
    }

    /// @dev Returns a total amount of Private Offering tokens
    function poolStake() external view returns (uint256) {
        return TOTAL_STAKE;
    }

    /// @dev Returns an array of Private Offering participants
    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function _withdraw(address _recipient) internal initialized returns(uint256) {
        uint256 stake = participantStake[_recipient];
        require(stake > 0, "you are not a participant");

        uint256 maxShare = maxBalance.mul(stake).div(TOTAL_STAKE);
        uint256 currentShare = maxShare.sub(paidAmount[_recipient]);
        require(currentShare > 0, "no tokens available to withdraw");

        paidAmount[_recipient] = paidAmount[_recipient].add(currentShare);
        token.transferDistribution(_recipient, currentShare);

        return currentShare;
    }
}
