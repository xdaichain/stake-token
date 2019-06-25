pragma solidity 0.5.9;

import "./ERC677BridgeToken.sol";

contract ERC677BridgeTokenRewardable is ERC677BridgeToken {

    address public blockRewardContract;
    address public stakingContract;

    event Mint(address indexed to, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC677BridgeToken(_name, _symbol, _decimals) public {} // solium-disable-line no-empty-blocks

    modifier onlyBlockRewardContract() {
        require(msg.sender == blockRewardContract, "not a block reward contract");
        _;
    }

    modifier onlyStakingContract() {
        require(msg.sender == stakingContract, "not a staking contract");
        _;
    }

    modifier notStakingContract(address _address) {
        require(_address != stakingContract, "can't be a staking contract");
        _;
    }

    modifier validContractAddress(address _address) {
        require(_address != address(0) && isContract(_address), "invalid contract address");
        _;
    }

    function mintReward(
        address[] calldata _receivers,
        uint256[] calldata _rewards
    ) external onlyBlockRewardContract {
        for (uint256 i = 0; i < _receivers.length; i++) {
            uint256 amount = _rewards[i];
            if (amount == 0) continue;
            address to = _receivers[i];
            _mint(to, amount);
            emit Mint(to, amount);
        }
    }

    function stake(address _staker, uint256 _amount) external onlyStakingContract {
        _transfer(_staker, stakingContract, _amount);
    }

    function withdraw(address _staker, uint256 _amount) external onlyStakingContract {
        _transfer(stakingContract, _staker, _amount);
    }

    function transfer(
        address _to,
        uint256 _value
    ) public notStakingContract(_to) returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public notStakingContract(_to)returns(bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function setBlockRewardContract(
        address _blockRewardContract
    ) public onlyOwner validContractAddress(_blockRewardContract) {
        blockRewardContract = _blockRewardContract;
    }

    function setStakingContract(
        address _stakingContract
    ) public onlyOwner validContractAddress(_stakingContract) {
        stakingContract = _stakingContract;
    }

}
