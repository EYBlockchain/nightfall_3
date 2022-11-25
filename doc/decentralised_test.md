# Testing a Decentralised Network on Georli

This document describes how to run a real world test of a network of deployed Optimists, Clients, Users, Proposers and Challengers. The purpose of the test is to gain confidence that a fully decentralised network can operate without issues.

## Design criteria

### Multiple Clients and Optimists.

Mutliple, independent Clients and Optimists each with one Proposer, Challenger or User (as appropriate). This will more accurately reflect a real-world deployment. Some Optimists will have an attached Proposer and Challenger, some just a Challenger. There must be no more than one of each type of application attached to an Optimist.  Each Client should have a single user attached. Multiple users are allowable but complicate the test for minimal extra coverage. For simplicity, this document refers to an Optimist with attached Proposer and/or Challenger as a 'Nightfall Node'.

### Adversaries

After initial tests, we will also deploy Adversarial Clients, able to generate malicious transactions (e.g replays, proofs that do not verify...) and Lazy Optimists, which will uncritically assemble the 

### Independent Infrastructure

Each Client and Nightfall-Node should run on completely separate virtual infrastructure. It is allowable to share a database instance (e.g. a MongoDB instance), provided the databases that the instance contains are not themselves shared.

### Independent Test Scripts

Each User will be an identical but otherwise independent test script. . The alternative approach of having an over-arching test-runner is rejected because, although it simplifies orchestration of the test, it introduces an element of syncronisation that does not exist in the real world.  Using completely independent test runners forces asynchronous behaviour and it ensures that no User benefits from access to information that they would not have in real-world applications. Whilst there is no requirement 

A corollary of this approach is that each User application will not know when the test has finished because it has no direct view of the progress of other users. 

## Test requirements

The tests will be divided into two campaigns. The first tests basic functionality and reliability, the second is an adversarial test campaign which tests the ability of the network to detect and neutralise malicious transactions.

### Functionality and reliability testing

This is similar to the existing Ping Pong test but has a few significant differences as described beliow. The User application should be in the form of a script. It can run within the Mocha framework but this is not required; recall that each instance of the script runs independently of the others. Each script should do the following:

1. Be provided with a list of the addresses of other Users participating in the test
2. Have its Ethereum address loaded with sufficient funds to run the test
2. Have its Matic balance loaded with sufficient funds to run the test (assuming we use mattic to pay the Proposer and as the currency being transferred)
2. Present a valid end user certificate to `X509.sol` and register its Etherum address
3. Connect to its Client and generate ZKP keys
3. Deposit sufficient Matic into layer 2 to run the tests
3. Start the following test sequence:
    1. At random times (averaging once every 5 minutes, capped at 20 minutes) transfer a random amount of Matic to a randomly chosen User address (on average this can be a very small amount and capped to a still-small maximum  perhaps 100 times the average), recording details of each transaction (amount, recipient, timestamp)
    1. Record details of any transfers received (amount, timestamp)
    1. When it has performed n transfer transactions, wait enough time to reasonably allow all other uses to complete their transactions.
    1. Report each transaction that it has sent and each received to a central endpoint
    1. Withdraw its balance back to layer 1.

Once all reports are received, the endpoint code should perform a reconciliation and report the results.

The test should be run multiple times, doubling n each time and starting with a test run of a few minutes until tests exceed a week in duration with no failures at the end.

### Adversary testing

To keep databases consistent through rollbacks, we will use the 'Adversarial Client, Lazy Optimist' method of creating bad blocks. The test will be similar to the above, with the following additions:

1. An Adversarial User, Client and Lazy Optimist will be deployed.  There need only be one of each.
2. The test will be setup and run as above, however the adversarial User will create bad transactions of different types and send them to the Lazy Optimist, which will incorporate them into blocks
3. The bad blocks should be detected by the Challengers and successfully rolled back, enabling the test to complete successfully as previously.


## Test infrastructure
### Notes
- Only production is active
- All entities are active at all times
- Every optimist has a proposer and a challenger associacted
- Only boot proposer is working (proposer1)

### Overview
Test infrastructure will be deployed to AWS in the following environments:
- production
- preprod
- internal
- staging 

Actors deployed:
- 6 proposers -> `https://proposer<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 6 challengers -> `https://challenger<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 6 optimists https server-> `https://optimist-api<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 6 optimists wss server-> `wss://optimist-ws<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 10 clients-> `https://client<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 1 geth client: https-> `https://web3-rpc<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)
- 1 geth client: wss-> `wss://web3-ws<index>.<environment>.polygon-nightfall.technology`, where `index` is null, 2, 3,...10, and `environment` is `preprod`, `internal` or `staging` (production doesnt require anything)

To connect to optimist, challenger and geth you will need VPN. For proposer and clients, you wont.

### Accounts
First iteration will be deployed on a private network. These are the created accounts:

#### Proposer Accounts
0x890e4339bb19621fdff856c1edf48541eb473e54bd7c344085a71771398d385e  0xdd6a81ce202578a11b6483b902fa206797c180a5   proposer1
0x8e06d818d2fb12670f81e587c84e137f7acbdd8eb7ea090a4cd15cefa7daddcc  0xc99b1abd08ea51f4f9fa4c349612b3da8c810ae0   proposer2
0xc6041a1aa6caaca3a8c101975cfa6a24ca6dd72e0a1ebd376f2d195d15dbe1fc  0xd9bc7f9282fc4413cdd66ed911a4d30bf74ab7ee   proposer3
0x5d5f0d21415e2307a682af92406860d010100a41931d92b0d54ba9e8706fdbe1  0xf3cb7dcd67c07a44e513ba8d53bf3883e038152c   proposer4
0xdd9a1c4b897703d0a27e83e387235f83d56dfd3836197d9c68f2cf93a9af53bd  0x0ede0798107a44c276dddd3e36223efa80f1c96a   proposer5
0x5faee1cf91f53475b736cfa46dc639703cd92ec4f0508271bf32291374f94fb1  0x282a0888451593d04a55dc7c1aa37107f333a18e   proposer6
0x5a0f9d9b36c87ffd0de30d137844e03eeb8c6821c2aba1778107272507dcef39  0x60580ac220fb4eb64da76c67926759cfdbf3e320   proposer7
0x61e739daaf3b859ea5cb47474e5f35f21c7cba57e6c085d5647bf7af886b045c  0x5b4dca8e572b42bc286ea1b73fcf586b3e092da8   proposer8
0xfbbc3a8c748995ca15c0d76c8f747a4768497b7fb03828fc802e281b4229b7f8  0x3d2bce8d41726edf1f5e9d68f00695e2af72a779   proposer9
0x1eff8a0f8fa226ade155dc0009ecae0d749b4ff949a3dd9aae484961e8202abd  0x68faa288e2842ec91836f180a16699417e9dce0f   proposer10

#### Challenger Accounts
0x0f8aed28c2f07be68dbca70bf96631dccaf2bbb75ed1f333dc3803b473ee5810  0x0d353090d5b95cc7ff260a41cd4f7462a760eac2   challenger1
0x8b8c3cb0a739cd53d8d0a801a02b5052f58c7681cb07a3b4f441f06c15654ce9  0x28d1bc960c61cb4822da55f184ca69608f8f584f   challenger2
0x381ecb8c9a3bcce3198864c418a5f126acb3f8c408359776d53f26273173f166  0xd09e780f0544b336f223a38850dd273deeb7330f   challenger3
0x576485e8b665823e2add80d8698c4079a8c66c8309dcb0ec320e46066a5c5064  0x1009eb50fc46b2e9e53d337ff3566aa481eba69a   challenger4
0xf629d35337afb026c794646e2160f40dd4c2690601daa1266fa471945e0f922b  0x110a4763c74faf4432449aa3e327a07f1afca64c   challenger5
0x31c4d7c609d81a6841e56514a870285b40c759cdefce1b8f9a99f043b8aa8762  0x6928ac75e880d0b3781ee4f42f9c54988ed8ec68   challenger6
0xf16cb4da9e6ac1b9b1010d2e99a11ac3e02aaa7690712e687f8e5a728d62c69e  0x368e47a84fcce73f936527f2aa869b6445a65e3a   challenger7
0x98e453ed9c1fe54eb4a29ff20bc2a8992928b3b2e9f72a9db5775ae6ce2eed2b  0xa5ac5c3acab18f3fc8e185d2d0a65193bad4bb10   challenger8
0xae017ce0cf05d7c0c10f718d364ad6ec7a1e667b76c01d847a3a1b081412c25c  0x4281ea3841247ebe0a5e3020d3b0326188dec3d5   challenger9
0xc7227747a650360d88b1bf35c4a6fb9099295600ebc539321c740a4e2c96a995  0xcac9edd8f93aeb4a4453387df662a2be2f585462   challenger10

#### User Ethereum Accounts (Geth private network)

1. Duncan
0x37fa9b6d4de8fe2d3c1eb42c26db8cb607f75bfb2787a5237cbf77a0198934fd  0x316f2ee26956d28557ecbc28dce649eed39623b1   user1
0xbf17b043df51f879720988287dad6d12d7f4ec81b5bf9513311ce5e1db135bc2  0xcb4694ce55b666675a50bdcd7eced9a1b6776b08   user2
0x4ca5fc4ecfe3b922aab87324fb26b94b94245cd2e1853b223b684cc8b18b3318  0x30bb77e9c33d2123d4ec697b4d17747363a0d4ca   user3
0xe786848df73938f1a62b09e50396f0958d8cc87547643f2e693211f053f491d5  0x7baed1be2a5148189b32df8e28eb7d0f7601a604   user4

2. Ilyas
0x4aa2dc49d74f4afc07b52023534941132613a10adb214f862e37350211ecf187  0xf67e2c660bd5a1ea22b2f497904291eae18b5eae   user5
0x2396c3fca12247e45c57b833732283f7212265b58e5d222a63f6e57ed9052819  0x7248c89d5d8a247320c9b1291d3b091fe02327a7   user6
0xe4814a13f66720a34ba153b275459f75dcf9dedf683de4c4505f5486e6e3d891  0x014ba261ecef0b19e99f169718992be67aeadbd7   user7
0x19d9c556a09d474800478464065d0581bbdabd4eaca30c90e9541d9c27945704  0x8de3597f0d19f478e2a2f9ef8344c5ace86dfe21   user8

3. Chaitanya
0x31b3f0060c5d260965dade49765192752e0b08489f24daaaf5c0a48f3e833afb  0x4c197193f31ebe2b668a0f5f6932adcfbd55bbfc   user9
0x302683f4a24fa397a24a3ee0548dddbf322b19db99399f183ab5d52bf5f8486f  0x35f63f1e2c0228c3cebf6029a9fe9a804fbf32c6   user10
0xf202ad612eb4b3b400bfc81f9b36a67dfeece9d25a58c91ad84e1c3a6a8134ba  0x65291cadfe27343121196ef589b15f99bbb42e7d   user11
0xcfd0cc2a86bee92b08aae9197245b787a899133b49caad883d1ff8ee88d55ac0  0x083020778546a126d7ed7c130f674c0ed2001f0e   user12

4. David Ro
0xad39a6d84bd4a18503908b52273fe5cde58b5642594e730c9c2e2189c8209efd  0x23037ec6d5918f870685daf81b1f1c6fa9637a1b   user13
0xb46de7779d5e75914a6ac5abb9d8668d4d838a1abbc2d080590f1d986616bdce  0x3eb191e0c8dbd7ca5875b32cdda2865cb5768479   user14
0xcf4d8ebad572ac894ce9f5e3d202e6410bbbfd6f8cb6afa759a2e4fb951eecca  0x589e0ca5be333dd66a2152f1f99d78f119df9273   user15
0x8c3318022b423dedd0e12aa241fdaabe35fc90ad74230509b4e5e2dc82aaaf5d  0x3061e6d67bf810e1ce0a8addcb9f0d56519ac00d   user16

5. Bea
0x24bf2e632bb0b5c090976ecd374daf6372f501c2b923802e367344d771dfdfc0  0x306a883558a2fb367ec46542255dfb101a525e04   user17
0xace0668bab06bbc24da224fc6978c9778731755a41e3c275fe1bebe1cf40e7d1  0x73cce38d205af579715a31e5243f885d73914203   user18
0xec683a638b9ba10c260069f504670322ff757299b633dceaa6d4c69529b714a7  0xdec1ffc384ac3b2159460bb5814d9b44bded45a9   user19
0xbf51a592090a20ce03f3b864b00269c51922ceca5bd6b3a3d70e82c8892d9513  0x82d8432767939e1fe187a920dde04f3b580919e2   user20

6. Stefan
0xdb2e775a7a80f5951a02c3aae291ac5db2b20bf6499bb790c43a3ef1d9b0f10f  0x922518eb7f1ceb3c62833199a6ea421f5e9b69cb   user21
0xf57f07b5c719d392dd1b1e0ebae8fdaf9bc461764473e371f176efb3800a1fb7  0x63176e3f1a70b84b0cf5c004582ce547f65d57ed   user22
0xd66225078fa6b284e561c269311be341128e781cef79a7e003f41d04d0a1cd87  0x980c4af193b11a335593159db851fca5258fa975   user23
0x1254b4147721c502649f62ee681356389fe5a5e87daecdf434a0af3aeb72b073  0x3bed0257a2af41fbb381e57c45c165aba2b87741   user24

7. Ze
0x2007542fdf5a996079a811fa212837b93f2039a489daeb3571e07a160df601cd  0xba9ad4177e3a23e66873c203a5fa1f7453d0bfdd   user25
0xb77df8d96228280e13f35ca40dba53a998a2ae5af2bd12d633fbb4aa82003622  0x628c73366e516f81b514cd380cd1e3e45a28753f   user26
0x04337081619267e8ca08640c32f2e57f44bdfcb2c8a7c59002d917a32e9e5c32  0xd98ccb8af8833040270dd48e4656a164de63bf12   user27
0xfd8fd732cc779c893541ca54b0048c42513752734f7d3777f1eb3fe25ec52d8e  0x2ca9281143d39782781ef9a2aec3e5bf2e04adc2   user28

8. David Ru
0xc4e25952e6a0ed09411648e7f59f89b43484abc68a93eb2d905567506be67cc4  0xa501b6325ecc515f68824dac6bdfdfa0f03aae7e   user29
0xee3e3a09ae4bfe70e4341ba71a3e1fd73a7f615dec467108461b4d9642c1b6b8  0xdd8e29af717fad23af4e046fe911d95cf2fa7ccd   user30
0x695ea8e9a4b3aa11a1f5cd583721bfd722266f2d9d1516488eea728f97703cc5  0xf76bf369ee10256caa53bf7e10c95d5f561d2ff1   user31
0x41d4e115f2a92f9badd3b32e36c487275d9e796828c6ec055d45a1e0d9c23891  0x05222b60ff67bdc37741ac562b3c8eb6fa2d5cde   user32

9. Roger
0x3e46df1c4c344dcd59d93da0a5140a1668a4ea79b527c5f07a75f9bd8894c02d  0xe22b84e63bc1b11fa423f12df51bb0bc2af755c0   user33
0x21796d84d43d137dbbcdb488939bdaec96c798837344dfc76558c56ff39634e5  0x24ea3722a3eae3da662f3e1ecfd1d00a80f58b02   user34
0x554f7b482b3c1df318f8b9e2a098b9dc9abedb6104767e555ba4041a2aa1e7a1  0x2a4a13541336f95ebb2add924b3ebf6b65800d34   user35
0xeace663cc158eb1a039c3909e030a00fdd11a1091d3a836ca2b78f0d532f5d46  0x12f8781c8ea7d811b349f72a0f4287160d94163c   user36

10. Simon
0x9b5f80481888f42815dfe35849911e961fc8585b5d5b3b388e871c5766d263d9  0x0eef3bdcb375b5625fa0ff3f899a94605d0995ad   user37
0x81a584160c3380a0a54039fa71985536bc745feeda9a91601965faf716dc96c1  0xe53d5e31cfaaabd93695ac71cf3180373f434058   user38
0xea97ae8362e9f209251f50bd45b471308fe90247361f476aa80f5896a537e704  0xac2436c69932d14e31f1bcfe9364ed55b057fec3   user39
0x8466e8b6dd47d7be82023a34430a6ea18817a9f9650c51e72e7d8b1bdd327503  0x1861ccfc96c718b46e5482a69ec6b415a86bf95b   user40

11. Israel
0x949393c8b3536782a73e7687e62b69e109b80f6f693df381c1aa80cf93041892  0x48e281989f8dec446fa75bd92e957eb5edbf185f   user41
0xa44b9f82ce98f3db9991931b674183be6903472599cdaf11f2e2c7c72c9ef3bb  0x21f44ec5bcadd6c3140def2a453d05b04c5fd029   user42
0x8ba51fcd249439dcc59cbe2f221b238ad9180e6db4869665117813ef213bb3cd  0x8fd885724a0001990240bd7a0006ffb5a29a7c24   user43
0x9a7f8305392ce342ba0a1519b328060c8a9d8d8b0476e43c2d922e3bda2c192a  0xc4d058bc81b2f3098800709bfd0ad71292228a38   user44

12. Pawel
0x496389304633491bfa6e1cfb5a353c3267499d3999882ce662725f4865ce7643  0x9efc63e6914a7883ccd302c37bc690fff00b1eb7   user45
0xa151744f87fd451b850c0bbed183b3e2cd84744fe63ab4dd9ddd64fd8359e668  0x2b2b71c145b3bd22fca39312181f2bce8087a90e   user46
0x5516a29a4cecc113c367200acb04798d32e07582f459e5c953d98c1feb2da780  0x8e90695f897b3d98bfb16473a8b4ebdc4cb793e3   user47
0x57022af0b9d944e05f9e4153763a9e7926f1dbf1ea7caa9ebf7a460ef9e17ccc  0x74f895ea9d39d192170262cbb96de7249cdf90f4   user48

13. Eugenio
0xe4f638df9e146a282afed7063307a4cbb3f5421f4625ecab76c8a247dd963e1c  0xcfc63635b9b993461b8f4077935af3b03a837fd4   user49
0xc12ef8bbf024a51628bda8c8ccba54d33c4adc93d9c135c174af17707fb0e9e3  0x11e8245bc7d9a7866d829ad6afd3a9f66081f88a   user50
0x9cb24d154a873c767c050aa62588b677366ba466dc19bbef61293836aff4a71f  0xc2409efa177eb2d17e93862dcc09e92ae138ee63   user51
0x1577bb5497815a981d8563f09ebc21c4066a3fd624a45b34efaa05c3993c0eef  0xc293373d5fead57bcf1148b3d024d97dae29e215   user52

14. Unassigned
0xa4bd2f181659955461c55f72e55d01a2f9ea564585297595ddaeed9f849e703c  0xf7122877400020a6e338a43eda56d219b2fd3012   user53
0x89660a89ca9f55edb14a8f437fd2d23d585d280215d20e4baa6f14e44a1eed09  0x32fc80c78b0116c9656cc7a86bf76f4ded8d133c   user54
0xefdb60ef58f2bf0f627a9c92ea9044957ef22c97789c31a8b91ba9059bde4922  0x8f31f3eeb26f4106010fcae95ee3e59822b48102   user55


#### User Nightfall Accounts (Geth private network)
1. Duncan
mnemonic: verify chat pride demand unit truth offer area trick forget govern pledge
Compressed Zkp Public Key: 0x254f04767ae6f1bb0909a3071507b0fd7db2a1bdd12347377af73e72451bd887
mnemonic: access old survey run reduce pulse code stem extra plastic current foster
Compressed Zkp Public Key: 0x241df3693357ff56318aed08c4b8225eac24eeed3bd044eadbda1f3bf76f6a59
mnemonic: stadium quality hen east endless bid health melt tissue you over vote
Compressed Zkp Public Key: 0x0406d84b6b6768945904bdb9d55d71cd8b9d392ed84099524615f976640b90a6
mnemonic: universe length solar topple flush film scorpion gaze blanket supply age physical
Compressed Zkp Public Key: 0xa8aecae24fc4240b60af3a2daaf4b1031cce01d30df7a8035c052578153151fe

2. Ilyas
mnemonic: bonus bamboo dial limb cherry again obscure bulk jelly kitchen author pact
Compressed Zkp Public Key: 0x2a4ff58b141f6c847a00c44c93bbe2680e93042c75b9848c91cb10fd02654369
mnemonic: improve tired survey game adult depend total museum fitness venture slice ice
Compressed Zkp Public Key: 0x0416ec295a532351658733941d9a6ed46ac16d881122ca551a049c2b0ea8f546
mnemonic: direct shield lyrics work destroy link bubble cable room chuckle shift spray
Compressed Zkp Public Key: 0x8c629281b63cc5092eb3a9e32792f64c7357a902afbf630fea0611a6036fe608
mnemonic: soft erosion blur record jar mouse dust dizzy swarm rice unit hope
Compressed Zkp Public Key: 0x8c509db7e3c216d4428dcd980e361cb017987660d9b0ce998f1f560461568a26

3. Chaitanya
mnemonic: just tunnel warfare anxiety square someone dilemma dumb off evoke tragic business
Compressed Zkp Public Key: 0x1ff47b3ae57b0c45604d9aa6265bb3fe7894933786bdc931459d7bafafc52a40
mnemonic: castle master carbon memory apart coffee unveil pitch claw wheel sausage pioneer
Compressed Zkp Public Key: 0x1c7403d7e1e7cc34dd8df637af68e6651533a60e3cbd61fcb839107c4ba8816f
mnemonic: profit hole price vocal gravity fault rebuild prison raccoon gesture few jar
Compressed Zkp Public Key: 0x1eb22ed895799fde27a5c7ddaf945656225ed1901a251e8c7579f718aafec58a
mnemonic: pool outdoor employ coil blush mask allow pretty mask grant normal clever
Compressed Zkp Public Key: 0x8beaa9332ec65fecda14af112b18f03fae8826eef5087cb80a87d0c6a311aeee


4. David Ro
mnemonic: piano reopen volcano live achieve magic shuffle acid rough limit dose toilet
Compressed Zkp Public Key: 0x8951dc02b8761aac244c27d6ae74ea3095367469dd2bd9a294b1414da8885f97
mnemonic: scatter spawn become brass victory acid casual chair pair huge aspect leader
Compressed Zkp Public Key: 0x9a2fcd54b4340ae32b6b52810609ab0235224004dce6015675c315e19333405e
mnemonic: alien section kite sponsor ugly oxygen omit stick nasty disagree can trick
Compressed Zkp Public Key: 0xadb4e071d2721738eb775366130136b59ae490ee5ea838a584a909ddb6c41560
mnemonic: put occur enter silk reunion example catch ordinary trend energy want resource
Compressed Zkp Public Key: 0x9d478be6201373d807784f1588b421ed43f9cb365e555f1beaf695b234e7b41d


5. Bea
mnemonic: zoo cage what fantasy plunge kiwi tip wise shock wet solve creek
Compressed Zkp Public Key: 0xa7986df3207bf865cf0c73ab09524f3c7eeaecad163450cf5d7cad7595fe59cc
mnemonic: crawl clip rapid phone nurse initial paddle tonight green oven apart dragon
Compressed Zkp Public Key: 0x2761c386c6d0558442e2574e18fc238aba06bf9d0468da1dc05047685b2864d5
mnemonic: sort pear dove boy soon key level fetch foot raven unit engage
Compressed Zkp Public Key: 0xaf83b7537ed6792878dafe111c2cbb992b1a433e468a1021f6230222dee8f352
mnemonic: bench chuckle shaft pretty mouse photo asthma hint chaos loyal elevator law
Compressed Zkp Public Key: 0xa7d9fa45b26bf1ed316c7feeefccf3004a7f754372b23d5cf8517eaa5d4e25b4


6. Stefan
mnemonic: buyer spike slogan supreme female evolve catch approve weapon slice mean glimpse
Compressed Zkp Public Key: 0xa8d719f26a4e174a3a07d7a788fa0e92987df4fb92cf4810562e2398eecf5c4a
mnemonic: expect choice write damage vacuum maid angry actress noodle upset travel glove
Compressed Zkp Public Key: 0x906af066752d36d12bcfc72a72edc54e039177dc1a3fbb03b4fbd361bdc8cbef
mnemonic: two security prison cotton mention crouch huge cruel forum lock word jewel
Compressed Zkp Public Key: 0xaef1f9ca5987d51745dff1503ec0b38641f2195e199dce6c3cecfbfa0c0aa785
mnemonic: token slim walk throw suspect truck fitness rare churn chat slight glove
Compressed Zkp Public Key: 0x222d3f51523c21f95216afb9640f501e102b39e47767120e2ad5096ea169d3da


7. Ze
mnemonic: unable case trend group ice infant collect drop laptop then damage tobacco
Compressed Zkp Public Key: 0x2e9c46d96f3da9a2a89a667187591bc8ab3755f07241042bc86cf7b6f0527961
mnemonic: fog organ video soda exotic captain episode muffin prevent stone nest error
Compressed Zkp Public Key: 0x0f9552c0c6e772a22858accc6c48f1580b0b070a426ab1a614189819ae9a47cc
mnemonic: patient maximum unfair slender ankle better mystery expire chaos hint pistol plastic
Compressed Zkp Public Key: 0x284e1780d0983e0e372305b85d9a6c0f8b99d5fd105900c16e3e2075a8b0fe4c
mnemonic: cave gown lamp stick climb leisure body ugly finger during accident matrix
Compressed Zkp Public Key: 0x08a4ba3324fbdef8d48f4aeea260329dbe6fe94b15a033da42cafb7b7d1cf20f

8. David Ru
mnemonic: kangaroo strong peace cement neglect mix warfare wrist brisk diary admit season
Compressed Zkp Public Key: 0x0ab298bab97b7da256dfb9ffc50c35e7b9776fc96c7ec2f091ea5824e8c90364
mnemonic: mountain usage design vibrant clinic genius this express produce deposit differ answer
Compressed Zkp Public Key: 0x9dde47e704fe7da5d351386eacf16e38afb857491de1a38ec4d7836bbea74449
mnemonic: board harbor husband duck innocent diet ramp leisure eye machine clump journey
Compressed Zkp Public Key: 0x02cd9cc9ae4e0f3b4dbc8a5f8976c3d8c52e9037960304065889bfa3739337cf
mnemonic: average hand heart digital kingdom snap stone spin leaf ozone kidney tobacco
Compressed Zkp Public Key: 0x0c2c708a797741945efeb990fc174cbdea4b99563ea177b58dfab30f98095f75


9. Roger
mnemonic: stand practice wash valid drive valid hungry vital practice nature depth frog
Compressed Zkp Public Key: 0x102684a5867f6ea6a743bbb749af1c9c21b99c4ad3357f7d4ff4dc13b19c6cac
mnemonic: coyote whip popular equal deny what toast child sibling output prosper tuna
Compressed Zkp Public Key: 0x23c9a9efc576e82169313530eb5b40191d54b65c1cab822e2ec6aefba78e0fe8
mnemonic: six rack front boss option void beach legend glance wolf earn pony
Compressed Zkp Public Key: 0x81ac97709a7fd78ebb963fcced6ecb26f7db8d8540a01cd47156c9db30d11ba4
mnemonic: account fade good sketch north acoustic prison mouse multiply also jazz embody
Compressed Zkp Public Key: 0xafe0920966ab8a7bdfd83a39c6359a3e4e0cc97a9f341d6802791f884c5bb89c


10. Simon
mnemonic: come inside fit slow thank blanket slight excite bounce holiday sentence pool
Compressed Zkp Public Key: 0x2bfae13a44e501cf9d0894b9d30940ab342cebd1de076bf6e8f09ee293245d9a
mnemonic: shine solution deputy robot cruel clinic fence cupboard nut tiny appear catch
Compressed Zkp Public Key: 0x1c1f3ae164cedffa211dd379bbaefe0091c102c3a1214e1a40e36efd525b0388
mnemonic: harvest during badge fiscal exclude ecology soccer wish potato hunt safe improve
Compressed Zkp Public Key: 0x86d2a7d27ff46570decad46bc58ae4d36584b3e34651b6a589ea1018230a1575
mnemonic: verb fiber response now range taxi rescue unveil engine diary turtle denial
Compressed Zkp Public Key: 0x2181be0408972cb35d2bcc58bdd268618b638dd381b1b2c00f8c48fbbe7b8ec7


11. Israel
mnemonic: voyage sniff word close length hint roast cliff twenty coral liar connect
Compressed Zkp Public Key: 0x16707a0f58286896f15240d3b5223faed905f151915bc2ca48de7627f934d8fd
mnemonic: dinner primary early insane pyramid abstract sand flame two wool scale jeans
Compressed Zkp Public Key: 0x0f9ae73b8772f5cdfba9c73dd020d04e9d5e593ce0625a8115cabf833ae7d0f0
mnemonic: dress pet alpha wood oak beyond bamboo idle empower finish rib battle
Compressed Zkp Public Key: 0x01fcb0185ab2acda5ab56a25de84816afd0186ea4267eed25b40e2b86f15528a
mnemonic: advice beach pottery try half protect helmet inflict length pen measure hedgehog
Compressed Zkp Public Key: 0x8fffcff4576512e73bc35e718eab16641ed3d5ed8f505bf0c5e686d1e75a4a22


12. Pawel
mnemonic: suit crowd among section reason option tortoise electric salute dog velvet trophy
Compressed Zkp Public Key: 0x8609a9176c22689c7a340c9d4c9df1010cb7cfbcbcc60db1ca254bbc47ad5b80
mnemonic: pitch uncover raw giant range notice army learn deny human office example
Compressed Zkp Public Key: 0x8670193438644096b707cd29431df582392da7337f181a38ec68a678f5a008ac
mnemonic: earth amazing attract spoon spice warm shove enrich loop country film lemon
Compressed Zkp Public Key: 0x96a4f6c3dafd4bb6bcbb7ef31774a41ced58da364b92278ca46c9f36ede86344
mnemonic: hamster shadow size frown marble business slice gesture upper kitten spend candy
Compressed Zkp Public Key: 0x1e61df7afd506639841abe1494eb869a41e8d574107aa67e69ef2ae84c7f95cb


13. Eugenio
mnemonic: rail festival jacket exhibit song differ reveal acid spider what couch van
Compressed Zkp Public Key: 0x28cd2fb973e63576bad3dbfdf52d6c727a7d529c2b1b537f236813cf5802a49a
mnemonic: source super fall velvet submit also spray yellow shoe magic sibling license
Compressed Zkp Public Key: 0x1217e33648c3d3164fcc6ba9babf82c7acc47128f1dd8ed31b7d7a8840ccf0d1
mnemonic: only salad venture expire industry dignity when speak sword sorry park sword
Compressed Zkp Public Key: 0x1e49f9a63f11340416b79a38a0bca2fd7ceda71a5da2701be5584bb641d91333
mnemonic: devote future camp walk blast sign monster limit river jazz decrease initial
Compressed Zkp Public Key: 0x9beca7a96429ac5fb8928cc293db25806651befe17829ae960cb1481f148109b


14. Unassigned
mnemonic: project success country bid erosion surge mad vendor ticket science lion print
Compressed Zkp Public Key: 0x2c1df878db42bb5df798ad920840c941b3049d21d06422f41c5772e08f847861
mnemonic: milk clog dawn wife reflect prosper error abstract rigid focus buffalo egg
Compressed Zkp Public Key: 0xa0ad9f2513983558b67dbe91e40515bde40dfc4e3d36fbabccd856f0d9d33460
mnemonic: sick alien blood hat flight knock rare sword weird olive plunge sunset
Compressed Zkp Public Key: 0x0c5baf95687515c69d2cbe6b97ac3e015c49d1931172b04fd972c9b65219c808
