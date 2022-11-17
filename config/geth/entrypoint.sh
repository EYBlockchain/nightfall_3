#! /bin/sh
geth init --datadir=/data /setup/genesis.json
PASSWORDFILE=/tmp/geth.$$.$RANDOM
trap "rm -f $PASSWORDFILE; exit 1" SIGHUP SIGINT SIGTERM
echo not very secret test key > $PASSWORDFILE
echo test key for second account >> $PASSWORDFILE
echo test key for third account >> $PASSWORDFILE
echo test key for fourth account >> $PASSWORDFILE
echo test key for fifth account >> $PASSWORDFILE
echo test key for sixth account >> $PASSWORDFILE
echo test key for seventh account >> $PASSWORDFILE
echo test key for eighth account >> $PASSWORDFILE
echo test key for proposer1 >> $PASSWORDFILE
echo test key for proposer2 >> $PASSWORDFILE
echo test key for proposer3 >> $PASSWORDFILE
echo test key for proposer4 >> $PASSWORDFILE
echo test key for proposer5 >> $PASSWORDFILE
echo test key for proposer6 >> $PASSWORDFILE
echo test key for proposer7 >> $PASSWORDFILE
echo test key for proposer8 >> $PASSWORDFILE
echo test key for proposer9 >> $PASSWORDFILE
echo test key for proposer10 >> $PASSWORDFILE
echo test key for challenger1 >> $PASSWORDFILE
echo test key for challenger2 >> $PASSWORDFILE
echo test key for challenger3 >> $PASSWORDFILE
echo test key for challenger4 >> $PASSWORDFILE
echo test key for challenger5 >> $PASSWORDFILE
echo test key for challenger6 >> $PASSWORDFILE
echo test key for challenger7 >> $PASSWORDFILE
echo test key for challenger8 >> $PASSWORDFILE
echo test key for challenger9 >> $PASSWORDFILE
echo test key for challenger10 >> $PASSWORDFILE
echo test key for user1 >> $PASSWORDFILE
echo test key for user2 >> $PASSWORDFILE
echo test key for user3 >> $PASSWORDFILE
echo test key for user4 >> $PASSWORDFILE
echo test key for user5 >> $PASSWORDFILE
echo test key for user6 >> $PASSWORDFILE
echo test key for user7 >> $PASSWORDFILE
echo test key for user8 >> $PASSWORDFILE
echo test key for user9 >> $PASSWORDFILE
echo test key for user10 >> $PASSWORDFILE
echo test key for user11 >> $PASSWORDFILE
echo test key for user12 >> $PASSWORDFILE
echo test key for user13 >> $PASSWORDFILE
echo test key for user14 >> $PASSWORDFILE
echo test key for user15 >> $PASSWORDFILE
echo test key for user16 >> $PASSWORDFILE
echo test key for user17 >> $PASSWORDFILE
echo test key for user18 >> $PASSWORDFILE
echo test key for user19 >> $PASSWORDFILE
echo test key for user20 >> $PASSWORDFILE
# These config items are shared by all nodes
# Individual configs can be given in docker-compose.geth.yml 'command:' lines
exec geth --bootnodes=`cat /setup/bootnodes` \
  --networkid 1337 \
  --password $PASSWORDFILE \
  --unlock 9c8b2276d490141ae1440da660e470e7c0349c63,feeda3882dd44aeb394caeef941386e7ed88e0e0,fCb059A4dB5B961d3e48706fAC91a55Bad0035C9,4789FD18D5d71982045d85d5218493fD69F55AC4,db080dC48961bC1D67a0A4151572eCb824cC76E8,a12D5C4921518980c57Ce3fFe275593e4BAB9211,fff578cddc48792522f4a7fdc3973ec0d41a831f,b9e9997dF5b3ac021AB3B29C64F3c339A2546816,dd6a81ce202578a11b6483b902fa206797c180a5,c99b1abd08ea51f4f9fa4c349612b3da8c810ae0,d9bc7f9282fc4413cdd66ed911a4d30bf74ab7ee,f3cb7dcd67c07a44e513ba8d53bf3883e038152c,0ede0798107a44c276dddd3e36223efa80f1c96a,282a0888451593d04a55dc7c1aa37107f333a18e,60580ac220fb4eb64da76c67926759cfdbf3e320,5b4dca8e572b42bc286ea1b73fcf586b3e092da8,3d2bce8d41726edf1f5e9d68f00695e2af72a779,68faa288e2842ec91836f180a16699417e9dce0f,0d353090d5b95cc7ff260a41cd4f7462a760eac2,28d1bc960c61cb4822da55f184ca69608f8f584f,d09e780f0544b336f223a38850dd273deeb7330f,1009eb50fc46b2e9e53d337ff3566aa481eba69a,110a4763c74faf4432449aa3e327a07f1afca64c,6928ac75e880d0b3781ee4f42f9c54988ed8ec68,368e47a84fcce73f936527f2aa869b6445a65e3a,a5ac5c3acab18f3fc8e185d2d0a65193bad4bb10,4281ea3841247ebe0a5e3020d3b0326188dec3d5,cac9edd8f93aeb4a4453387df662a2be2f585462,316f2ee26956d28557ecbc28dce649eed39623b1,cb4694ce55b666675a50bdcd7eced9a1b6776b08,30bb77e9c33d2123d4ec697b4d17747363a0d4ca,7baed1be2a5148189b32df8e28eb7d0f7601a604,f67e2c660bd5a1ea22b2f497904291eae18b5eae,7248c89d5d8a247320c9b1291d3b091fe02327a7,014ba261ecef0b19e99f169718992be67aeadbd7,8de3597f0d19f478e2a2f9ef8344c5ace86dfe21,4c197193f31ebe2b668a0f5f6932adcfbd55bbfc,35f63f1e2c0228c3cebf6029a9fe9a804fbf32c6,65291cadfe27343121196ef589b15f99bbb42e7d,083020778546a126d7ed7c130f674c0ed2001f0e,23037ec6d5918f870685daf81b1f1c6fa9637a1b,3eb191e0c8dbd7ca5875b32cdda2865cb5768479,589e0ca5be333dd66a2152f1f99d78f119df9273,3061e6d67bf810e1ce0a8addcb9f0d56519ac00d,306a883558a2fb367ec46542255dfb101a525e04,73cce38d205af579715a31e5243f885d73914203,dec1ffc384ac3b2159460bb5814d9b44bded45a9,82d8432767939e1fe187a920dde04f3b580919e2 \
  --keystore /setup/keystore \
  --ethash.dagdir=/dag \
  --datadir=/data \
  --allow-insecure-unlock \
  --miner.etherbase=0x00a329c0648769a73afac7f9381e08fb43dbea72 \
  --miner.gastarget 15000000 \
  --miner.gaslimit 30000000 \
  --miner.threads=1 \
  "$@"
rm -f $PASSWORDFILE
exit 0
