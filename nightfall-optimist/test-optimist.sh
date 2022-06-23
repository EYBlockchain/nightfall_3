#! /bin/bash
# Test launches a second optimist and some transactions to fill database. The test firt checks
# if second optimist's db is being initialized. The second part of the test is to restart
# the second optimist and check if db is bebing initialized once nightfall is not in the initial state
#
# Test returns exit code 0 if sucessful and 1 if unsucessful

# Init tmux session
init_tmux(){
  KILL_SESSION=$(tmux ls 2> /dev/null | grep ${OPTIMIST_SESSION} || true)
  if [ "${KILL_SESSION}" ]; then
     tmux kill-session -t ${OPTIMIST_SESSION}
  fi
  tmux new -d -s ${OPTIMIST_SESSION}
  tmux split-window -h
}

kill_session(){
  ./stop-optimist.sh 
  tmux kill-session -t ${OPTIMIST_SESSION}
}

OPTIMIST_SESSION=optimist-test

echo "Init tmux session...."
OPTIMIST_PANE=0
ERC_TEST_PANE=1
init_tmux 

./start-optimist.sh -d

if [ -f optimist.env ]; then
  grep -v '^#' optimist.env
  # Export env vars
  export $(grep -v '^#' optimist.env | xargs)
else
  echo "optimist.env does not exist. You need to define the optimist.env with the needed variables to run an optimist."
  kill_session
  exit 1
fi

tmux send-keys -t ${OPTIMIST_PANE} "docker logs -f optimist_1" Enter

niter=0
while true; do
  echo "Connecting to Optimist...${OPTIMIST_HOST}:${OPTIMIST_PORT}"
  OPTIMIST_STATUS=$(curl http://${OPTIMIST_HOST}:${OPTIMIST_PORT}/healthcheck)
  if [ "${OPTIMIST_STATUS}" == "OK" ]; then
    echo "Connected to Optimist..."
    break
  fi
  niter=$(($niter+1))
  if [ "${niter}" = "20" ]; then
    echo "Couldnt connect to Optimist"
    kill_session
    exit 1
  fi
  sleep 10;
done

tmux send-keys -t ${ERC_TEST_PANE} "cd .. && npm run test-e2e-tokens" Enter

niter=0
while true; do
  NBLOCKS=$(mongosh --host localhost:${MONGO_PORT}\
   --username ${MONGO_INITDB_ROOT_USERNAME} \
   --password ${MONGO_INITDB_ROOT_PASSWORD} \
   --quiet \
   --eval  "db.getMongo().use(\"optimist_data\");\
           db.blocks.find().count();") 

  if [ "$((${NBLOCKS}))" -gt "5" ]; then
    break;
  fi
  echo "Optimizer synchronized ${NBLOCKS} blocks..."

  niter=$(($niter+1))
  if [ "${niter}" = "20" ]; then
    echo "Couldnt synchronize"
    kill_session
    exit 1
  fi

  sleep 10;
done

echo "Restart optimist"
./start-optimist.sh -d

tmux send-keys -t ${OPTIMIST_PANE} "docker logs -f optimist_1" Enter

niter=0
while true; do
  NBLOCKS=$(mongosh --host localhost:${MONGO_PORT}\
   --username ${MONGO_INITDB_ROOT_USERNAME} \
   --password ${MONGO_INITDB_ROOT_PASSWORD} \
   --quiet \
   --eval  "db.getMongo().use(\"optimist_data\");\
           db.blocks.find().count();") 

  if [ "$((${NBLOCKS}))" -gt "10" ]; then
    break;
  fi
  echo "Optimizer synchronized ${NBLOCKS} blocks..."

  niter=$(($niter+1))
  if [ "${niter}" = "20" ]; then
    echo "Couldnt synchronize"
    kill_session
    exit 1
  fi

  sleep 10;
done

kill_session 

echo "Test passed"
exit 0
