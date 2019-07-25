pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Token/ERC677BridgeToken.sol";

/// @dev Distributes DPOS tokens
contract Distribution is Ownable {
    using SafeMath for uint256;

    ERC677BridgeToken public token;

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

    /// @dev Checks that the sender is authorized for the given pool
    /// @param _pool The index of the pool
    modifier authorized(uint8 _pool) {
        address authorizedAddress = poolAddress[_pool] == address(0) ? owner() : poolAddress[_pool];
        require(msg.sender == authorizedAddress, "not authorized");
        _;
    }

    /// @dev Checks that the installments for the given pool are started and are not ended already
    /// @param _pool The index of the pool
    modifier active(uint8 _pool) {
        require(
            currentBlock() > distributionStartBlock.add(cliff[_pool]) && !installmentsEnded[_pool],
            "installments are not active for this pool"
        );
        _;
    }

    /// @dev Sets up constants that are used in distribution
    /// @param _stakingEpochDuration stacking epoch duration in blocks
    constructor(uint256 _stakingEpochDuration) public {
        stakingEpochDuration = _stakingEpochDuration;

        stake[REWARD_FOR_STAKING] = 73000000 ether;
        stake[ECOSYSTEM_FUND] = 12500000 ether;
        stake[PUBLIC_OFFERING] = 1000000 ether;
        stake[PRIVATE_OFFERING] = 8500000 ether;
        stake[FOUNDATION_REWARD] = 4000000 ether;
        stake[EXCHANGE_RELATED_ACTIVITIES] = 1000000 ether;

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

        installmentValue[ECOSYSTEM_FUND] = calculateInstallmentValue(ECOSYSTEM_FUND);
        installmentValue[PRIVATE_OFFERING] = calculateInstallmentValue(PRIVATE_OFFERING);
        installmentValue[FOUNDATION_REWARD] = calculateInstallmentValue(FOUNDATION_REWARD);

    }

    /// @dev Initializes the contract with pools addresses after the token is created
    /// @param _tokenAddress The address of the DPOS token
    /// @param _ecosystemFundAddress The address of the Ecosystem Fund
    /// @param _publicOfferingAddress The address of the Public Offering
    /// @param _foundationAddress The address of the Foundation
    /// @param _privateOfferingParticipants The addresses of the Private Offering participants
    /// @param _privateOfferingParticipantsStakes The amounts of the tokens that belong to each participant
    function initialize(
        address _tokenAddress,
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _foundationAddress,
        address _exchangeRelatedActivitiesAddress,
        address[] calldata _privateOfferingParticipants,
        uint256[] calldata _privateOfferingParticipantsStakes
    ) external onlyOwner {
        require(!isInitialized, "already initialized");

        token = ERC677BridgeToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance == supply, "wrong contract balance");

        distributionStartBlock = token.created();

        validateAddress(_ecosystemFundAddress);
        validateAddress(_publicOfferingAddress);
        validateAddress(_foundationAddress);
        validateAddress(_exchangeRelatedActivitiesAddress);
        poolAddress[ECOSYSTEM_FUND] = _ecosystemFundAddress;
        poolAddress[PUBLIC_OFFERING] = _publicOfferingAddress;
        poolAddress[FOUNDATION_REWARD] = _foundationAddress;
        poolAddress[EXCHANGE_RELATED_ACTIVITIES] = _exchangeRelatedActivitiesAddress;

        validatePrivateOfferingData(_privateOfferingParticipants, _privateOfferingParticipantsStakes);
        privateOfferingParticipants = _privateOfferingParticipants;
        privateOfferingParticipantsStakes = _privateOfferingParticipantsStakes;

        isInitialized = true;

        token.transfer(_publicOfferingAddress, stake[PUBLIC_OFFERING]);                         // 100%
        token.transfer(_exchangeRelatedActivitiesAddress, stake[EXCHANGE_RELATED_ACTIVITIES]);  // 100%
        makeInstallment(PRIVATE_OFFERING);                                                      // 25%
    }

    /// @dev Transfers tokens to the bridge contract
    /// @param _bridgeAddress The address of the bridge contract
    function unlockRewardForStaking(
        address _bridgeAddress
    ) external onlyOwner initialized active(REWARD_FOR_STAKING) {
        validateAddress(_bridgeAddress);
        token.transfer(_bridgeAddress, stake[REWARD_FOR_STAKING]);
        endInstallment(REWARD_FOR_STAKING);
    }

    /// @dev Returns addresses and stakes of Private Offering participants
    function getPrivateOfferingParticipantsData() external view returns (address[] memory, uint256[] memory) {
        return (privateOfferingParticipants, privateOfferingParticipantsStakes);
    }

    /// @dev Makes an installment for one of the following pools: Private Offering, Ecosystem Fund, Foundation
    /// @param _pool The index of the pool
    function makeInstallment(uint8 _pool) public initialized authorized(_pool) active(_pool) {
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
        uint256 availableNumberOfInstallments = calculateNumberOfAvailableInstallments(_pool);
        value = value.add(installmentValue[_pool].mul(availableNumberOfInstallments));

        require(value > 0, "no installments available");

        if (_pool == PRIVATE_OFFERING) {
            distributeTokensForPrivateOffering(value);
        } else {
            token.transfer(poolAddress[_pool], value);
        }

        updatePoolData(_pool, value, availableNumberOfInstallments);
    }

    /// @dev Returns the current block number (added for the tests)
    function currentBlock() public view returns (uint256) {
        return block.number;
    }

    /// @dev Distributes tokens between Private Offering participants
    /// @param _value Amount of tokens to distribute
    function distributeTokensForPrivateOffering(uint256 _value) internal {
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
    function updatePoolData(uint8 _pool, uint256 _value, uint256 _currentNumberOfInstallments) internal {
        tokensLeft[_pool] = tokensLeft[_pool].sub(_value);
        numberOfInstallmentsMade[_pool] = numberOfInstallmentsMade[_pool].add(_currentNumberOfInstallments);
        if (numberOfInstallmentsMade[_pool] >= numberOfInstallments[_pool]) {
            if (tokensLeft[_pool] > 0) {
                address recipient = poolAddress[_pool] == address(0) ? owner() : poolAddress[_pool];
                token.transfer(recipient, tokensLeft[_pool]);
            }
            endInstallment(_pool);
        }
    }

    /// @dev Marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    function endInstallment(uint8 _pool) internal {
        installmentsEnded[_pool] = true;
    }

    /// @dev Calculates the value of the installment for 1 epoch for the given pool
    /// @param _pool The index of the pool
    function calculateInstallmentValue(uint8 _pool) internal view returns (uint256) {
        return stake[_pool].sub(valueAtCliff[_pool]).div(numberOfInstallments[_pool]);
    }

    /// @dev Calculates the number of available installments for the given pool
    /// @param _pool The index of the pool
    /// @return The number of available installments
    function calculateNumberOfAvailableInstallments(
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
    function validatePrivateOfferingData(
        address[] memory _participants,
        uint256[] memory _stakes
    ) internal view {
        require(_participants.length == _stakes.length, "different arrays sizes");
        validateAddresses(_participants);
        checkSum(_stakes, stake[PRIVATE_OFFERING]);
    }

    /// @dev Checks for an empty address
    function validateAddress(address _address) internal pure {
        if (_address == address(0)) {
            revert("invalid address");
        }
    }

    /// @dev Checks an array for empty addresses
    function validateAddresses(address[] memory _addresses) internal pure {
        for (uint256 i = 0; i < _addresses.length; i++) {
            validateAddress(_addresses[i]);
        }
    }

    /// @dev Compares the sum of the array values to the expected sum
    /// and reverts if the sums are different
    /// @param _values Array of values to calculate the sum
    /// @param _expectedSum Expected sum of values
    function checkSum(uint256[] memory _values, uint256 _expectedSum) internal pure {
        uint256 sum = 0;
        for (uint256 i = 0; i < _values.length; i++) {
            sum = sum.add(_values[i]);
        }
        require(sum == _expectedSum, "wrong sum of values");
    }
}
