Tests using **Mythril**. Issues were found only in **State.sol** and **Proposers.sol** contratcts, here is the report:

# Analysis results for #Proposers.sol

## Dependence on predictable environment variable
- SWC ID: 116
- Severity: Low
- Contract: Proposers
- Function name: `withdrawBond()`
- PC address: 1641
- Estimated Gas Usage: 3089 - 38735

### Description

A control flow decision is made based on The block.timestamp environment variable.
The block.timestamp environment variable is used to determine a control flow decision. Note that the values of variables like coinbase, gaslimit, block number and timestamp are predictable and can be manipulated by a malicious miner. Also keep in mind that attackers know hashes of earlier blocks. Don't use any of those environment variables as sources of randomness and be aware that use of these variables introduces a certain level of trust into miners.
In file: Proposers.sol:101

### Code

```
require(
            bond.time + COOLING_OFF_PERIOD < block.timestamp,
            'It is too soon to withdraw your bond'
        )
```

## Action Taken

NO-ACTION: The timestamp can be changed by a miner by ~15 seconds.  This does not affect the integrity of a bond withdrawal.

### Initial State:

Account: [CREATOR], balance: 0x410c0400000883, nonce:0, storage:{}
Account: [ATTACKER], balance: 0x0, nonce:0, storage:{}

### Transaction Sequence

Caller: [CREATOR], calldata: , value: 0x0
Caller: [SOMEGUY], function: withdrawBond(), txdata: 0x66eb9cec, value: 0x0


## Dependence on predictable environment variable
- SWC ID: 120
- Severity: Low
- Contract: Proposers
- Function name: `changeCurrentProposer()`
- PC address: 2726
- Estimated Gas Usage: 2312 - 37299

### Description

A control flow decision is made based on The block.number environment variable.
The block.number environment variable is used to determine a control flow decision. Note that the values of variables like coinbase, gaslimit, block number and timestamp are predictable and can be manipulated by a malicious miner. Also keep in mind that attackers know hashes of earlier blocks. Don't use any of those environment variables as sources of randomness and be aware that use of these variables introduces a certain level of trust into miners.
In file: Proposers.sol:27

### Code

```
require(
            block.number - state.getProposerStartBlock() > ROTATE_PROPOSER_BLOCKS,
            "It's too soon to rotate the proposer"
        )
```

## Action Taken

NO-ACTION: A malicious miner could change the time at which the block appears slightly (as measured by the block timestamp) and this may affect (within ~15), the apparent time at which a block appears but that has no affect on the integrity of the proposer rotation.

### Initial State:

Account: [CREATOR], balance: 0x20d9fbd, nonce:0, storage:{}
Account: [ATTACKER], balance: 0x0, nonce:0, storage:{}

### Transaction Sequence

Caller: [CREATOR], calldata: , value: 0x0
Caller: [SOMEGUY], function: changeCurrentProposer(), txdata: 0x77603f4a, value: 0x0


## Dependence on predictable environment variable
- SWC ID: 120
- Severity: Low
- Contract: Proposers
- Function name: `changeCurrentProposer()`
- PC address: 12890
- Estimated Gas Usage: 2276 - 37263

### Description

A control flow decision is made based on The block.number environment variable.
The block.number environment variable is used to determine a control flow decision. Note that the values of variables like coinbase, gaslimit, block number and timestamp are predictable and can be manipulated by a malicious miner. Also keep in mind that attackers know hashes of earlier blocks. Don't use any of those environment variables as sources of randomness and be aware that use of these variables introduces a certain level of trust into miners.
In file: #utility.yul:613

### Code

```
th_t_array$_t_uint64_$2_memory_ptr(va
```

## Action Taken

NO-ACTION: Unclear which code is being referred to here but it seems to be a re-statement of the previous concern.

### Initial State:

Account: [CREATOR], balance: 0x1, nonce:0, storage:{}
Account: [ATTACKER], balance: 0x0, nonce:0, storage:{}

### Transaction Sequence

Caller: [CREATOR], calldata: , value: 0x0
Caller: [ATTACKER], function: changeCurrentProposer(), txdata: 0x77603f4a, value: 0x0

_______________________________________________________________________________________
# Analysis results for State.sol

## External Call To User-Supplied Address
- SWC ID: 107
- Severity: Low
- Contract: State
- Function name: `withdraw()`
- PC address: 7199
- Estimated Gas Usage: 19133 - 114407

### Description

A call to a user-supplied address is executed.
An external message call to an address specified by the caller is executed. Note that the callee account might contain arbitrary code and could re-enter any function within this contract. Reentering the contract in an intermediate state may lead to unexpected behaviour. Make sure that no state modifications are executed after this call and/or reentrancy guards are in place.
In file: State.sol:233

### Code

```
payable(msg.sender).call{value: amount}('')
```

## Action Taken

NO-ACTION: This function uses a reentrancy guard.

### Initial State:

Account: [CREATOR], balance: 0x1000400016dd5, nonce:0, storage:{}
Account: [ATTACKER], balance: 0x21080490920482001, nonce:0, storage:{}

### Transaction Sequence

Caller: [CREATOR], calldata: , value: 0x0
Caller: [ATTACKER], function: withdraw(), txdata: 0x3ccfd60b, value: 0x0


## State access after external call
- SWC ID: 107
- Severity: Medium
- Contract: State
- Function name: `withdraw()`
- PC address: 7328
- Estimated Gas Usage: 19133 - 114407

### Description

Write to persistent state following external call
The contract account state is accessed after an external call to a user defined address. To prevent reentrancy issues, consider accessing the state only before the call, especially if the callee is untrusted. Alternatively, a reentrancy lock can be used to prevent untrusted callees from re-entering the contract in an intermediate state.
In file: @openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol:66

### Code

```
_status = _NOT_ENTERED
```

## Action Taken

NO-ACTION: This is an Openzeppelin contract. We accept these as correct.

### Initial State:

Account: [CREATOR], balance: 0x41000000013d9d, nonce:0, storage:{}
Account: [ATTACKER], balance: 0x11080092424488001, nonce:0, storage:{}

### Transaction Sequence

Caller: [CREATOR], calldata: , value: 0x0
Caller: [ATTACKER], function: withdraw(), txdata: 0x3ccfd60b, value: 0x0
