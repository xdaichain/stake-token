pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Token/ERC677BridgeToken.sol";

/// @dev Distributes DPOS tokens
contract Distribution is Ownable {
    using SafeMath for uint256;

    ERC677BridgeToken token;

    uint8 constant REWARD_FOR_STAKING = 1;
    uint8 constant ECOSYSTEM_FUND = 2;
    uint8 constant PUBLIC_OFFERING = 3;
    uint8 constant PRIVATE_OFFERING = 4;
    uint8 constant FOUNDATION_REWARD = 5;

    mapping (uint8 => address) poolAddress;
    mapping (uint8 => uint256) stake;
    mapping (uint8 => uint256) tokensLeft;
    mapping (uint8 => uint256) cliff;
    mapping (uint8 => uint256) numberOfInstallments;
    mapping (uint8 => uint256) numberOfInstallmentsDone;
    mapping (uint8 => uint256) installmentValue;
    mapping (uint8 => uint256) valueAtCliff;
    mapping (uint8 => bool) installmentEnded;

    address[] privateOfferingParticipants;
    uint256[] privateOfferingParticipantsStakes;

    uint256 constant supply = 100000000 ether;

    uint256 public distributionStartBlock;
    uint256 stakingEpochDuration;

    bool isInitialized = false;

    /// @dev Checks that the contract is initialized
    modifier initialized() {
        require(isInitialized, "not initialized");
        _;
    }

    /// @dev Checks that the sender is authorized for the given pool
    /// @param _pool The index of the pool
    modifier authorized(uint8 _pool) {
        address _authorizedAddress = poolAddress[_pool] == address(0) ? owner() : poolAddress[_pool];
        require(msg.sender == _authorizedAddress, "not authorized");
        _;
    }

    /// @dev Checks that the installments for the given pool are started and are not ended already
    /// @param _pool The index of the pool
    modifier active(uint8 _pool) {
        require(
            currentBlock() > distributionStartBlock.add(cliff[_pool]) && !installmentEnded[_pool],
            "installments are not active for this pool"
        );
        _;
    }

    /// @dev Sets up constants that are used in distribution
    /// @param _blockTime The time of block creation in seconds
    constructor(uint256 _blockTime) public {
        stakingEpochDuration = uint256(1 weeks).div(_blockTime); // 1 week in blocks

        stake[REWARD_FOR_STAKING] = 73000000 ether;
        stake[ECOSYSTEM_FUND] = 15000000 ether;
        stake[PUBLIC_OFFERING] = 4000000 ether;
        stake[PRIVATE_OFFERING] = 4000000 ether;
        stake[FOUNDATION_REWARD] = 4000000 ether;

        tokensLeft[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND];
        tokensLeft[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING];
        tokensLeft[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD];

        valueAtCliff[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND].mul(10).div(100);       // 10%
        valueAtCliff[PRIVATE_OFFERING] = stake[PRIVATE_OFFERING].mul(35).div(100);   // 35%
        valueAtCliff[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD].mul(20).div(100); // 20%

        cliff[REWARD_FOR_STAKING] = stakingEpochDuration.mul(12);
        cliff[ECOSYSTEM_FUND] = stakingEpochDuration.mul(48);
        cliff[FOUNDATION_REWARD] = stakingEpochDuration.mul(12);

        numberOfInstallments[ECOSYSTEM_FUND] = 96;
        numberOfInstallments[PRIVATE_OFFERING] = 36;
        numberOfInstallments[FOUNDATION_REWARD] = 48;

        installmentValue[ECOSYSTEM_FUND] = _calculateInstallmentValue(ECOSYSTEM_FUND);
        installmentValue[PRIVATE_OFFERING] = _calculateInstallmentValue(PRIVATE_OFFERING);
        installmentValue[FOUNDATION_REWARD] = _calculateInstallmentValue(FOUNDATION_REWARD);

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
        address[] calldata _privateOfferingParticipants,
        uint256[] calldata _privateOfferingParticipantsStakes
    ) external onlyOwner {
        require(!isInitialized, "already initialized");

        token = ERC677BridgeToken(_tokenAddress);
        uint256 _balance = token.balanceOf(address(this));
        require(_balance == supply, "wrong contract balance");

        distributionStartBlock = token.created();

        _validateAddress(_ecosystemFundAddress);
        _validateAddress(_publicOfferingAddress);
        _validateAddress(_foundationAddress);
        poolAddress[ECOSYSTEM_FUND] = _ecosystemFundAddress;
        poolAddress[FOUNDATION_REWARD] = _foundationAddress;

        _validatePrivateOfferingData(_privateOfferingParticipants, _privateOfferingParticipantsStakes);
        privateOfferingParticipants = _privateOfferingParticipants;
        privateOfferingParticipantsStakes = _privateOfferingParticipantsStakes;

        isInitialized = true;

        token.transfer(_publicOfferingAddress, stake[PUBLIC_OFFERING]);         // 100%
        makeInstallment(PRIVATE_OFFERING);                                     // 35%
    }

    /// @dev Transfers tokens to the bridge contract
    /// @param _bridgeAddress The address of the bridge contract
    function unlockRewardForStaking(
        address _bridgeAddress
    ) external onlyOwner initialized active(REWARD_FOR_STAKING) {
        _validateAddress(_bridgeAddress);
        token.transfer(_bridgeAddress, stake[REWARD_FOR_STAKING]);
        _endInstallment(REWARD_FOR_STAKING);
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
        uint256 _value;
        if (stake[_pool] == tokensLeft[_pool]) {
            _value = valueAtCliff[_pool];
        }
        uint256 _availableNumberOfInstallments = _calculateNumberOfAvailableInstallments(_pool);
        _value = _value.add(installmentValue[_pool].mul(_availableNumberOfInstallments));

        require(_value > 0, "no installments available");

        if (_pool == PRIVATE_OFFERING) {
            _distributeTokensForPrivateOffering(_value);
        } else {
            token.transfer(poolAddress[_pool], _value);
        }

        _updatePoolData(_pool, _value, _availableNumberOfInstallments);
    }

    /// @dev Checks for an empty address
    function _validateAddress(address _address) internal pure {
        if (_address == address(0)) {
            revert("invalid address");
        }
    }

    /// @dev Checks an array for empty addresses
    function _validateAddresses(address[] memory _addresses) internal pure {
        for (uint256 _i; _i < _addresses.length; _i++) {
            _validateAddress(_addresses[_i]);
        }
    }

    /// @dev Calculates the value of the installment for 1 epoch for the given pool
    /// @param _pool The index of the pool
    function _calculateInstallmentValue(uint8 _pool) internal view returns (uint256) {
        return stake[_pool].sub(valueAtCliff[_pool]).div(numberOfInstallments[_pool]);
    }

    /// @dev Distributes tokens between Private Offering participants
    /// @param _value Amount of tokens to distribute
    function _distributeTokensForPrivateOffering(uint256 _value) internal {
        for (uint256 _i = 0; _i < privateOfferingParticipants.length; _i++) {
            uint256 _participantValue = _value.mul(privateOfferingParticipantsStakes[_i]).div(stake[PRIVATE_OFFERING]);
            token.transfer(privateOfferingParticipants[_i], _participantValue);
        }
    }

    /// @dev Compares the sum of the array values to the expected sum
    /// and reverts if the sums are different
    /// @param _values Array of values to calculate the sum
    /// @param _expectedSum Expected sum of values
    function _checkSum(uint256[] memory _values, uint256 _expectedSum) internal pure {
        uint256 _sum = 0;
        for (uint256 _i = 0; _i < _values.length; _i++) {
            _sum = _sum.add(_values[_i]);
        }
        require(_sum == _expectedSum, "wrong sum of values");
    }

    /// @dev Compares arrays sizes,
    /// checks the array of the participants for epmty addresses
    /// and checks the sum of the array values
    /// @param _participants The addresses of the participants
    /// @param _stakes The amounts of the tokens that belong to each participant
    function _validatePrivateOfferingData(
        address[] memory _participants,
        uint256[] memory _stakes
    ) internal view {
        require(_participants.length == _stakes.length, "different arrays sizes");
        _validateAddresses(_participants);
        _checkSum(_stakes, stake[PRIVATE_OFFERING]);
    }

    /// @dev Marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    function _endInstallment(uint8 _pool) internal {
        installmentEnded[_pool] = true;
    }

    /// @dev Updates the given pool data after each installment:
    /// the remaining number of tokens,
    /// the number of made installments.
    /// If the last installment are done and the tokens remained
    /// then transfers them to the pool and marks that all installments for the given pool are made
    /// @param _pool The index of the pool
    /// @param _value Current installment value
    /// @param _currentNumberOfInstallments Number of installment that are made
    function _updatePoolData(uint8 _pool, uint256 _value, uint256 _currentNumberOfInstallments) internal {
        tokensLeft[_pool] = tokensLeft[_pool].sub(_value);
        numberOfInstallmentsDone[_pool] = numberOfInstallmentsDone[_pool].add(_currentNumberOfInstallments);
        if (numberOfInstallmentsDone[_pool] >= numberOfInstallments[_pool]) {
            if (tokensLeft[_pool] > 0) {
                address _recipient = poolAddress[_pool] == address(0) ? owner() : poolAddress[_pool];
                token.transfer(_recipient, tokensLeft[_pool]);
            }
            _endInstallment(_pool);
        }
    }

    /// @dev Calculates the number of available installments for the given pool
    /// @param _pool The index of the pool
    /// @return The number of available installments
    function _calculateNumberOfAvailableInstallments(
        uint8 _pool
    ) internal view returns (
        uint256 availableNumberOfInstallments
    ) {
        uint256 _paidStackingEpochs = numberOfInstallmentsDone[_pool].mul(stakingEpochDuration);
        uint256 _lastBlockNumber = distributionStartBlock.add(cliff[_pool]).add(_paidStackingEpochs);
        availableNumberOfInstallments = currentBlock().sub(_lastBlockNumber).div(stakingEpochDuration);
        if (numberOfInstallmentsDone[_pool].add(availableNumberOfInstallments) > numberOfInstallments[_pool]) {
            availableNumberOfInstallments = numberOfInstallments[_pool].sub(numberOfInstallmentsDone[_pool]);
        }
    }

    /// @dev Returns the current block number (added for the tests)
    function currentBlock() public view returns (uint256) {
        return block.number;
    }
}
