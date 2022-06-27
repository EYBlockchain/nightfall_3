#! /bin/sh
geth init --datadir=/data /setup/genesis.json
PASSWORDFILE=/tmp/geth.$$.$RANDOM
trap "rm -f $PASSWORDFILE; exit 1" SIGHUP SIGINT SIGTERM
echo not very secret test key > $PASSWORDFILE
echo test key for second account >> $PASSWORDFILE
echo test key for third account >> $PASSWORDFILE
echo test key for fourth account >> $PASSWORDFILE
# These config items are shared by all nodes
# Individual configs can be given in docker-compose.geth.yml 'command:' lines
exec geth --bootnodes=`cat /setup/bootnodes` \
  --networkid 4378921 \
  --password $PASSWORDFILE \
  --unlock 9c8b2276d490141ae1440da660e470e7c0349c63,feeda3882dd44aeb394caeef941386e7ed88e0e0,fCb059A4dB5B961d3e48706fAC91a55Bad0035C9,4789FD18D5d71982045d85d5218493fD69F55AC4 \
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
