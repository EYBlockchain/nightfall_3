//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************
COLORED MONEY IMPLEMENTATION PROPOSAL
BY: JAVIER NIETO CENTENO
JNIETOCE@GRUPOSANTANDER.COM
*/

import '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

contract RLN is ERC1155Supply, AccessControlEnumerable, Ownable {
    event btf(address, address, uint256);
    event Minted(uint16, uint256);
    event Burnt(address, uint16, uint256);
    event Redemption(address, address, uint256);

    uint256[] public ids;
    uint256[] public amounts;

    // Boolean to suspend and resume the Smart Contract
    bool private suspended = false;

    // Roles present in the Smart Contract
    bytes32 public constant ENTITY_MANAGER = keccak256('ENTITY_MANAGER');
    bytes32 public constant REGULATOR = keccak256('REGULATOR');

    // Ratio RESREQ to 1 (1/RESREQ reserves %)
    uint256 private RESERVESREQ = 10;

    // Individual multiplier for each bank (<= RESREQ)
    mapping(address => uint256) private Multiplier;

    mapping(address => uint256) private TotalAllowanceByBank;

    // A single bank model
    mapping(address => uint256) private Allowance;

    // Entities that can issue tokens
    struct Entity {
        string entityName;
        address entityAddress;
    }

    // Array with all entities onboarded
    // The index in this array corresponds to the id of the token issued by that entity.
    // Id 0 is reserved for the "synthetic" token
    Entity[] Entities;

    mapping(address => uint16) private Bank2Id;

    // For the speed
    mapping(address => bool) private EntityCheck;

    mapping(address => address) private WalletToBank;
    // TODO be able to see the clients of bank

    modifier onlyEntityAddr() {
        require(
            EntityCheck[msg.sender] || hasRole(REGULATOR, msg.sender),
            'Caller is not the owner of the entity'
        );
        _;
    }

    // Checks that the entity exists and caller is the owner of that entity
    modifier onlyEntity(uint16 entityId) {
        require(entityId < Entities.length, 'Entity does not exist');
        require(
            Entities[entityId].entityAddress == _msgSender() || hasRole(REGULATOR, _msgSender()),
            'Caller is not the owner of the entity'
        );
        _;
    }

    constructor(string memory uri) ERC1155(uri) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // Assign to the creator the role of entity manager, just for convinience
        _setupRole(ENTITY_MANAGER, _msgSender());

        // Assign to the creator the role of regulator, just for convinience
        _setupRole(REGULATOR, _msgSender());

        Entity memory newEntity;
        newEntity.entityName = 'Reserved';
        newEntity.entityAddress = address(0); // TODO Maybe leave unset
        Entities.push(newEntity);
    }

    //Suspends the minting and burning
    function suspend() public onlyOwner {
        suspended = true;
    }

    //Resume the minting and burning
    function resume() public onlyOwner {
        suspended = false;
    }

    // I assume some event has been emitted on L1 with information on the amount of reserves locked through ion proofs or a trusted party
    // Maybe need to change onlyEntity so that ion verification contract can call this method on behold of the bank
    function mint(uint16 entityId, uint256 amount) public onlyEntity(entityId) {
        require(!suspended, 'Contract is suspended');
        _mint(msg.sender, entityId, amount, '');

        emit Minted(entityId, amount); // Privacy?
    }

    // When a client want to redeem (we dont care where at this point) the process should be transparent to the user.
    // Bank listens to redemption events and invokes burn method
    // The banks needs to have enough of its tokens
    function burn(
        address from,
        uint16 entityId,
        uint256 amount
    ) public onlyEntity(entityId) {
        require(!suspended, 'Contract is suspended');
        require(entityId != 0, 'Not a valid token'); // Redundant?
        require(balanceOf(from, entityId) >= amount, 'Not enough items!');
        _burn(from, entityId, amount);
        emit Burnt(from, entityId, amount); // Privacy?
    }

    // TODO design proper redemption
    // To be invoked by client who wants to redeem his allowance
    function redeem(uint256 amount) public {
        require(!EntityCheck[msg.sender], 'Banks should not redeem?');
        // Burn operation should only be performed by the bank, after listening to this event...
        emit Redemption(msg.sender, WalletToBank[msg.sender], amount); // Privacy?
    }

    // Function that returns the consolidated balance of a wallet
    // Adds all balances of diferent tokens in that wallet
    function consolidatedBalanceOf(address bank) public view returns (uint256) {
        require(EntityCheck[bank], 'Not a bank');
        uint256[] memory balances = getTokensByBank(bank);
        uint256 balance = 0;
        // Dont pick token 0
        for (uint256 i = 1; i < balances.length; i++) balance += balances[i];
        return balance;
    }

    // Transfer tokens of diferent colors until get the desired amount
    function consolidatedTransfer(
        address fromBank,
        address toBank,
        uint256 value,
        bytes calldata _data
    ) public {
        require(EntityCheck[fromBank], 'No bank for the sender');
        require(EntityCheck[toBank], 'No bank for the recipient');
        // Doubt: maybe we should mint automatically if token reserves are not sufficient
        require(consolidatedBalanceOf(fromBank) >= value, 'Not enough funds!');

        // Retrieve all balances
        uint256[] memory balances = getTokensByBank(fromBank);

        uint16 fromBankId = Bank2Id[fromBank];
        uint16 toBankId = Bank2Id[toBank];

        // Allocate memory for the arrays.
        // Need to use storage arrays so we cannot define them within this method. Delete seems to be the best way to reset the arrays
        delete ids;
        delete amounts;

        //
        // liquidity management strategy, for now we stick to a simple one.
        //
        // TODO check for the multiplier
        uint256 total = 0;

        // Check first if we have enough tokens of toBank
        if (balanceOf(fromBank, toBankId) >= value) {
            amounts.push(value);
            ids.push(toBankId);
        } else {
            if (balanceOf(fromBank, toBankId) > 0) {
                amounts.push(balanceOf(fromBank, toBankId));
                ids.push(toBankId);
            }
            total = balanceOf(fromBank, toBankId);
            for (uint16 i = 1; i < balances.length; i++) {
                if (i == toBankId) continue;

                if (value - total < balances[i]) {
                    amounts.push(value - total);
                    ids.push(i);
                    break;
                } else if (balances[i] > 0) {
                    amounts.push(balances[i]);
                    ids.push(i);
                    total = total + balances[i];
                }
            }
        }

        // Make the appropriate transfer
        // ids = [2, 1, 4, 5, ...]
        // smounts = [2, 25, 17 ,44, ...]
        _safeBatchTransferFrom(fromBank, toBank, ids, amounts, _data);
    }

    // Iterate over every possible token, and return the array of balances (some of them will be zero in this case, including id 0)
    function getTokensByBank(address from) private view returns (uint256[] memory balances) {
        require(EntityCheck[from], 'Only banks have tokens');
        uint256[] memory fbalances = new uint256[](Entities.length);
        // It also returns token 0 for simplicity when managing indexes in other functions, but we will always disregard it
        for (uint256 id = 0; id < Entities.length; id++) fbalances[id] = balanceOf(from, id);
        return fbalances;
    }

    //Adds a new entity to the collection
    //Requires teh NTITY_MANAGER role
    //
    //Simple management of entities, for the testing we do not include delete or modify entities.
    function addEntity(string memory name, address wallet) public onlyRole(ENTITY_MANAGER) {
        require(!EntityCheck[wallet], 'Address in use already');
        Entity memory newEntity;
        newEntity.entityName = name;
        newEntity.entityAddress = wallet;
        Entities.push(newEntity);
        EntityCheck[wallet] = true;
        Bank2Id[wallet] = uint16(Entities.length - 1);
    }

    function isEntity(address wallet) public view returns (bool) {
        return EntityCheck[wallet];
    }

    // Returns all entities
    function getEntities() public view returns (Entity[] memory) {
        return Entities;
    }

    // Needed to properly implemet abn ERC1155
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControlEnumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Needed in an ERC1155. We may use this to provide entity information
    // So far it points to non-existatnt web
    function uri(uint256 entityId) public view virtual override returns (string memory) {
        return
            string(
                abi.encodePacked(
                    'https://test.coloredmoney.com/entities/',
                    Strings.toString(entityId)
                )
            );
    }

    // Reserve requirement getter and setter
    function setResReq(uint256 newReq) public onlyRole(REGULATOR) {
        RESERVESREQ = newReq;
    }

    function getResReq() public view returns (uint256) {
        return RESERVESREQ;
    }

    // Banks multiplier getter and setter
    function setMultiplier(uint256 newMul) public onlyEntityAddr {
        require(newMul <= RESERVESREQ, 'Not within regulatory limit');
        Multiplier[msg.sender] = newMul;
    }

    function getMultiplier(address entityAddr) public view onlyEntityAddr returns (uint256) {
        return Multiplier[entityAddr];
    }

    // Do we need this anymore? bft event?
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        emit btf(from, to, 0);
    }

    // Customer allowances management
    event custAccept(address indexed bank, address customer);

    function acceptCustomer(address customer) public returns (bool) {
        require(EntityCheck[msg.sender], 'Only an Entity can onboard');
        require(!EntityCheck[WalletToBank[customer]], 'Already a customer');
        WalletToBank[customer] = msg.sender;
        emit custAccept(msg.sender, customer);
        return true;
    }

    // Using onlyEntity also checks if the sender is the regulator. If we want to get rid of the array maybe its better to create a new onlyEntity verification
    function getTotalAllowance(uint16 entityId) public view onlyEntity(entityId) returns (uint256) {
        return TotalAllowanceByBank[Entities[entityId].entityAddress];
    }

    function approve(address spender, uint256 value) public {
        require(EntityCheck[msg.sender], 'Only an Entity can approve');
        require(WalletToBank[spender] == msg.sender, 'Not a customer');
        // Check reserves requirement
        // require(RESERVESREQ * consolidatedBalanceOf(msg.sender) > (TotalAllowanceByBank[msg.sender] + value), "Not Basel compliant");

        // Doubt: do we have different roles within the bank?
        require(
            Multiplier[msg.sender] * consolidatedBalanceOf(msg.sender) >
                (TotalAllowanceByBank[msg.sender] + value),
            'Increase your multiplier'
        );
        Allowance[spender] += value;
        TotalAllowanceByBank[msg.sender] += value;
    }

    // If token 0, the client "sends allowance" to other client, and in the process the banks exchange their colored tokens
    function safeTransferFrom(
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) public {
        if (id == 0) {
            address fromBank = WalletToBank[msg.sender];
            address toBank = WalletToBank[to];

            require(Allowance[msg.sender] >= amount, 'Insufficient balance');
            consolidatedTransfer(fromBank, toBank, amount, data);
            // Change allowances after consolidating transfer
            Allowance[msg.sender] -= amount;
            Allowance[to] += amount;
        } else {
            require(EntityCheck[msg.sender]);
            super.safeTransferFrom(msg.sender, to, id, amount, data);
        }
    }

    // Both the client and his bank can see the allowance
    function getAllowance(address client) public view returns (uint256) {
        require(msg.sender == client || msg.sender == WalletToBank[client], 'Not allowed');
        return Allowance[client];
    }

    // Default behaviour if the token is not 0. Otherwise, if its a client return its allowance, if it a bank return 0
    // (dont throw an error because some methods expect to get the full array)
    function balanceOf(address owner, uint256 tokenid) public view override returns (uint256) {
        // Privacy?
        if (tokenid != 0) {
            return super.balanceOf(owner, tokenid);
        } else {
            if (EntityCheck[owner]) {
                return 0;
            }
            return Allowance[owner];
        }
    }
}
