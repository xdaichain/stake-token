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

    /// @dev Emits when preInitialize method has been called
    /// @param token The address of ERC677BridgeToken
    /// @param caller The address of the caller
    event PreInitialized(address token, address caller);

    /// @dev Emits when initialize method has been called
    /// @param caller The address of the caller
    event Initialized(address caller);

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

    /// @dev The instance of ERC677BridgeToken
    IERC677BridgeToken public token;

    uint8 constant ECOSYSTEM_FUND = 1;
    uint8 constant PUBLIC_OFFERING = 2;
    uint8 constant PRIVATE_OFFERING_1 = 3;
    uint8 constant PRIVATE_OFFERING_2 = 4;
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
    uint256 constant public supply = 27000000 ether;

    /// @dev The timestamp of the distribution start
    uint256 public distributionStartTimestamp;

    /// @dev The timestamp of pre-initialization
    uint256 public preInitializationTimestamp;
    /// @dev Boolean variable that indicates whether the contract was pre-initialized
    bool public isPreInitialized = false;
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
            _now() >= distributionStartTimestamp.add(cliff[_pool]) && !installmentsEnded[_pool],
            "installments are not active for this pool"
        );
        _;
    }

    /// @dev Sets up constants and pools addresses that are used in distribution
    /// @param _ecosystemFundAddress The address of the Ecosystem Fund
    /// @param _publicOfferingAddress The address of the Public Offering
    /// @param _privateOfferingAddress_1 The address of the first PrivateOfferingDistribution contract
    /// @param _privateOfferingAddress_2 The address of the second PrivateOfferingDistribution contract
    /// @param _foundationAddress The address of the Foundation
    /// @param _exchangeRelatedActivitiesAddress The address of the Exchange Related Activities
    constructor(
        address _ecosystemFundAddress,
        address _publicOfferingAddress,
        address _privateOfferingAddress_1,
        address _privateOfferingAddress_2,
        address _foundationAddress,
        address _exchangeRelatedActivitiesAddress
    ) public {
        // validate provided addresses
        require(
            _privateOfferingAddress_1.isContract() &&
            _privateOfferingAddress_2.isContract(),
            "not a contract address"
        );
        _validateAddress(_ecosystemFundAddress);
        _validateAddress(_publicOfferingAddress);
        _validateAddress(_foundationAddress);
        _validateAddress(_exchangeRelatedActivitiesAddress);
        poolAddress[ECOSYSTEM_FUND] = _ecosystemFundAddress;
        poolAddress[PUBLIC_OFFERING] = _publicOfferingAddress;
        poolAddress[PRIVATE_OFFERING_1] = _privateOfferingAddress_1;
        poolAddress[PRIVATE_OFFERING_2] = _privateOfferingAddress_2;
        poolAddress[FOUNDATION_REWARD] = _foundationAddress;
        poolAddress[EXCHANGE_RELATED_ACTIVITIES] = _exchangeRelatedActivitiesAddress;

        // initialize token amounts
        stake[ECOSYSTEM_FUND] = 10881023 ether;
        stake[PUBLIC_OFFERING] = 1000000 ether;
        stake[PRIVATE_OFFERING_1] = IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING_1]).poolStake();
        stake[PRIVATE_OFFERING_2] = IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING_2]).poolStake();
        stake[FOUNDATION_REWARD] = 4000000 ether;
        stake[EXCHANGE_RELATED_ACTIVITIES] = 3000000 ether;

        require(
            stake[ECOSYSTEM_FUND] // solium-disable-line operator-whitespace
                .add(stake[PUBLIC_OFFERING])
                .add(stake[PRIVATE_OFFERING_1])
                .add(stake[PRIVATE_OFFERING_2])
                .add(stake[FOUNDATION_REWARD])
                .add(stake[EXCHANGE_RELATED_ACTIVITIES])
            == supply,
            "wrong sum of pools stakes"
        );

        tokensLeft[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND];
        tokensLeft[PUBLIC_OFFERING] = stake[PUBLIC_OFFERING];
        tokensLeft[PRIVATE_OFFERING_1] = stake[PRIVATE_OFFERING_1];
        tokensLeft[PRIVATE_OFFERING_2] = stake[PRIVATE_OFFERING_2];
        tokensLeft[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD];
        tokensLeft[EXCHANGE_RELATED_ACTIVITIES] = stake[EXCHANGE_RELATED_ACTIVITIES];

        valueAtCliff[ECOSYSTEM_FUND] = stake[ECOSYSTEM_FUND].mul(10).div(100);       // 10%
        valueAtCliff[PRIVATE_OFFERING_1] = stake[PRIVATE_OFFERING_1].mul(10).div(100);   // 10%
        valueAtCliff[PRIVATE_OFFERING_2] = stake[PRIVATE_OFFERING_2].mul(5).div(100);   // 5%
        valueAtCliff[FOUNDATION_REWARD] = stake[FOUNDATION_REWARD].mul(20).div(100); // 20%

        cliff[ECOSYSTEM_FUND] = 48 weeks;
        cliff[FOUNDATION_REWARD] = 12 weeks;
        cliff[PRIVATE_OFFERING_1] = 4 weeks;
        cliff[PRIVATE_OFFERING_2] = 4 weeks;

        numberOfInstallments[ECOSYSTEM_FUND] = 672;
        numberOfInstallments[PRIVATE_OFFERING_1] = 224;
        numberOfInstallments[PRIVATE_OFFERING_2] = 224;
        numberOfInstallments[FOUNDATION_REWARD] = 252;

        installmentValue[ECOSYSTEM_FUND] = _calculateInstallmentValue(ECOSYSTEM_FUND);
        installmentValue[PRIVATE_OFFERING_1] = _calculateInstallmentValue(
            PRIVATE_OFFERING_1,
            stake[PRIVATE_OFFERING_1].mul(35).div(100) // 25% will be distributed at initializing and 10% at cliff
        );
        installmentValue[PRIVATE_OFFERING_2] = _calculateInstallmentValue(
            PRIVATE_OFFERING_2,
            stake[PRIVATE_OFFERING_2].mul(20).div(100) // 15% will be distributed at initializing and 5% at cliff
        );
        installmentValue[FOUNDATION_REWARD] = _calculateInstallmentValue(FOUNDATION_REWARD);
    }

    /// @dev Pre-initializes the contract after the token is created.
    /// Distributes tokens for Public Offering and Exchange Related Activities
    /// @param _tokenAddress The address of the DPOS token
    function preInitialize(address _tokenAddress) external onlyOwner {
        require(!isPreInitialized, "already pre-initialized");

        token = IERC677BridgeToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance == supply, "wrong contract balance");

        preInitializationTimestamp = _now(); // solium-disable-line security/no-block-members
        isPreInitialized = true;

        token.transferDistribution(poolAddress[PUBLIC_OFFERING], stake[PUBLIC_OFFERING]);                           // 100%
        token.transferDistribution(poolAddress[EXCHANGE_RELATED_ACTIVITIES], stake[EXCHANGE_RELATED_ACTIVITIES]);   // 100%

        tokensLeft[PUBLIC_OFFERING] = tokensLeft[PUBLIC_OFFERING].sub(stake[PUBLIC_OFFERING]);
        tokensLeft[EXCHANGE_RELATED_ACTIVITIES] = tokensLeft[EXCHANGE_RELATED_ACTIVITIES].sub(stake[EXCHANGE_RELATED_ACTIVITIES]);

        emit PreInitialized(_tokenAddress, msg.sender);
        emit InstallmentMade(PUBLIC_OFFERING, stake[PUBLIC_OFFERING], msg.sender);
        emit InstallmentMade(EXCHANGE_RELATED_ACTIVITIES, stake[EXCHANGE_RELATED_ACTIVITIES], msg.sender);
    }

    /// @dev Initializes token distribution
    function initialize() external {
        require(isPreInitialized, "not pre-initialized");
        require(!isInitialized, "already initialized");

        if (_now().sub(preInitializationTimestamp) < 90 days) { // solium-disable-line security/no-block-members
            require(isOwner(), "for now only owner can call this method");
        }

        IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING_1]).initialize(address(token));
        IPrivateOfferingDistribution(poolAddress[PRIVATE_OFFERING_2]).initialize(address(token));

        distributionStartTimestamp = _now(); // solium-disable-line security/no-block-members
        isInitialized = true;

        uint256 privateOfferingPrerelease_1 = stake[PRIVATE_OFFERING_1].mul(25).div(100);             // 25%
        token.transfer(poolAddress[PRIVATE_OFFERING_1], privateOfferingPrerelease_1);
        tokensLeft[PRIVATE_OFFERING_1] = tokensLeft[PRIVATE_OFFERING_1].sub(privateOfferingPrerelease_1);

        uint256 privateOfferingPrerelease_2 = stake[PRIVATE_OFFERING_2].mul(15).div(100);   // 15%
        token.transfer(poolAddress[PRIVATE_OFFERING_2], privateOfferingPrerelease_2);
        tokensLeft[PRIVATE_OFFERING_2] = tokensLeft[PRIVATE_OFFERING_2].sub(privateOfferingPrerelease_2);

        emit Initialized(msg.sender);
        emit InstallmentMade(PRIVATE_OFFERING_1, privateOfferingPrerelease_1, msg.sender);
        emit InstallmentMade(PRIVATE_OFFERING_2, privateOfferingPrerelease_2, msg.sender);
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
            _pool == PRIVATE_OFFERING_1 ||
            _pool == PRIVATE_OFFERING_2 ||
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

        if (_pool == PRIVATE_OFFERING_1 || _pool == PRIVATE_OFFERING_2) {
            token.transfer(poolAddress[_pool], value);
        } else {
            token.transferDistribution(poolAddress[_pool], value);
        }

        emit InstallmentMade(_pool, value, msg.sender);
    }

    /// @dev This method is called after the DPOS tokens are transferred to this contract
    function onTokenTransfer(address, uint256, bytes memory) public pure returns (bool) {
        revert("sending tokens to this contract is not allowed");
    }

    /// @dev The removed implementation of the ownership renouncing
    function renounceOwnership() public onlyOwner {
        revert("not implemented");
    }

    function _now() internal view returns (uint256) {
        return now; // solium-disable-line security/no-block-members
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

    /// @dev Calculates the value of the installment for 1 day for the given pool
    /// @param _pool The index of the pool
    /// @param _valueAtCliff Custom value to distribute at cliff
    function _calculateInstallmentValue(
        uint8 _pool,
        uint256 _valueAtCliff
    ) internal view returns (uint256) {
        return stake[_pool].sub(_valueAtCliff).div(numberOfInstallments[_pool]);
    }

    /// @dev Calculates the value of the installment for 1 day for the given pool
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
        uint256 paidDays = numberOfInstallmentsMade[_pool].mul(1 days);
        uint256 lastTimestamp = distributionStartTimestamp.add(cliff[_pool]).add(paidDays);
        // solium-disable-next-line security/no-block-members
        availableNumberOfInstallments = _now().sub(lastTimestamp).div(1 days);
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
