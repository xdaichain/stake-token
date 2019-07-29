pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Token/ERC677BridgeToken.sol";

/// @dev Distributes DPOS tokens
contract Distribution is Ownable {
    using SafeMath for uint256;

    event Initialized(address token, address caller);
    event RewardForStakingUnlocked(address bridge, address poolAddress, address caller);
    event InstallmentMade(uint8 indexed pool, uint256 value, address caller);
    event PoolAddressChanged(uint8 indexed pool, address oldAddress, address newAddress);

    ERC677BridgeToken public token;
    address public bridgeAddress;

    uint8 constant REWARD_FOR_STAKING = 1;
    uint8 constant ECOSYSTEM_FUND = 2;
    uint8 constant PUBLIC_OFFERING = 3;
    uint8 constant PRIVATE_OFFERING = 4;
    uint8 constant FOUNDATION_REWARD = 5;
    uint8 constant EXCHANGE_RELATED_ACTIVITIES = 6;

    mapping (uint8 => address) public poolAddress;
    mapping (uint8 => uint256) public stake;
    mapping (uint8 => uint256) public tokensLeft;
    mapping (uint8 => uint256) public cliff;
    mapping (uint8 => uint256) public numberOfInstallments;
    mapping (uint8 => uint256) public numberOfInstallmentsMade;
    mapping (uint8 => uint256) public installmentValue;
    mapping (uint8 => uint256) public valueAtCliff;
    mapping (uint8 => bool) public installmentsEnded;

    address[] privateOfferingParticipants;
    uint256[] privateOfferingParticipantsStakes;

    uint256 constant public supply = 100000000 ether;

    uint256 public distributionStartBlock;
    uint256 public stakingEpochDuration;

    bool public isInitialized = false;

    /// @dev Checks that the contract is initialized
    modifier initialized() {
        require(isInitialized, "not initialized");
        _;
    }

    /// @dev Checks that the installments for the given pool are started and are not ended already
    /// @param _pool The index of the pool
    modifier active(uint8 _pool) {
        require(
            currentBlock() >= distributionStartBlock.add(cliff[_pool]) && !installmentsEnded[_pool],
            "installments are not active for this pool"
        );
        _;
    }

    /// @dev Sets up constants and pools addresses that are used in distribution
    /// @param _stakingEpochDuration stacking epoch duration in blocks
    /// @param _ecosystemFundAddress The address of the Ecosystem Fund
    /// @param _publicOfferingAddress The address of the Public Offering
    /// @param _foundationAddress The address of the Foundation
    /// @param _privateOfferingParticipants The addresses of the Private Offering participants
    /// @param _privateOfferingParticipantsStakes The amounts of the tokens that belong to each participant
    constructor(
        uint256 _stakingEpochDuration,
        address _bridgeAddress,
        address _rewardForStakingAddress,
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _foundationAddress,
        address _exchangeRelatedActivitiesAddress,
        address[] memory _privateOfferingParticipants,
        uint256[] memory _privateOfferingParticipantsStakes
    ) public {
        require(_stakingEpochDuration > 0, "staking epoch duration must be more than 0");
        stakingEpochDuration = _stakingEpochDuration;

        // initialize stakes
        stake[REWARD_FOR_STAKING] = 73000000 ether;
        stake[ECOSYSTEM_FUND] = 12500000 ether;
        stake[PUBLIC_OFFERING] = 1000000 ether;
        stake[PRIVATE_OFFERING] = 8500000 ether;
        stake[FOUNDATION_REWARD] = 4000000 ether;
        stake[EXCHANGE_RELATED_ACTIVITIES] = 1000000 ether;

        // validate provided addresses
        _validateAddress(_rewardForStakingAddress);
        _validateAddress(_ecosystemFundAddress);
        _validateAddress(_publicOfferingAddress);
        _validateAddress(_foundationAddress);
        _validateAddress(_exchangeRelatedActivitiesAddress);
        _validateAddress(_bridgeAddress);
        poolAddress[REWARD_FOR_STAKING] = _rewardForStakingAddress;
        poolAddress[ECOSYSTEM_FUND] = _ecosystemFundAddress;
        poolAddress[PUBLIC_OFFERING] = _publicOfferingAddress;
        poolAddress[FOUNDATION_REWARD] = _foundationAddress;
        poolAddress[EXCHANGE_RELATED_ACTIVITIES] = _exchangeRelatedActivitiesAddress;
        bridgeAddress = _bridgeAddress;

        // validate Private Offering participants
        uint256 realPrivateOfferingStake = _validatePrivateOfferingData(
            _privateOfferingParticipants,
            _privateOfferingParticipantsStakes
        );
        privateOfferingParticipants = _privateOfferingParticipants;
        privateOfferingParticipantsStakes = _privateOfferingParticipantsStakes;

        if (realPrivateOfferingStake < stake[PRIVATE_OFFERING]) {
            stake[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND].add(stake[PRIVATE_OFFERING]).sub(realPrivateOfferingStake);
            stake[PRIVATE_OFFERING] = realPrivateOfferingStake;
        }

        require(
            stake[REWARD_FOR_STAKING]
                .add(stake[ECOSYSTEM_FUND])
                .add(stake[PUBLIC_OFFERING])
                .add(stake[PRIVATE_OFFERING])
                .add(stake[FOUNDATION_REWARD])
                .add(stake[EXCHANGE_RELATED_ACTIVITIES])
            == supply,
            "wrong sum of pools stakes"
        );

        tokensLeft[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND];
        tokensLeft[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING];
        tokensLeft[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD];

        valueAtCliff[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND].mul(10).div(100);       // 10%
        valueAtCliff[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING].mul(25).div(100);   // 25%
        valueAtCliff[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD].mul(20).div(100); // 20%

        cliff[REWARD_FOR_STAKING] = stakingEpochDuration.mul(12);
        cliff[ECOSYSTEM_FUND] = stakingEpochDuration.mul(48);
        cliff[FOUNDATION_REWARD] = stakingEpochDuration.mul(12);

        numberOfInstallments[ECOSYSTEM_FUND] = 96;
        numberOfInstallments[PRIVATE_OFFERING] = 32;
        numberOfInstallments[FOUNDATION_REWARD] = 36;

        installmentValue[ECOSYSTEM_FUND] = _calculateInstallmentValue(ECOSYSTEM_FUND);
        installmentValue[PRIVATE_OFFERING] = _calculateInstallmentValue(PRIVATE_OFFERING);
        installmentValue[FOUNDATION_REWARD] = _calculateInstallmentValue(FOUNDATION_REWARD);

    }

    /// @dev Initializes the contract after the token is created
    /// @param _tokenAddress The address of the DPOS token
    function initialize(
        address _tokenAddress
    ) external onlyOwner {
        require(!isInitialized, "already initialized");

        token = ERC677BridgeToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance == supply, "wrong contract balance");

        distributionStartBlock = block.number;
        isInitialized = true;

        token.transfer(poolAddress[PUBLIC_OFFERING], stake[PUBLIC_OFFERING]);                           // 100%
        token.transfer(poolAddress[EXCHANGE_RELATED_ACTIVITIES], stake[EXCHANGE_RELATED_ACTIVITIES]);   // 100%
        makeInstallment(PRIVATE_OFFERING);                                                              // 25%

        emit Initialized(_tokenAddress, msg.sender);
    }

    /// @dev Transfers tokens to the bridge contract
    function unlockRewardForStaking() external initialized active(REWARD_FOR_STAKING) {
        token.transfer(poolAddress[REWARD_FOR_STAKING], stake[REWARD_FOR_STAKING]);
        token.transferFrom(poolAddress[REWARD_FOR_STAKING], bridgeAddress, stake[REWARD_FOR_STAKING]);
        _endInstallment(REWARD_FOR_STAKING);
        emit RewardForStakingUnlocked(bridgeAddress, poolAddress[REWARD_FOR_STAKING], msg.sender);
    }

    function changePoolAddress(uint8 _pool, address _newAddress) external initialized {
        require(_pool == ECOSYSTEM_FUND || _pool == FOUNDATION_REWARD, "wrong pool");
        require(msg.sender == poolAddress[_pool], "not authorized");
        _validateAddress(_newAddress);
        emit PoolAddressChanged(_pool, poolAddress[_pool], _newAddress);
        poolAddress[_pool] = _newAddress;
    }

    /// @dev Returns addresses and stakes of Private Offering participants
    function getPrivateOfferingParticipantsData() external view returns (address[] memory, uint256[] memory) {
        return (privateOfferingParticipants, privateOfferingParticipantsStakes);
    }

    /// @dev Makes an installment for one of the following pools: Private Offering, Ecosystem Fund, Foundation
    /// @param _pool The index of the pool
    function makeInstallment(uint8 _pool) public initialized active(_pool) {
        require(
            _pool == PRIVATE_OFFERING ||
            _pool == ECOSYSTEM_FUND ||
            _pool == FOUNDATION_REWARD,
            "wrong pool"
        );
        uint256 value = 0;
        if (stake[_pool] == tokensLeft[_pool]) {
            value = valueAtCliff[_pool];
        }
        uint256 availableNumberOfInstallments = _calculateNumberOfAvailableInstallments(_pool);
        value = value.add(installmentValue[_pool].mul(availableNumberOfInstallments));

        require(value > 0, "no installments available");

        uint256 remainder = _updatePoolData(_pool, value, availableNumberOfInstallments);

        if (_pool == PRIVATE_OFFERING) {
            _distributeTokensForPrivateOffering(value);
            token.transfer(owner(), remainder);
        } else {
            value = value.add(remainder);
            token.transfer(poolAddress[_pool], value);
        }
        
        emit InstallmentMade(_pool, value, msg.sender);
    }

    /// @dev Returns the current block number (added for the tests)
    function currentBlock() public view returns (uint256) {
        return block.number;
    }

    /// @dev Distributes tokens between Private Offering participants
    /// @param _value Amount of tokens to distribute
    function _distributeTokensForPrivateOffering(uint256 _value) internal {
        for (uint256 i = 0; i < privateOfferingParticipants.length; i++) {
            uint256 participantValue = _value.mul(privateOfferingParticipantsStakes[i]).div(stake[PRIVATE_OFFERING]);
            token.transfer(privateOfferingParticipants[i], participantValue);
        }
    }

    /// @dev Updates the given pool data after each installment:
    /// the remaining number of tokens,
    /// the number of made installments.
    /// If the last installment are done and the tokens remained
    /// then transfers them to the pool and marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    /// @param _value Current installment value
    /// @param _currentNumberOfInstallments Number of installment that are made
    function _updatePoolData(
        uint8 _pool,
        uint256 _value,
        uint256 _currentNumberOfInstallments
    ) internal returns (uint256 remainder) {
        tokensLeft[_pool] = tokensLeft[_pool].sub(_value);
        numberOfInstallmentsMade[_pool] = numberOfInstallmentsMade[_pool].add(_currentNumberOfInstallments);
        if (numberOfInstallmentsMade[_pool] >= numberOfInstallments[_pool]) {
            if (tokensLeft[_pool] > 0) {
                remainder = tokensLeft[_pool];
                tokensLeft[_pool] = 0;
            }
            _endInstallment(_pool);
        }
    }

    /// @dev Marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    function _endInstallment(uint8 _pool) internal {
        installmentsEnded[_pool] = true;
    }

    /// @dev Calculates the value of the installment for 1 epoch for the given pool
    /// @param _pool The index of the pool
    function _calculateInstallmentValue(uint8 _pool) internal view returns (uint256) {
        return stake[_pool].sub(valueAtCliff[_pool]).div(numberOfInstallments[_pool]);
    }

    /// @dev Calculates the number of available installments for the given pool
    /// @param _pool The index of the pool
    /// @return The number of available installments
    function _calculateNumberOfAvailableInstallments(
        uint8 _pool
    ) internal view returns (
        uint256 availableNumberOfInstallments
    ) {
        uint256 paidStakingEpochs = numberOfInstallmentsMade[_pool].mul(stakingEpochDuration);
        uint256 lastBlockNumber = distributionStartBlock.add(cliff[_pool]).add(paidStakingEpochs);
        availableNumberOfInstallments = currentBlock().sub(lastBlockNumber).div(stakingEpochDuration);
        if (numberOfInstallmentsMade[_pool].add(availableNumberOfInstallments) > numberOfInstallments[_pool]) {
            availableNumberOfInstallments = numberOfInstallments[_pool].sub(numberOfInstallmentsMade[_pool]);
        }
    }

    /// @dev Compares arrays sizes,
    /// checks the array of the participants for epmty addresses
    /// and checks the sum of the array values
    /// @param _participants The addresses of the participants
    /// @param _stakes The amounts of the tokens that belong to each participant
    /// @return Sum of participants stakes
    function _validatePrivateOfferingData(
        address[] memory _participants,
        uint256[] memory _stakes
    ) internal view returns (uint256 sum) {
        require(_participants.length == _stakes.length, "different arrays sizes");
        _validateAddresses(_participants);
        sum = _calculateSumOfValues(_stakes);
        require(sum <= stake[PRIVATE_OFFERING], "the sum of participants stakes is more than the whole stake");
    }

    /// @dev Checks for an empty address
    function _validateAddress(address _address) internal pure {
        if (_address == address(0)) {
            revert("invalid address");
        }
    }

    /// @dev Checks an array for empty addresses
    function _validateAddresses(address[] memory _addresses) internal pure {
        for (uint256 i = 0; i < _addresses.length; i++) {
            _validateAddress(_addresses[i]);
        }
    }

    /// @dev Calculates the sum of values
    /// @param _values Array of values
    /// @return Sum of values
    function _calculateSumOfValues(uint256[] memory _values) internal pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < _values.length; i++) {
            sum = sum.add(_values[i]);
        }
        return sum;
    }
}
