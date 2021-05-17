// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


/// ERC20 ///
abstract contract StubERC20 is ERC20 {
    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract StubERC20_0 is ERC20("StubERC20_0", "StubERC20_0"), StubERC20 {}
contract StubERC20_1 is ERC20("StubERC20_1", "StubERC20_1"), StubERC20 {}
contract StubERC20_2 is ERC20("StubERC20_2", "StubERC20_2"), StubERC20 {}
contract StubERC20_3 is ERC20("StubERC20_3", "StubERC20_3"), StubERC20 {}
contract StubERC20_4 is ERC20("StubERC20_4", "StubERC20_4"), StubERC20 {}
contract StubERC20_5 is ERC20("StubERC20_5", "StubERC20_5"), StubERC20 {}
contract StubERC20_6 is ERC20("StubERC20_6", "StubERC20_6"), StubERC20 {}
contract StubERC20_7 is ERC20("StubERC20_7", "StubERC20_7"), StubERC20 {}
contract StubERC20_8 is ERC20("StubERC20_8", "StubERC20_8"), StubERC20 {}
contract StubERC20_9 is ERC20("StubERC20_9", "StubERC20_9"), StubERC20 {}


/// ERC721 ///

abstract contract StubERC721 is ERC721 {
    function burn(uint256 id) external {
        _burn(id);
    }
    function mint(address account, uint256 id) external {
        _mint(account, id);
    }
}

contract StubERC721_0 is ERC721("StubERC721_0", "StubERC721_0"), StubERC721 {}
contract StubERC721_1 is ERC721("StubERC721_1", "StubERC721_1"), StubERC721 {}
contract StubERC721_2 is ERC721("StubERC721_2", "StubERC721_2"), StubERC721 {}
contract StubERC721_3 is ERC721("StubERC721_3", "StubERC721_3"), StubERC721 {}
contract StubERC721_4 is ERC721("StubERC721_4", "StubERC721_4"), StubERC721 {}
contract StubERC721_5 is ERC721("StubERC721_5", "StubERC721_5"), StubERC721 {}
contract StubERC721_6 is ERC721("StubERC721_6", "StubERC721_6"), StubERC721 {}
contract StubERC721_7 is ERC721("StubERC721_7", "StubERC721_7"), StubERC721 {}
contract StubERC721_8 is ERC721("StubERC721_8", "StubERC721_8"), StubERC721 {}
contract StubERC721_9 is ERC721("StubERC721_9", "StubERC721_9"), StubERC721 {}

/// ERC1155 ///

abstract contract StubERC1155 is ERC1155("") {
    function burn(address account, uint256 id, uint256 amount) external {
        _burn(account, id, amount);
    }
    function mint(address account, uint256 id, uint256 amount) external {
        _mint(account, id, amount, bytes(""));
    }
}

contract StubERC1155_0 is StubERC1155 {}
contract StubERC1155_1 is StubERC1155 {}
contract StubERC1155_2 is StubERC1155 {}
contract StubERC1155_3 is StubERC1155 {}
contract StubERC1155_4 is StubERC1155 {}
contract StubERC1155_5 is StubERC1155 {}
contract StubERC1155_6 is StubERC1155 {}
contract StubERC1155_7 is StubERC1155 {}
contract StubERC1155_8 is StubERC1155 {}
contract StubERC1155_9 is StubERC1155 {}
