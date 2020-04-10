pragma solidity 0.5.10;


interface IToken {
    function mint(address, uint256) external returns(bool);
}


contract BridgeMock {
    IToken private _tokenContract;

    constructor (IToken _token) public {
        _tokenContract = _token;
    }

    function doMint(address _account, uint256 _amount) public {
        _tokenContract.mint(_account, _amount);
    }
}
