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
echo test key for eight account >> $PASSWORDFILE
# These config items are shared by all nodes
# Individual configs can be given in docker-compose.geth.yml 'command:' lines
exec geth --bootnodes=`cat /setup/bootnodes` \
  --networkid 1337 \
  --password $PASSWORDFILE \
  --unlock 9c8b2276d490141ae1440da660e470e7c0349c63,feeda3882dd44aeb394caeef941386e7ed88e0e0,fCb059A4dB5B961d3e48706fAC91a55Bad0035C9,4789FD18D5d71982045d85d5218493fD69F55AC4,0xabf4ed9f30bd1e4a290310d726c7bbdf39cd75a25eebd9a3a4874e10b4a0c4ce,0xcbbf1d0686738a444cf9f66fdc96289035c384c4e8d26768f94fa81f3ab6596a,0x1da216993fb96745dcba8bc6f2ef5deb75ce602fd92f91ab702d8250033f4e1c,0x955ff4fac3c1ae8a1b7b9ff197476de1f93e9f0bf5f1c21ff16456e3c84da587 \
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
