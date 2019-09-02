pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "./Token/IERC677BridgeToken.sol";
import "./IDistribution.sol";
import "./IPrivateOfferingDistribution.sol";

/// @dev Distributes DPOS tokens
contract Distribution is Ownable, IDistribution {
    using SafeMath for uint256;
    using Address for address;

    /// @dev Emits when initialize method has been called
    /// @param token The address of ERC677BridgeToken
    /// @param caller The address of the caller
    event Initialized(address token, address caller);

    /// @dev Emits when Reward for Staking has been unlocked
    /// @param bridge The address of the bridge contract
    /// @param poolAddress The address of Reward for Staking pool
    /// @param value The unlocked value
    /// @param caller The address of the caller
    event RewardForStakingUnlocked(address bridge, address poolAddress, uint256 value, address caller);

    /// @dev Emits when an installment for the specified pool has been made
    /// @param pool The index of the pool
    /// @param value The installment value
    /// @param caller The address of the caller
    event InstallmentMade(uint8 indexed pool, uint256 value, address caller);

    /// @dev Emits when the pool address was changed
    /// @param pool The index of the pool
    /// @param oldAddress Old address
    /// @param newAddress New address
    event PoolAddressChanged(uint8 indexed pool, address oldAddress, address newAddress);

    /// @dev Emits when the bridge address has been set
    /// @param bridge The bridge address
    /// @param caller The address of the caller
    event BridgeAddressSet(address bridge, address caller);

    /// @dev The instance of ERC677BridgeToken
    IERC677BridgeToken public token;
    /// @dev Bridge contract address
    address public bridgeAddress;

    uint8 constant REWARD_FOR_STAKING = 1;
    uint8 constant ECOSYSTEM_FUND = 2;
    uint8 constant PUBLIC_OFFERING = 3;
    uint8 constant PRIVATE_OFFERING = 4;
    uint8 constant FOUNDATION_REWARD = 5;
    uint8 constant EXCHANGE_RELATED_ACTIVITIES = 6;

    /// @dev Pool address
    mapping (uint8 => address) public poolAddress;
    /// @dev Pool total amount of tokens
    mapping (uint8 => uint256) public stake;
    /// @dev Amount of left tokens to distribute for the pool
    mapping (uint8 => uint256) public tokensLeft;
    /// @dev Pool cliff period (in seconds)
    mapping (uint8 => uint256) public cliff;
    /// @dev Total number of installments for the pool
    mapping (uint8 => uint256) public numberOfInstallments;
    /// @dev Number of installments that were made
    mapping (uint8 => uint256) public numberOfInstallmentsMade;
    /// @dev The value of one-time installment for the pool
    mapping (uint8 => uint256) public installmentValue;
    /// @dev The value to transfer to the pool at cliff
    mapping (uint8 => uint256) public valueAtCliff;
    /// @dev Boolean variable that contains whether the value for the pool at cliff was paid or not
    mapping (uint8 => bool) public wasValueAtCliffPaid;
    /// @dev Boolean variable that contains whether all installments for the pool were made or not
    mapping (uint8 => bool) public installmentsEnded;

    /// @dev The total token supply
    uint256 constant public supply = 100000000 ether;

    /// @dev The timestamp of the distribution start
    uint256 public distributionStartTimestamp;
    /// @dev Duration of staking epoch (in seconds)
    uint256 public stakingEpochDuration;

    /// @dev Boolean variable that indicates whether the contract was initialized
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
            // solium-disable-next-line security/no-block-members
            block.timestamp >= distributionStartTimestamp.add(cliff[_pool]) && !installmentsEnded[_pool],
            "installments are not active for this pool"
        );
        _;
    }

    /// @dev Sets up constants and pools addresses that are used in distribution
    /// @param _stakingEpochDuration stacking epoch duration in seconds
    /// @param _rewardForStakingAddress The address of the Reward for Staking. If this address is a multisig contract,
    /// the contract must be created with `create2` opcode to be able to create the same multisig with the same address
    /// on the opposite side of the bridge
    /// @param _ecosystemFundAddress The address of the Ecosystem Fund
    /// @param _publicOfferingAddress The address of the Public Offering
    /// @param _foundationAddress The address of the Foundation
    /// @param _exchangeRelatedActivitiesAddress The address of the Exchange Related Activities
    constructor(
        uint256 _stakingEpochDuration,
        address _rewardForStakingAddress,
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _privateOfferingAddress,
        address _foundationAddress,
        address _exchangeRelatedActivitiesAddress
    ) public {
        require(_stakingEpochDuration > 0, "staking epoch duration must be more than 0");
        stakingEpochDuration = _stakingEpochDuration;

        // validate provided addresses
        require(_privateOfferingAddress.isContract(), "not a contract address");
        _validateAddress(_rewardForStakingAddress);
        _validateAddress(_ecosystemFundAddress);
        _validateAddress(_publicOfferingAddress);
        _validateAddress(_foundationAddress);
        _validateAddress(_exchangeRelatedActivitiesAddress);
        poolAddress[REWARD_FOR_STAKING] = _rewardForStakingAddress;
        poolAddress[ECOSYSTEM_FUND] = _ecosystemFundAddress;
        poolAddress[PUBLIC_OFFERING] = _publicOfferingAddress;
        poolAddress[PRIVATE_OFFERING] = _privateOfferingAddress;
        poolAddress[FOUNDATION_REWARD] = _foundationAddress;
        poolAddress[EXCHANGE_RELATED_ACTIVITIES] = _exchangeRelatedActivitiesAddress;

        // initialize token amounts
        stake[REWARD_FOR_STAKING] = 73000000 ether;
        stake[ECOSYSTEM_FUND] = 12500000 ether;
        stake[PUBLIC_OFFERING] = 1000000 ether;
        stake[PRIVATE_OFFERING] = IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING]).poolStake();
        stake[FOUNDATION_REWARD] = 4000000 ether;
        stake[EXCHANGE_RELATED_ACTIVITIES] = 1000000 ether;

        require(
            stake[REWARD_FOR_STAKING] // solium-disable-line operator-whitespace
                .add(stake[ECOSYSTEM_FUND])
                .add(stake[PUBLIC_OFFERING])
                .add(stake[PRIVATE_OFFERING])
                .add(stake[FOUNDATION_REWARD])
                .add(stake[EXCHANGE_RELATED_ACTIVITIES])
            == supply,
            "wrong sum of pools stakes"
        );

        tokensLeft[REWARD_FOR_STAKING] = stake[REWARD_FOR_STAKING];
        tokensLeft[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND];
        tokensLeft[PUBLIC_OFFERING] = stake[PUBLIC_OFFERING];
        tokensLeft[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING];
        tokensLeft[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD];
        tokensLeft[EXCHANGE_RELATED_ACTIVITIES] = stake[EXCHANGE_RELATED_ACTIVITIES];

        valueAtCliff[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND].mul(10).div(100);       // 10%
        valueAtCliff[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING].mul(10).div(100);   // 10%
        valueAtCliff[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD].mul(20).div(100); // 20%

        cliff[REWARD_FOR_STAKING] = stakingEpochDuration.mul(12);
        cliff[ECOSYSTEM_FUND] = stakingEpochDuration.mul(48);
        cliff[FOUNDATION_REWARD] = stakingEpochDuration.mul(12);
        cliff[PRIVATE_OFFERING] = stakingEpochDuration.mul(4);

        numberOfInstallments[ECOSYSTEM_FUND] = 96;
        numberOfInstallments[PRIVATE_OFFERING] = 32;
        numberOfInstallments[FOUNDATION_REWARD] = 36;

        installmentValue[ECOSYSTEM_FUND] = _calculateInstallmentValue(ECOSYSTEM_FUND);
        installmentValue[PRIVATE_OFFERING] = _calculateInstallmentValue(
            PRIVATE_OFFERING,
            stake[PRIVATE_OFFERING].mul(35).div(100) // 25% will be distributed at initializing and 10% at cliff
        );
        installmentValue[FOUNDATION_REWARD] = _calculateInstallmentValue(FOUNDATION_REWARD);

    }

    /// @dev Initializes the contract after the token is created
    /// @param _tokenAddress The address of the DPOS token
    function initialize(
        address _tokenAddress
    ) external onlyOwner {
        require(!isInitialized, "already initialized");

        token = IERC677BridgeToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance == supply, "wrong contract balance");

        IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING]).initialize(_tokenAddress);

        distributionStartTimestamp = block.timestamp; // solium-disable-line security/no-block-members
        isInitialized = true;

        token.transferDistribution(poolAddress[PUBLIC_OFFERING], stake[PUBLIC_OFFERING]);                           // 100%
        token.transferDistribution(poolAddress[EXCHANGE_RELATED_ACTIVITIES], stake[EXCHANGE_RELATED_ACTIVITIES]);   // 100%
        uint256 privateOfferingPrerelease = stake[PRIVATE_OFFERING].mul(25).div(100);
        token.transfer(poolAddress[PRIVATE_OFFERING], privateOfferingPrerelease);                                   // 25%

        tokensLeft[PUBLIC_OFFERING] = tokensLeft[PUBLIC_OFFERING].sub(stake[PUBLIC_OFFERING]);
        tokensLeft[EXCHANGE_RELATED_ACTIVITIES] = tokensLeft[EXCHANGE_RELATED_ACTIVITIES].sub(stake[EXCHANGE_RELATED_ACTIVITIES]);
        tokensLeft[PRIVATE_OFFERING] = tokensLeft[PRIVATE_OFFERING].sub(privateOfferingPrerelease);

        emit Initialized(_tokenAddress, msg.sender);
        emit InstallmentMade(PUBLIC_OFFERING, stake[PUBLIC_OFFERING], msg.sender);
        emit InstallmentMade(EXCHANGE_RELATED_ACTIVITIES, stake[EXCHANGE_RELATED_ACTIVITIES], msg.sender);
        emit InstallmentMade(PRIVATE_OFFERING, privateOfferingPrerelease, msg.sender);
    }

    /// @dev Transfers 73000000 tokens to the address of the bridge contract.
    /// Before calling this method, the poolAddress[REWARD_FOR_STAKING] address must call
    /// token.approve(Distribution.address, 73000000 ether),
    /// where `Distribution.address` is an address of this Distribution contract.
    /// We assume that the `unlockRewardForStaking` must emit `Transfer` event for which
    /// the `from` field must be the `Reward for Staking` address. This is necessary for the
    /// bridge because it will mint the tokens on another side of the bridge for the address
    /// which is specified in the `from` field of the `Transfer` event. We need the bridge
    /// to mint the tokens for the same address as `Reward for Staking` address but on another
    /// side of the bridge. For that reason, we need to have the `Reward for Staking` address
    /// in the `from` field of the `Transfer` event.
    /// So, the `Distribution` contract first sends its tokens to `Reward for Staking` address
    /// and then the `Distribution` contract sends these tokens from the `Reward for Staking` address
    /// to the address of bridge contract (thus, the `from` field in the `Transfer` event contains
    /// the `Reward for Staking` address). This requires preliminary calling
    /// `token.approve(Distribution.address, 73000000 ether)` by the `Reward for Staking` address.
    function unlockRewardForStaking() external initialized active(REWARD_FOR_STAKING) {
        _validateAddress(bridgeAddress);

        token.transferDistribution(poolAddress[REWARD_FOR_STAKING], stake[REWARD_FOR_STAKING]);
        token.transferFrom(poolAddress[REWARD_FOR_STAKING], bridgeAddress, stake[REWARD_FOR_STAKING]);

        tokensLeft[REWARD_FOR_STAKING] = tokensLeft[REWARD_FOR_STAKING].sub(stake[REWARD_FOR_STAKING]);

        _endInstallment(REWARD_FOR_STAKING);
        emit RewardForStakingUnlocked(
            bridgeAddress,
            poolAddress[REWARD_FOR_STAKING],
            stake[REWARD_FOR_STAKING],
            msg.sender
        );
    }

    /// @dev Sets bridge contract address
    /// @param _bridgeAddress Bridge address
    function setBridgeAddress(address _bridgeAddress) external onlyOwner {
        require(_bridgeAddress.isContract(), "not a contract address");
        bridgeAddress = _bridgeAddress;
        emit BridgeAddressSet(bridgeAddress, msg.sender);
    }

    /// @dev Changes the address of the specified pool
    /// @param _pool The index of the pool (only ECOSYSTEM_FUND or FOUNDATION_REWARD)
    /// @param _newAddress The new address for the change
    function changePoolAddress(uint8 _pool, address _newAddress) external {
        require(_pool == ECOSYSTEM_FUND || _pool == FOUNDATION_REWARD, "wrong pool");
        require(msg.sender == poolAddress[_pool], "not authorized");
        _validateAddress(_newAddress);
        emit PoolAddressChanged(_pool, poolAddress[_pool], _newAddress);
        poolAddress[_pool] = _newAddress;
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
        if (!wasValueAtCliffPaid[_pool]) {
            value = valueAtCliff[_pool];
            wasValueAtCliffPaid[_pool] = true;
        }
        uint256 availableNumberOfInstallments = _calculateNumberOfAvailableInstallments(_pool);
        value = value.add(installmentValue[_pool].mul(availableNumberOfInstallments));

        require(value > 0, "no installments available");

        uint256 remainder = _updatePoolData(_pool, value, availableNumberOfInstallments);
        value = value.add(remainder);

        if (_pool == PRIVATE_OFFERING) {
            token.transfer(poolAddress[_pool], value);
        } else {
            token.transferDistribution(poolAddress[_pool], value);
        }

        emit InstallmentMade(_pool, value, msg.sender);
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
    ) internal returns (uint256) {
        uint256 remainder = 0;
        tokensLeft[_pool] = tokensLeft[_pool].sub(_value);
        numberOfInstallmentsMade[_pool] = numberOfInstallmentsMade[_pool].add(_currentNumberOfInstallments);
        if (numberOfInstallmentsMade[_pool] >= numberOfInstallments[_pool]) {
            if (tokensLeft[_pool] > 0) {
                remainder = tokensLeft[_pool];
                tokensLeft[_pool] = 0;
            }
            _endInstallment(_pool);
        }
        return remainder;
    }

    /// @dev Marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    function _endInstallment(uint8 _pool) internal {
        installmentsEnded[_pool] = true;
    }

    /// @dev Calculates the value of the installment for 1 epoch (week) for the given pool
    /// @param _pool The index of the pool
    /// @param _valueAtCliff Custom value to distribute at cliff
    function _calculateInstallmentValue(
        uint8 _pool,
        uint256 _valueAtCliff
    ) internal view returns (uint256) {
        return stake[_pool].sub(_valueAtCliff).div(numberOfInstallments[_pool]);
    }

    /// @dev Calculates the value of the installment for 1 epoch (week) for the given pool
    /// @param _pool The index of the pool
    function _calculateInstallmentValue(uint8 _pool) internal view returns (uint256) {
        return _calculateInstallmentValue(_pool, valueAtCliff[_pool]);
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
        uint256 lastTimestamp = distributionStartTimestamp.add(cliff[_pool]).add(paidStakingEpochs);
        // solium-disable-next-line security/no-block-members
        availableNumberOfInstallments = block.timestamp.sub(lastTimestamp).div(stakingEpochDuration);
        if (numberOfInstallmentsMade[_pool].add(availableNumberOfInstallments) > numberOfInstallments[_pool]) {
            availableNumberOfInstallments = numberOfInstallments[_pool].sub(numberOfInstallmentsMade[_pool]);
        }
    }

    /// @dev Checks for an empty address
    function _validateAddress(address _address) internal pure {
        if (_address == address(0)) {
            revert("invalid address");
        }
    }
}
