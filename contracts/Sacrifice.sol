pragma solidity 0.5.10;


contract Sacrifice {
    constructor(address payable _recipient) public payable {
        selfdestruct(_recipient);
    }
}
