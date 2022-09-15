This was another _Static Test_ run using [Slither](https://github.com/crytic/slither). The command used was
`slither . --exclude msg-value-loop,delegatecall-loop --checklist --markdown-root https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/ > slither-nightfall-results.MD`
which generates a file with the name `slither-nightfall-results.MD` containing the content of the analyze. I had to exclude some the `detectors` **msg-value-loop** and **delegatecall-loop**, because the tool was failing during the analyze.

There should be some false positives, like the three ones with Severity = HIGH. Most of the warnings are "Informational", but there are some with LOW (25) and MEDIUM (28) severity.

**Please, ignore the ones related to OpenZeppelin. The tool doesn't have an option to ignore warnings in libraries.**

---------------
Summary
 - [uninitialized-state](#uninitialized-state) (3 results) (High)
 NO-ACTION None of these are local variables and, thus, they will not act as uninitialised pointers. I can see no other issues here but happy to be corrected.
 - [locked-ether](#locked-ether) (1 results) (Medium)
 NO-ACTION The withdraw() function is available to withdraw Ether.
 - [uninitialized-local](#uninitialized-local) (10 results) (Medium)
 NO-ACTION Unclear why this is an issue.
 - [unused-return](#unused-return) (17 results) (Medium)
 NO-ACTION These calls update state variables and thus a return is superfluous
 - [shadowing-local](#shadowing-local) (1 results) (Low)
 NO-ACTION This is in an Openzeppelin ERC mock contract used for testing only
 - [missing-zero-check](#missing-zero-check) (7 results) (Low)
 NO-ACTION The lack of a zero check in these functions is not material: it's not special compared to any other value we might set
 - [incorrect-modifier](#incorrect-modifier) (1 results) (Low)
 NO-ACTION This is in the Truffle migration contract.
 - [variable-scope](#variable-scope) (7 results) (Low)
 NO-ACTION These refer to Openzeppelin contracts
 - [reentrancy-events](#reentrancy-events) (3 results) (Low)
 NO-ACTION These functions call our own contracts so there is no possibility of malicious re-entrancy
 - [timestamp](#timestamp) (6 results) (Low)
 NO-ACTION Small variations in timestamp value do not affect the integrity of the code
 - [assembly](#assembly) (12 results) (Informational)
 - [boolean-equal](#boolean-equal) (1 results) (Informational)
 - [pragma](#pragma) (1 results) (Informational)
 - [dead-code](#dead-code) (6 results) (Informational)
 - [solc-version](#solc-version) (49 results) (Informational)
 - [low-level-calls](#low-level-calls) (11 results) (Informational)
 - [missing-inheritance](#missing-inheritance) (1 results) (Informational)
 - [naming-convention](#naming-convention) (58 results) (Informational)
 - [similar-names](#similar-names) (9 results) (Informational)
 - [too-many-digits](#too-many-digits) (9 results) (Informational)
 - [unimplemented-functions](#unimplemented-functions) (2 results) (Informational)
 - [unused-state](#unused-state) (24 results) (Informational)
 - [constable-states](#constable-states) (1 results) (Optimization)
 - [external-function](#external-function) (63 results) (Optimization)
## uninitialized-state
Impact: High
Confidence: High
 - [ ] ID-0
[State.currentProposer](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L28) is never initialized. It is used in:

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L28


 - [ ] ID-1
[Config.bootProposer](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L16) is never initialized. It is used in:

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L16


 - [ ] ID-2
[Config.bootChallenger](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L17) is never initialized. It is used in:

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L17


## locked-ether
Impact: Medium
Confidence: High
 - [x] ID-3
Contract locking ether found:
	Contract [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375) has payable functions:
	 - [State.receive()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L71-L73)
	 - [State.proposeBlock(Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L81-L174)
	But does not have a function to withdraw the ether

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375


## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-4
[Verifier.verificationCalculation(uint256[],uint256[],uint256[]).vk](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L72) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L72


 - [ ] ID-5
[Utils.filterNonZeroValues(bytes32[2]).count](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L70) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L70


 - [ ] ID-6
[Proposers.registerProposer(string).proposer](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L58) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L58


 - [ ] ID-7
[Utils.filterCommitments(Structures.Transaction[]).count](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L92) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L92


 - [ ] ID-8
[ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).response](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L498) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L498


 - [ ] ID-9
[ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L480) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L480


 - [ ] ID-10
[Utils.countNonZeroValues(bytes32[2]).count](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L61) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L61


 - [ ] ID-11
[ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L503) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L503


 - [ ] ID-12
[Verifier.verificationCalculation(uint256[],uint256[],uint256[]).proof](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L70) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L70


 - [ ] ID-13
[ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).response](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L476) is a local variable never initialized

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L476


## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-14
[Challenges.challengeProofVerification(Structures.Block,Structures.Transaction[],uint256,Structures.Block[2],Structures.Block[2],Structures.Transaction[][2],Structures.Transaction[][2],uint256[8],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196) ignores return value by [state.areBlockAndTransactionsReal(blockL2ContainingHistoricRoot[0],transactionsOfblockL2ContainingHistoricRoot[0])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L135-L138)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196


 - [ ] ID-15
[Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L87-L115) ignores return value by [state.areBlockAndTransactionsReal(block2,transactions2)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L99)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L87-L115


 - [ ] ID-16
[ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L488-L509) ignores return value by [IERC1155Receiver(to).onERC1155BatchReceived(operator,from,ids,amounts,data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L497-L507)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L488-L509


 - [ ] ID-17
[Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L203-L236) ignores return value by [state.areBlockAndTransactionsReal(block1,txs1)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L217)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L203-L236


 - [ ] ID-18
[ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L467-L486) ignores return value by [IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L476-L484)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L467-L486


 - [ ] ID-19
[Challenges.challengeNewRootCorrect(Structures.Block,Structures.Transaction[],bytes32[33],Structures.Block,Structures.Transaction[],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L59-L80) ignores return value by [state.areBlockAndTransactionsReal(blockL2,transactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L70)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L59-L80


 - [ ] ID-20
[Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L87-L115) ignores return value by [state.areBlockAndTransactionsReal(block1,transactions1)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L98)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L87-L115


 - [ ] ID-21
[Challenges.challengeHistoricRoot(Structures.Block,Structures.Transaction[],uint256,bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L243-L303) ignores return value by [state.areBlockAndTransactionsReal(blockL2,transactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L250)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L243-L303


 - [ ] ID-22
[Challenges.challengeProofVerification(Structures.Block,Structures.Transaction[],uint256,Structures.Block[2],Structures.Block[2],Structures.Transaction[][2],Structures.Transaction[][2],uint256[8],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196) ignores return value by [state.areBlockAndTransactionsReal(blockL2ContainingHistoricRootFee[0],transactionsOfblockL2ContainingHistoricRootFee[0])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L161-L164)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196


 - [ ] ID-23
[Challenges.challengeLeafCountCorrect(Structures.Block,Structures.Transaction[],Structures.Block,Structures.Transaction[],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L33-L50) ignores return value by [state.areBlockAndTransactionsReal(blockL2,transactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L43)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L33-L50


 - [ ] ID-24
[Challenges.challengeProofVerification(Structures.Block,Structures.Transaction[],uint256,Structures.Block[2],Structures.Block[2],Structures.Transaction[][2],Structures.Transaction[][2],uint256[8],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196) ignores return value by [state.areBlockAndTransactionsReal(blockL2,transactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L129)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196


 - [ ] ID-25
[ERC721._checkOnERC721Received(address,address,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416) ignores return value by [IERC721Receiver(to).onERC721Received(_msgSender(),from,tokenId,data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L401-L412)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416


 - [ ] ID-26
[Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L203-L236) ignores return value by [state.areBlockAndTransactionsReal(block2,txs2)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L218)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L203-L236


 - [ ] ID-27
[Challenges.challengeNewRootCorrect(Structures.Block,Structures.Transaction[],bytes32[33],Structures.Block,Structures.Transaction[],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L59-L80) ignores return value by [state.areBlockAndTransactionsReal(priorBlockL2,priorBlockTransactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L69)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L59-L80


 - [ ] ID-28
[Challenges.challengeLeafCountCorrect(Structures.Block,Structures.Transaction[],Structures.Block,Structures.Transaction[],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L33-L50) ignores return value by [state.areBlockAndTransactionsReal(priorBlockL2,priorBlockTransactions)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L42)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L33-L50


 - [ ] ID-29
[Challenges.challengeProofVerification(Structures.Block,Structures.Transaction[],uint256,Structures.Block[2],Structures.Block[2],Structures.Transaction[][2],Structures.Transaction[][2],uint256[8],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196) ignores return value by [state.areBlockAndTransactionsReal(blockL2ContainingHistoricRootFee[1],transactionsOfblockL2ContainingHistoricRootFee[1])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L174-L177)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196


 - [ ] ID-30
[Challenges.challengeProofVerification(Structures.Block,Structures.Transaction[],uint256,Structures.Block[2],Structures.Block[2],Structures.Transaction[][2],Structures.Transaction[][2],uint256[8],bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196) ignores return value by [state.areBlockAndTransactionsReal(blockL2ContainingHistoricRoot[1],transactionsOfblockL2ContainingHistoricRoot[1])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L148-L151)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L117-L196


## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-31
[ERC721Mock.awardItem(address,string).tokenURI](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L13) shadows:
	- [ERC721URIStorage.tokenURI(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol#L20-L36) (function)
	- [ERC721.tokenURI(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L93-L98) (function)
	- [IERC721Metadata.tokenURI(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#L26) (function)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L13


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-32
[Config.setMaticAddress(address)._maticAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L56) lacks a zero-check on :
		- [maticAddress = _maticAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L57)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L56


 - [ ] ID-33
[State.initialize(address,address,address)._proposersAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L42) lacks a zero-check on :
		- [proposersAddress = _proposersAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L46)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L42


 - [ ] ID-34
[State.initialize(address,address,address)._shieldAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L44) lacks a zero-check on :
		- [shieldAddress = _shieldAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L48)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L44


 - [ ] ID-35
[Config.setBootChallenger(address).challenger](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L46) lacks a zero-check on :
		- [bootChallenger = challenger](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L47)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L46


 - [ ] ID-36
[SimpleMultiSig.execute(uint8[],bytes32[],bytes32[],address,uint256,bytes,address,uint256).destination](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L117) lacks a zero-check on :
		- [(success,None) = destination.call{gas: gasLimit,value: value}(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L136)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L117


 - [ ] ID-37
[Config.setBootProposer(address).proposer](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L31) lacks a zero-check on :
		- [bootProposer = proposer](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L32)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L31


 - [ ] ID-38
[State.initialize(address,address,address)._challengesAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L43) lacks a zero-check on :
		- [challengesAddress = _challengesAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L47)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L43


## incorrect-modifier
Impact: Low
Confidence: High
 - [ ] ID-39
Modifier [Migrations.restricted()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L12-L14) does not always execute _; or revert
https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L12-L14


## variable-scope
Impact: Low
Confidence: High
 - [ ] ID-40
Variable '[ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L503)' in [ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L488-L509) potentially used before declaration: [revert(string)(reason)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L504)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L503


 - [ ] ID-41
Variable '[ERC721._checkOnERC721Received(address,address,uint256,bytes).retval](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L401)' in [ERC721._checkOnERC721Received(address,address,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416) potentially used before declaration: [retval == IERC721Receiver.onERC721Received.selector](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L402)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L401


 - [ ] ID-42
Variable '[ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L480)' in [ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L467-L486) potentially used before declaration: [revert(string)(reason)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L481)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L480


 - [ ] ID-43
Variable '[ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).response](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L498)' in [ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L488-L509) potentially used before declaration: [response != IERC1155Receiver.onERC1155BatchReceived.selector](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L500)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L498


 - [ ] ID-44
Variable '[ERC721._checkOnERC721Received(address,address,uint256,bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L403)' in [ERC721._checkOnERC721Received(address,address,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416) potentially used before declaration: [reason.length == 0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L404)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L403


 - [ ] ID-45
Variable '[ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).response](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L476)' in [ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L467-L486) potentially used before declaration: [response != IERC1155Receiver.onERC1155Received.selector](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L477)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L476


 - [ ] ID-46
Variable '[ERC721._checkOnERC721Received(address,address,uint256,bytes).reason](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L403)' in [ERC721._checkOnERC721Received(address,address,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416) potentially used before declaration: [revert(uint256,uint256)(32 + reason,mload(uint256)(reason))](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L409)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L403


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-47
Reentrancy in [Proposers.changeCurrentProposer()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L26-L35):
	External calls:
	- [state.setProposerStartBlock(block.number)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L31)
	- [state.setCurrentProposer(currentProposer.nextAddress)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L33)
	Event emitted after the call(s):
	- [NewCurrentProposer(currentProposer.nextAddress)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L34)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L26-L35


 - [ ] ID-48
Reentrancy in [Shield.setAdvanceWithdrawalFee(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L225-L252):
	External calls:
	- [(success) = address(address(state)).call{value: msg.value}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L249)
	Event emitted after the call(s):
	- [InstantWithdrawalRequested(withdrawTransactionHash,msg.sender,msg.value)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L251)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L225-L252


 - [ ] ID-49
Reentrancy in [Proposers.registerProposer(string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L38-L84):
	External calls:
	- [(success) = address(address(state)).call{value: REGISTRATION_BOND}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L45)
	- [state.setBondAccount(msg.sender,REGISTRATION_BOND)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L47)
	- [state.setProposer(msg.sender,currentProposer)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L52)
	- [state.setProposerStartBlock(block.number)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L53)
	External calls sending eth:
	- [(success) = address(address(state)).call{value: REGISTRATION_BOND}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L45)
	Event emitted after the call(s):
	- [NewCurrentProposer(currentProposer.thisAddress)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L54)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L38-L84


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-50
[Shield.isValidWithdrawal(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L117-L140) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(time + COOLING_OFF_PERIOD < block.timestamp,It is too soon to withdraw funds from this block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L127-L130)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L117-L140


 - [ ] ID-51
[Shield.finaliseWithdrawal(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L150-L176) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(time + COOLING_OFF_PERIOD < block.timestamp,It is too soon to withdraw funds from this block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L160-L163)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L150-L176


 - [ ] ID-52
[Challenges.challengeAccepted(Structures.Block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L306-L324) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(state.getBlockData(badBlock.blockNumberL2).time >= (block.timestamp - 604800),Cannot challenge block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L308-L311)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L306-L324


 - [ ] ID-53
[Shield.requestBlockPayment(Structures.Block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(time + COOLING_OFF_PERIOD < block.timestamp,It is too soon to get paid for this block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L57-L60)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90


 - [ ] ID-54
[Proposers.withdrawBond()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L99-L112) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(bond.time + COOLING_OFF_PERIOD < block.timestamp,It is too soon to withdraw your bond)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L101-L104)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L99-L112


 - [ ] ID-55
[State.proposeBlock(Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L81-L174) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(b.blockNumberL2 == blockHashes.length,The block is out of order)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L87)
	- [require(bool,string)(b.previousBlockHash == blockHashes[blockHashes.length - 1].blockHash,The block is flawed or out of order)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L89-L92)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L81-L174


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-56
[Pairing.scalar_mul(Pairing.G1Point,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L67-L80) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L72-L76)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L67-L80


 - [ ] ID-57
[Pairing.pairing(Pairing.G1Point[],Pairing.G2Point[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L85-L111) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L102-L106)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L85-L111


 - [ ] ID-58
[MerkleTree_Stateless.insertLeaves(bytes32[],bytes32[33],uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L90-L192) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L116-L118)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L90-L192


 - [ ] ID-59
[ERC721._checkOnERC721Received(address,address,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L408-L410)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L394-L416


 - [ ] ID-60
[AddressUpgradeable.verifyCallResult(bool,bytes,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L174-L194) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L186-L189)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L174-L194


 - [ ] ID-61
[Utils.calculateMerkleRoot(bytes32[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L151-L185) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L152-L184)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L151-L185


 - [ ] ID-62
[Address.verifyCallResult(bool,bytes,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L201-L221) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L213-L216)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L201-L221


 - [ ] ID-63
[MiMC.MiMCpe7(uint256,uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L36-L61)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62


 - [ ] ID-64
[Pairing.addition(Pairing.G1Point,Pairing.G1Point)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L50-L64) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L56-L60)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L50-L64


 - [ ] ID-65
[Poseidon.poseidon.asm_0.mix()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12-L25) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12-L25)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12-L25


 - [ ] ID-66
[State.proposeBlock(Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L81-L174) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L111-L159)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L81-L174


 - [ ] ID-67
[Poseidon.poseidon(uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L9-L522) uses assembly
	- [INLINE ASM](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L10-L520)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L9-L522


## boolean-equal
Impact: Informational
Confidence: High
 - [ ] ID-68
[Shield.requestBlockPayment(Structures.Block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90) compares to a boolean constant:
	-[require(bool,string)(state.isBlockStakeWithdrawn(blockHash) == false,The block stake for this block is already claimed)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L62-L65)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-69
Different versions of Solidity are used:
	- Version used: ['>=0.4.21<0.9.0', '^0.8.0', '^0.8.1', '^0.8.2']
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L12)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#L4)
	- [^0.8.1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Context.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L6)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L2)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Stateful.sol#L9)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L12)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L3)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L3)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L3)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L3)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L2)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#L4)
	- [^0.8.2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Structures.sol#L6)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L2)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L7)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L14)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol#L4)
	- [>=0.4.21<0.9.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L2)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L5)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Counters.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L3)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#L4)
	- [^0.8.1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Strings.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L28)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol#L4)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC20Mock.sol#L2)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L9)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L47)
	- [^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#L4)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L12


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-70
[Pairing.P2()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L33-L40) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L33-L40


 - [ ] ID-71
[Pairing.P1()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L29-L31) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L29-L31


 - [ ] ID-72
[Pairing.pairingProd2(Pairing.G1Point,Pairing.G2Point,Pairing.G1Point,Pairing.G2Point)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L113-L121) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L113-L121


 - [ ] ID-73
[MiMC.GetScalarField()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19


 - [ ] ID-74
[Utils.filterNonZeroValues(bytes32[2])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L68-L74) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L68-L74


 - [ ] ID-75
[Pairing.pairingProd3(Pairing.G1Point,Pairing.G2Point,Pairing.G1Point,Pairing.G2Point,Pairing.G1Point,Pairing.G2Point)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L123-L137) is never used and should be removed

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L123-L137


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-76
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol#L4


 - [ ] ID-77
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L4


 - [ ] ID-78
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L3) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L3


 - [ ] ID-79
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L6) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L6


 - [ ] ID-80
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol#L4


 - [ ] ID-81
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#L4


 - [ ] ID-82
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L3) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L3


 - [ ] ID-83
Pragma version[^0.8.2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol#L4


 - [ ] ID-84
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol#L4


 - [ ] ID-85
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4


 - [ ] ID-86
Pragma version[>=0.4.21<0.9.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L2) is too complex

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L2


 - [ ] ID-87
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L2) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L2


 - [ ] ID-88
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L12) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L12


 - [ ] ID-89
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#L4


 - [ ] ID-90
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L12) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L12


 - [ ] ID-91
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#L4


 - [ ] ID-92
solc-0.8.3 is not recommended for deployment

 - [ ] ID-93
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L4


 - [ ] ID-94
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L28) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L28


 - [ ] ID-95
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#L4


 - [ ] ID-96
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4


 - [ ] ID-97
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol#L4


 - [ ] ID-98
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol#L4


 - [ ] ID-99
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L4


 - [ ] ID-100
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Structures.sol#L6) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Structures.sol#L6


 - [ ] ID-101
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L2) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L2


 - [ ] ID-102
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L5) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L5


 - [ ] ID-103
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L2) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L2


 - [ ] ID-104
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Strings.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Strings.sol#L4


 - [ ] ID-105
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L4


 - [ ] ID-106
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L4


 - [ ] ID-107
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4


 - [ ] ID-108
Pragma version[^0.8.1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L4


 - [ ] ID-109
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol#L4


 - [ ] ID-110
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#L4


 - [ ] ID-111
Pragma version[^0.8.1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L4


 - [ ] ID-112
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC20Mock.sol#L2) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC20Mock.sol#L2


 - [ ] ID-113
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Counters.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Counters.sol#L4


 - [ ] ID-114
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L3) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L3


 - [ ] ID-115
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L14) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L14


 - [ ] ID-116
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L3) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L3


 - [ ] ID-117
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155.sol#L4


 - [ ] ID-118
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L7) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L7


 - [ ] ID-119
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Stateful.sol#L9) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Stateful.sol#L9


 - [ ] ID-120
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L9) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L9


 - [ ] ID-121
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L4


 - [ ] ID-122
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L3) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L3


 - [ ] ID-123
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L47) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L47


 - [ ] ID-124
Pragma version[^0.8.0](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Context.sol#L4) allows old versions

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Context.sol#L4


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-125
Low level call in [Address.functionDelegateCall(address,bytes,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L184-L193):
	- [(success,returndata) = target.delegatecall(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L191)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L184-L193


 - [ ] ID-126
Low level call in [AddressUpgradeable.sendValue(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L60-L65):
	- [(success) = recipient.call{value: amount}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L63)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L60-L65


 - [ ] ID-127
Low level call in [Shield.setAdvanceWithdrawalFee(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L225-L252):
	- [(success) = address(address(state)).call{value: msg.value}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L249)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L225-L252


 - [ ] ID-128
Low level call in [Address.sendValue(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L60-L65):
	- [(success) = recipient.call{value: amount}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L63)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L60-L65


 - [ ] ID-129
Low level call in [Address.functionCallWithValue(address,bytes,uint256,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L128-L139):
	- [(success,returndata) = target.call{value: value}(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L137)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L128-L139


 - [ ] ID-130
Low level call in [Shield.requestBlockPayment(Structures.Block)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90):
	- [(success) = address(address(state)).call{value: feePaymentsEth}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L77)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L49-L90


 - [ ] ID-131
Low level call in [Address.functionStaticCall(address,bytes,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L157-L166):
	- [(success,returndata) = target.staticcall(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L164)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/utils/Address.sol#L157-L166


 - [ ] ID-132
Low level call in [AddressUpgradeable.functionCallWithValue(address,bytes,uint256,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L128-L139):
	- [(success,returndata) = target.call{value: value}(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L137)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L128-L139


 - [ ] ID-133
Low level call in [Proposers.registerProposer(string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L38-L84):
	- [(success) = address(address(state)).call{value: REGISTRATION_BOND}()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L45)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L38-L84


 - [ ] ID-134
Low level call in [SimpleMultiSig.execute(uint8[],bytes32[],bytes32[],address,uint256,bytes,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L117-L138):
	- [(success,None) = destination.call{gas: gasLimit,value: value}(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L136)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L117-L138


 - [ ] ID-135
Low level call in [AddressUpgradeable.functionStaticCall(address,bytes,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L157-L166):
	- [(success,returndata) = target.staticcall(data)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L164)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol#L157-L166


## missing-inheritance
Impact: Informational
Confidence: High
 - [ ] ID-136
[Shield](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324) should inherit from [IERC721Receiver](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#L11-L27)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-137
Contract [MerkleTree_Stateless](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L16-L193) is not in CapWords

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L16-L193


 - [ ] ID-138
Parameter [MerkleTree_Stateless.insertLeaves(bytes32[],bytes32[33],uint256)._frontier](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L92) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L92


 - [ ] ID-139
Function [IERC20PermitUpgradeable.DOMAIN_SEPARATOR()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol#L59) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol#L59


 - [ ] ID-140
Function [MiMC.Encipher(uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21-L26) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21-L26


 - [ ] ID-141
Parameter [Poseidon.poseidon.asm_0.mix()._t2_poseidon_asm_0_mix](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12


 - [ ] ID-142
Parameter [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256).in_seed](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64


 - [ ] ID-143
Variable [Migrations.last_completed_migration](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L6) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L6


 - [ ] ID-144
Parameter [Verifier.verify(uint256[],uint256[],uint256[])._publicInputs](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L55) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L55


 - [ ] ID-145
Parameter [MiMC.mimcHash(bytes32[]).in_msgs](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L84) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L84


 - [ ] ID-146
Parameter [Verifier.verify(uint256[],uint256[],uint256[])._vk](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L56) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L56


 - [ ] ID-147
Parameter [State.initialize(address,address,address)._shieldAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L44) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L44


 - [ ] ID-148
Variable [ContextUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L36) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L36


 - [ ] ID-149
Function [ReentrancyGuardUpgradeable.__ReentrancyGuard_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L44-L46) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L44-L46


 - [ ] ID-150
Parameter [Key_Registry.registerVerificationKey(uint256[],Structures.TransactionTypes)._txType](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L22) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L22


 - [ ] ID-151
Function [MiMC.MiMCpe7(uint256,uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62


 - [ ] ID-152
Function [Pairing.scalar_mul(Pairing.G1Point,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L67-L80) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L67-L80


 - [ ] ID-153
Parameter [MiMC.MiMCpe7(uint256,uint256,uint256,uint256).in_seed](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33


 - [ ] ID-154
Parameter [State.initialize(address,address,address)._proposersAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L42) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L42


 - [ ] ID-155
Parameter [MiMC.MiMCpe7(uint256,uint256,uint256,uint256).round_count](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33


 - [ ] ID-156
Parameter [MiMC.mimcHash2(bytes32[2]).in_msgs](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L93) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L93


 - [ ] ID-157
Variable [PausableUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116


 - [ ] ID-158
Parameter [MiMC.Encipher(uint256,uint256).in_x](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21


 - [ ] ID-159
Contract [Key_Registry](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L8-L32) is not in CapWords

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L8-L32


 - [ ] ID-160
Parameter [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256).in_k](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64


 - [ ] ID-161
Parameter [MiMC.Hash(uint256[],uint256).in_key](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77


 - [ ] ID-162
Function [ReentrancyGuardUpgradeable.__ReentrancyGuard_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L40-L42) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L40-L42


 - [ ] ID-163
Parameter [MiMC.Encipher(uint256,uint256).in_k](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21


 - [ ] ID-164
Variable [SimpleMultiSig.DOMAIN_SEPARATOR](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L71) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/SimpleMultiSig.sol#L71


 - [ ] ID-165
Function [ContextUpgradeable.__Context_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L21-L22) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L21-L22


 - [ ] ID-166
Parameter [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256).round_count](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64


 - [ ] ID-167
Variable [Ownable._owner](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L20) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L20


 - [ ] ID-168
Parameter [State.initialize(address,address,address)._challengesAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L43) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L43


 - [ ] ID-169
Parameter [MiMC.MiMCpe7(uint256,uint256,uint256,uint256).in_x](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33


 - [ ] ID-170
Variable [ReentrancyGuardUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L74) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L74


 - [ ] ID-171
Struct [Verifier.Proof_G16](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L39-L43) is not in CapWords

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L39-L43


 - [ ] ID-172
Parameter [Verifier.verify(uint256[],uint256[],uint256[])._proof](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L54) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L54


 - [ ] ID-173
Function [MiMC.GetScalarField()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19


 - [ ] ID-174
Function [Pairing.P2()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L33-L40) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L33-L40


 - [ ] ID-175
Parameter [Verifier.verificationCalculation(uint256[],uint256[],uint256[])._publicInputs](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L67) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L67


 - [ ] ID-176
Constant [MerkleTree_Stateless.treeWidth](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L50) is not in UPPER_CASE_WITH_UNDERSCORES

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L50


 - [ ] ID-177
Constant [MerkleTree_Stateless.treeHeight](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L49) is not in UPPER_CASE_WITH_UNDERSCORES

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L49


 - [ ] ID-178
Parameter [MiMC.MiMCpe7(uint256,uint256,uint256,uint256).in_k](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33


 - [ ] ID-179
Function [Pairing.P1()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L29-L31) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pairing.sol#L29-L31


 - [ ] ID-180
Parameter [MerkleTree_Stateless.insertLeaves(bytes32[],bytes32[33],uint256)._leafCount](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L93) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MerkleTree_Stateless.sol#L93


 - [ ] ID-181
Function [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64-L75) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64-L75


 - [ ] ID-182
Parameter [Verifier.verificationCalculation(uint256[],uint256[],uint256[])._proof](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L66) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L66


 - [ ] ID-183
Function [MiMC.Hash(uint256[],uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77-L82) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77-L82


 - [ ] ID-184
Parameter [MiMC.Hash(uint256[],uint256).in_msgs](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77


 - [ ] ID-185
Parameter [Poseidon.poseidon.asm_0.mix()._t0_poseidon_asm_0_mix](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12


 - [ ] ID-186
Function [PausableUpgradeable.__Pausable_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L34-L36) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L34-L36


 - [ ] ID-187
Parameter [Config.setMaticAddress(address)._maticAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L56) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L56


 - [ ] ID-188
Function [ContextUpgradeable.__Context_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L18-L19) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L18-L19


 - [ ] ID-189
Parameter [Key_Registry.registerVerificationKey(uint256[],Structures.TransactionTypes)._vk](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L21) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L21


 - [ ] ID-190
Struct [Verifier.Verification_Key_G16](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L45-L51) is not in CapWords

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L45-L51


 - [ ] ID-191
Parameter [Poseidon.poseidon.asm_0.mix()._t1_poseidon_asm_0_mix](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L12


 - [ ] ID-192
Parameter [Verifier.verificationCalculation(uint256[],uint256[],uint256[])._vk](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L68) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L68


 - [ ] ID-193
Parameter [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256).in_x](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64


 - [ ] ID-194
Function [PausableUpgradeable.__Pausable_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L38-L40) is not in mixedCase

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L38-L40


## similar-names
Impact: Informational
Confidence: Medium
 - [ ] ID-195
Variable [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactionIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L92) is too similar to [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactionIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L93)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L92


 - [ ] ID-196
Variable [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).nullifierIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L207) is too similar to [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).nullifierIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L212)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L207


 - [ ] ID-197
Variable [ChallengesUtil.libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool).nullifierIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L103) is too similar to [ChallengesUtil.libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool).nullifierIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L106)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L103


 - [ ] ID-198
Variable [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactionIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L92) is too similar to [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).transactionIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L211)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L92


 - [ ] ID-199
Variable [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactions1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L90) is too similar to [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactions2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L91)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L90


 - [ ] ID-200
Variable [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).transactionIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L206) is too similar to [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).transactionIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L211)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L206


 - [ ] ID-201
Variable [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).isNullifierFee1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L208) is too similar to [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).isNullifierFee2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L213)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L208


 - [ ] ID-202
Variable [Challenges.challengeNullifier(Structures.Block,Structures.Transaction[],uint256,uint256,bool,Structures.Block,Structures.Transaction[],uint256,uint256,bool,bytes32).transactionIndex1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L206) is too similar to [Challenges.challengeNoDuplicateTransaction(Structures.Block,Structures.Block,Structures.Transaction[],Structures.Transaction[],uint256,uint256,bytes32).transactionIndex2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L93)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L206


 - [ ] ID-203
Variable [ChallengesUtil.libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool).isNullifierFee1](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L104) is too similar to [ChallengesUtil.libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool).isNullifierFee2](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L107)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L104


## too-many-digits
Impact: Informational
Confidence: Medium
 - [ ] ID-204
[Shield.payIn(Structures.Transaction)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L287-L323) uses literals with too many digits:
	- [require(bool,string)(addrNum < 0x010000000000000000000000000000000000000000,The given address is more than 160 bits)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L290-L293)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L287-L323


 - [ ] ID-205
[ERC1155Mock.constructor()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19) uses literals with too many digits:
	- [_mint(msg.sender,GOLD,1100000,)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L14)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19


 - [ ] ID-206
[ChallengesUtil.slitherConstructorConstantVariables()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L9-L140) uses literals with too many digits:
	- [ZERO = 0x0000000000000000000000000000000000000000000000000000000000000000](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L10-L11)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L9-L140


 - [ ] ID-207
[Poseidon.poseidon(uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L9-L522) uses literals with too many digits:
	- [t0 = addmod(uint256,uint256,uint256)(t0,16930089744400890347392540468934821520000065594669279286854302439710657571308,q_poseidon_asm_0)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L408)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Poseidon.sol#L9-L522


 - [ ] ID-208
[Utils.compressG1(uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L34-L41) uses literals with too many digits:
	- [parity = 0x8000000000000000000000000000000000000000000000000000000000000000 * (y % 2)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L36-L37)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L34-L41


 - [ ] ID-209
[ERC1155Mock.constructor()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19) uses literals with too many digits:
	- [_mint(msg.sender,SILVER,1200000,)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L15)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19


 - [ ] ID-210
[ERC1155Mock.constructor()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19) uses literals with too many digits:
	- [_mint(msg.sender,SHIELD,1100000,)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L18)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC1155Mock.sol#L13-L19


 - [ ] ID-211
[MiMC.GetScalarField()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19) uses literals with too many digits:
	- [0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L18)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L15-L19


 - [ ] ID-212
[MiMC.MiMCpe7(uint256,uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62) uses literals with too many digits:
	- [localQ_MiMCpe7_asm_0 = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L44)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L33-L62


## unimplemented-functions
Impact: Informational
Confidence: High
 - [ ] ID-213
[State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375) does not implement functions:
	- [ContextUpgradeable.__Context_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L18-L19)
	- [ContextUpgradeable.__Context_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L21-L22)
	- [PausableUpgradeable.__Pausable_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L34-L36)
	- [PausableUpgradeable.__Pausable_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L38-L40)
	- [ReentrancyGuardUpgradeable.__ReentrancyGuard_init()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L40-L42)
	- [ReentrancyGuardUpgradeable.__ReentrancyGuard_init_unchained()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L44-L46)
	- [Initializable._disableInitializers()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol#L131-L137)
	- [ContextUpgradeable._msgData()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L27-L29)
	- [ContextUpgradeable._msgSender()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol#L23-L25)
	- [PausableUpgradeable._pause()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L94-L97)
	- [PausableUpgradeable._requireNotPaused()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L76-L78)
	- [PausableUpgradeable._requirePaused()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L83-L85)
	- [PausableUpgradeable._unpause()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L106-L109)
	- [State.addPendingWithdrawal(address,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L256-L263)
	- [State.areBlockAndTransactionReal(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L327-L341)
	- [State.areBlockAndTransactionsReal(Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L312-L325)
	- [State.deleteProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L192-L194)
	- [State.emitRollback(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L180-L182)
	- [State.getAllBlockData()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L243-L245)
	- [State.getBlockData(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L235-L237)
	- [State.getBondAccount(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L347-L349)
	- [Config.getBootChallenger()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L51-L53)
	- [Config.getBootProposer()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L36-L38)
	- [State.getCurrentProposer()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L200-L202)
	- [State.getFeeBookInfo(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L204-L211)
	- [State.getLatestBlockHash()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L251-L254)
	- [Config.getMaticAddress()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L60-L62)
	- [State.getNumberOfL2Blocks()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L247-L249)
	- [State.getProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L188-L190)
	- [State.getProposerStartBlock()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L288-L290)
	- [Config.getRestriction(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L66-L72)
	- [Config.initialize()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L21-L23)
	- [Pausable.initialize()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L10-L13)
	- [State.isBlockStakeWithdrawn(bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L368-L370)
	- [Ownable.owner()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L41-L43)
	- [Pausable.pause()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L15-L17)
	- [PausableUpgradeable.paused()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L69-L71)
	- [State.popBlockData()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L228-L233)
	- [State.pushBlockData(Structures.BlockData)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L224-L226)
	- [State.removeProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L292-L303)
	- [Config.removeRestriction(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L83-L86)
	- [State.rewardChallenger(address,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L351-L360)
	- [State.setBlockStakeWithdrawn(bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L372-L374)
	- [State.setBondAccount(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L343-L345)
	- [Config.setBootChallenger(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L46-L49)
	- [Config.setBootProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L31-L34)
	- [State.setCurrentProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L196-L198)
	- [State.setFeeBookInfo(address,uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L213-L222)
	- [Config.setMaticAddress(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L56-L58)
	- [Ownable.setOwner(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L48-L50)
	- [State.setProposer(address,Structures.LinkedAddress)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L184-L186)
	- [State.setProposerStartBlock(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L284-L286)
	- [Config.setRestriction(address,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L74-L81)
	- [Ownable.transferOwnership(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L56-L60)
	- [Pausable.unpause()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Pausable.sol#L19-L21)
	- [State.updateBondAccountTime(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L362-L366)
	- [State.updateProposer(address,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L305-L307)
	- [State.withdraw()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L265-L282)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375


 - [ ] ID-214
[MiMC](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L13-L101) does not implement functions:
	- [MiMC.Hash(uint256[],uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77-L82)
	- [MiMC.MiMCpe7_mp(uint256[],uint256,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L64-L75)
	- [MiMC.mimcHash(bytes32[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L84-L92)
	- [MiMC.mimcHash2(bytes32[2])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L93-L100)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L13-L101


## unused-state
Impact: Informational
Confidence: High
 - [ ] ID-215
[Utils.TRANSACTIONS_BATCH_SIZE](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L9) is never used in [Utils](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L7-L202)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L9


 - [ ] ID-216
[Config.ROTATE_PROPOSER_BLOCKS](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11) is never used in [Shield](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11


 - [ ] ID-217
[Config.REGISTRATION_BOND](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9


 - [ ] ID-218
[ReentrancyGuardUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L74) is never used in [Proposers](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L13-L122)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol#L74


 - [ ] ID-219
[Config.TXHASH_TREE_HEIGHT](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14


 - [ ] ID-220
[Config.REGISTRATION_BOND](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9) is never used in [Shield](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9


 - [ ] ID-221
[Config.ROTATE_PROPOSER_BLOCKS](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11


 - [ ] ID-222
[Config.COOLING_OFF_PERIOD](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L12) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L12


 - [ ] ID-223
[Config.ZERO](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13


 - [ ] ID-224
[Config.BLOCK_STAKE](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L10) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L10


 - [ ] ID-225
[Config.REGISTRATION_BOND](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9) is never used in [Challenges](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Challenges.sol#L17-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L9


 - [ ] ID-226
[PausableUpgradeable._paused](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L29) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L29


 - [ ] ID-227
[PausableUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116


 - [ ] ID-228
[Config.TXHASH_TREE_HEIGHT](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14) is never used in [Shield](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14


 - [ ] ID-229
[Config.maticAddress](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L18) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L18


 - [ ] ID-230
[PausableUpgradeable.__gap](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116) is never used in [Shield](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Shield.sol#L22-L324)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol#L116


 - [ ] ID-231
[Config.BLOCK_STAKE](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L10) is never used in [Proposers](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L13-L122)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L10


 - [ ] ID-232
[Config.ZERO](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13


 - [ ] ID-233
[Config.ROTATE_PROPOSER_BLOCKS](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L11


 - [ ] ID-234
[Config.erc20limit](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L19) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L19


 - [ ] ID-235
[Config.TXHASH_TREE_HEIGHT](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14) is never used in [Proposers](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L13-L122)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14


 - [ ] ID-236
[Config.COOLING_OFF_PERIOD](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L12) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L12


 - [ ] ID-237
[Config.TXHASH_TREE_HEIGHT](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14) is never used in [State](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L18-L375)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L14


 - [ ] ID-238
[Config.ZERO](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13) is never used in [Proposers](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Proposers.sol#L13-L122)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Config.sol#L13


## constable-states
Impact: Optimization
Confidence: High
 - [ ] ID-239
[State.proposerStartBlock](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L29) should be constant

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L29


## external-function
Impact: Optimization
Confidence: High
 - [ ] ID-240
rewardChallenger(address,address,uint256) should be declared external:
	- [State.rewardChallenger(address,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L351-L360)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L351-L360


 - [ ] ID-241
transferFrom(address,address,uint256) should be declared external:
	- [ERC20.transferFrom(address,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L158-L167)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L158-L167


 - [ ] ID-242
updateProposer(address,string) should be declared external:
	- [State.updateProposer(address,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L305-L307)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L305-L307


 - [ ] ID-243
libChallengeLeafCountCorrect(Structures.Block,Structures.Transaction[],uint256) should be declared external:
	- [ChallengesUtil.libChallengeLeafCountCorrect(Structures.Block,Structures.Transaction[],uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L17-L25)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L17-L25


 - [ ] ID-244
emitRollback(uint256) should be declared external:
	- [State.emitRollback(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L180-L182)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L180-L182


 - [ ] ID-245
getNumberOfL2Blocks() should be declared external:
	- [State.getNumberOfL2Blocks()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L247-L249)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L247-L249


 - [ ] ID-246
symbol() should be declared external:
	- [ERC721.symbol()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L86-L88)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L86-L88


 - [ ] ID-247
uri(uint256) should be declared external:
	- [ERC1155.uri(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L59-L61)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L59-L61


 - [ ] ID-248
libCheckOverflows(Structures.Block,Structures.Transaction) should be declared external:
	- [ChallengesUtil.libCheckOverflows(Structures.Block,Structures.Transaction)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L87-L99)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L87-L99


 - [ ] ID-249
getBondAccount(address) should be declared external:
	- [State.getBondAccount(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L347-L349)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L347-L349


 - [ ] ID-250
safeTransferFrom(address,address,uint256,uint256,bytes) should be declared external:
	- [ERC1155.safeTransferFrom(address,address,uint256,uint256,bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L117-L129)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L117-L129


 - [ ] ID-251
Encipher(uint256,uint256) should be declared external:
	- [MiMC.Encipher(uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21-L26)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L21-L26


 - [ ] ID-252
setProposer(address,Structures.LinkedAddress) should be declared external:
	- [State.setProposer(address,Structures.LinkedAddress)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L184-L186)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L184-L186


 - [ ] ID-253
safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) should be declared external:
	- [ERC1155.safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L134-L146)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L134-L146


 - [ ] ID-254
safeTransferFrom(address,address,uint256) should be declared external:
	- [ERC721.safeTransferFrom(address,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L164-L170)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L164-L170


 - [ ] ID-255
mimcHash(bytes32[]) should be declared external:
	- [MiMC.mimcHash(bytes32[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L84-L92)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L84-L92


 - [ ] ID-256
removeProposer(address) should be declared external:
	- [State.removeProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L292-L303)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L292-L303


 - [ ] ID-257
decreaseAllowance(address,uint256) should be declared external:
	- [ERC20.decreaseAllowance(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L201-L210)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L201-L210


 - [ ] ID-258
setBondAccount(address,uint256) should be declared external:
	- [State.setBondAccount(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L343-L345)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L343-L345


 - [ ] ID-259
deleteProposer(address) should be declared external:
	- [State.deleteProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L192-L194)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L192-L194


 - [ ] ID-260
symbol() should be declared external:
	- [ERC20.symbol()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L70-L72)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L70-L72


 - [ ] ID-261
getAllBlockData() should be declared external:
	- [State.getAllBlockData()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L243-L245)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L243-L245


 - [ ] ID-262
balanceOf(address) should be declared external:
	- [ERC20.balanceOf(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L101-L103)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L101-L103


 - [ ] ID-263
transfer(address,uint256) should be declared external:
	- [ERC20.transfer(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L113-L117)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L113-L117


 - [ ] ID-264
increaseAllowance(address,uint256) should be declared external:
	- [ERC20.increaseAllowance(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L181-L185)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L181-L185


 - [ ] ID-265
getProposerStartBlock() should be declared external:
	- [State.getProposerStartBlock()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L288-L290)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L288-L290


 - [ ] ID-266
getCurrentProposer() should be declared external:
	- [State.getCurrentProposer()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L200-L202)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L200-L202


 - [ ] ID-267
transferFrom(address,address,uint256) should be declared external:
	- [ERC721.transferFrom(address,address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L150-L159)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L150-L159


 - [ ] ID-268
setCompleted(uint256) should be declared external:
	- [Migrations.setCompleted(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L16-L18)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Migrations.sol#L16-L18


 - [ ] ID-269
approve(address,uint256) should be declared external:
	- [ERC721.approve(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L112-L122)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L112-L122


 - [ ] ID-270
getBlockData(uint256) should be declared external:
	- [State.getBlockData(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L235-L237)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L235-L237


 - [ ] ID-271
mimcHash2(bytes32[2]) should be declared external:
	- [MiMC.mimcHash2(bytes32[2])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L93-L100)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L93-L100


 - [ ] ID-272
verify(uint256[],uint256[],uint256[]) should be declared external:
	- [Verifier.verify(uint256[],uint256[],uint256[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L53-L63)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Verifier.sol#L53-L63


 - [ ] ID-273
setCurrentProposer(address) should be declared external:
	- [State.setCurrentProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L196-L198)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L196-L198


 - [ ] ID-274
transferOwnership(address) should be declared external:
	- [Ownable.transferOwnership(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L56-L60)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Ownable.sol#L56-L60


 - [ ] ID-275
decimals() should be declared external:
	- [ERC20.decimals()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L87-L89)
	- [ERC20Mock.decimals()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC20Mock.sol#L11-L13)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L87-L89


 - [ ] ID-276
setBlockStakeWithdrawn(bytes32) should be declared external:
	- [State.setBlockStakeWithdrawn(bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L372-L374)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L372-L374


 - [ ] ID-277
addPendingWithdrawal(address,uint256,uint256) should be declared external:
	- [State.addPendingWithdrawal(address,uint256,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L256-L263)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L256-L263


 - [ ] ID-278
initialize(address,address,address) should be declared external:
	- [State.initialize(address,address,address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L41-L50)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L41-L50


 - [ ] ID-279
name() should be declared external:
	- [ERC20.name()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L62-L64)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L62-L64


 - [ ] ID-280
setProposerStartBlock(uint256) should be declared external:
	- [State.setProposerStartBlock(uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L284-L286)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L284-L286


 - [ ] ID-281
hashTransactionHashes(Structures.Transaction[]) should be declared external:
	- [Utils.hashTransactionHashes(Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L19-L32)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Utils.sol#L19-L32


 - [ ] ID-282
popBlockData() should be declared external:
	- [State.popBlockData()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L228-L233)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L228-L233


 - [ ] ID-283
name() should be declared external:
	- [ERC721.name()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L79-L81)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L79-L81


 - [ ] ID-284
balanceOfBatch(address[],uint256[]) should be declared external:
	- [ERC1155.balanceOfBatch(address[],uint256[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L82-L98)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L82-L98


 - [ ] ID-285
getFeeBookInfo(address,uint256) should be declared external:
	- [State.getFeeBookInfo(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L204-L211)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L204-L211


 - [ ] ID-286
pushBlockData(Structures.BlockData) should be declared external:
	- [State.pushBlockData(Structures.BlockData)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L224-L226)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L224-L226


 - [ ] ID-287
getLatestBlockHash() should be declared external:
	- [State.getLatestBlockHash()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L251-L254)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L251-L254


 - [ ] ID-288
awardItem(address,string) should be declared external:
	- [ERC721Mock.awardItem(address,string)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L13-L24)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/mocks/ERC721Mock.sol#L13-L24


 - [ ] ID-289
setApprovalForAll(address,bool) should be declared external:
	- [ERC1155.setApprovalForAll(address,bool)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L103-L105)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#L103-L105


 - [ ] ID-290
getProposer(address) should be declared external:
	- [State.getProposer(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L188-L190)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L188-L190


 - [ ] ID-291
isBlockStakeWithdrawn(bytes32) should be declared external:
	- [State.isBlockStakeWithdrawn(bytes32)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L368-L370)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L368-L370


 - [ ] ID-292
areBlockAndTransactionsReal(Structures.Block,Structures.Transaction[]) should be declared external:
	- [State.areBlockAndTransactionsReal(Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L312-L325)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L312-L325


 - [ ] ID-293
getVerificationKey(Structures.TransactionTypes) should be declared external:
	- [Key_Registry.getVerificationKey(Structures.TransactionTypes)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L29-L31)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/Key_Registry.sol#L29-L31


 - [ ] ID-294
totalSupply() should be declared external:
	- [ERC20.totalSupply()](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L94-L96)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L94-L96


 - [ ] ID-295
approve(address,uint256) should be declared external:
	- [ERC20.approve(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L136-L140)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L136-L140


 - [ ] ID-296
balanceOf(address) should be declared external:
	- [ERC721.balanceOf(address)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L62-L65)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L62-L65


 - [ ] ID-297
areBlockAndTransactionReal(Structures.Block,Structures.Transaction,uint256,bytes32[6]) should be declared external:
	- [State.areBlockAndTransactionReal(Structures.Block,Structures.Transaction,uint256,bytes32[6])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L327-L341)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L327-L341


 - [ ] ID-298
libChallengeNewRootCorrect(Structures.Block,Structures.Transaction[],bytes32[33],Structures.Block,Structures.Transaction[]) should be declared external:
	- [ChallengesUtil.libChallengeNewRootCorrect(Structures.Block,Structures.Transaction[],bytes32[33],Structures.Block,Structures.Transaction[])](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L27-L52)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L27-L52


 - [ ] ID-299
updateBondAccountTime(address,uint256) should be declared external:
	- [State.updateBondAccountTime(address,uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L362-L366)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/State.sol#L362-L366


 - [ ] ID-300
Hash(uint256[],uint256) should be declared external:
	- [MiMC.Hash(uint256[],uint256)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77-L82)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/MiMC.sol#L77-L82


 - [ ] ID-301
setApprovalForAll(address,bool) should be declared external:
	- [ERC721.setApprovalForAll(address,bool)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L136-L138)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#L136-L138


 - [ ] ID-302
libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool) should be declared external:
	- [ChallengesUtil.libChallengeNullifier(Structures.Transaction,uint256,bool,Structures.Transaction,uint256,bool)](https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L101-L139)

https://github.com/EYBlockchain/nightfall_3/blob/master/nightfall-deployer/contracts/ChallengesUtil.sol#L101-L139
