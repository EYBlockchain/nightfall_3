#!/usr/bin/env bash
# Based on: http://www.richud.com/wiki/Ubuntu_Fluxbox_GUI_with_x11vnc_and_Xvfb

readonly G_LOG_I='[INFO]'
readonly G_LOG_W='[WARN]'
readonly G_LOG_E='[ERROR]'

main() {
    SESSION=selenium
    create_tmux ${SESSION} 

    # Start wallet
    tmux select-pane -t 0
    tmux send-keys "npm run start:docker" Enter
    # if VNC is enabled, start server
    if [ ${ENABLE_VNC_SERVER} -eq 1 ]; then
      launch_xvfb
      launch_window_manager
      run_vnc_server
    fi
    # Start selenium tests (after ganache has started and app has been deployed)
    if [ ${RUN_SELENIUM_TESTS} -eq 1 ]; then
      wait_ready
      tmux select-pane -t 1
      tmux send-keys "node  ../cli/src/proposer.mjs --environment Docker" Enter
      tmux select-pane -t 2
      tmux send-keys "node ../cli/src/liquidity-provider.mjs --environment Docker" Enter 
      tmux select-pane -t 3
      sudo touch test/.test_results
      sudo chown apps test/.test_results
      tmux send-keys "cd test && python3 wallet_test.py server docker | tee .test_results" Enter
      tmux send-keys "sudo touch .done; sudo chown apps .done" Enter
      #tmux send-keys "touch .done" Enter
      wait_tests_done
      # infinite loop to prevent container from terminating
      infinite_loop
    fi
}

infinite_loop() {
  while true; do
    sleep 10
  done
}

wait_tests_done() {
   while true; do
     if [ -f test/.done ]; then
        break
     fi
     sleep 10
   done
   cat test/.test_results
   testResults=$(cat test/.test_results | grep FAILED)
   if [ -z "${testResults}" ]; then
     echo "Selenium tests PASSED"
   else
     echo "Selenium tests FAILED"
   fi

}

wait_ready() {
  app_deployed=$(curl http://wallet-test:3010 2> /dev/null | grep favicon)
  while [ -z "${app_deployed}" ]; do
    echo "Waiting for wallet to be deployed"
    sleep 10;
    app_deployed=$(curl http://wallet-test:3010 2> /dev/null | grep favicon)
  done
  echo "Wallet deployed"
  sleep 60
  #wscommand='{"jsonrpc":  "2.0", "id": 0, "method":  "eth_blockNumber"}'
  #block=0
  #while [ ! -z "${block}" ] && [ "${block}" -lt 36 ]; do
    #res=$(wscat -c 'ws://blockchain1:8546' -w 1 -x "${wscommand}" | grep result)
    #echo "RES ${res}"
    #blockHex=$(echo ${res} | awk '{split($0,a,":"); print a[4]}' | tr -d '"' | tr -d '}' | tr -d '0x')	
    #echo "Busy ${wscommand} ${blockHex} ${block}"
    #block=$(printf $((16#${blockHex})))
    #sleep 10
  #done
  echo "Contracts deployed"
}

create_tmux() {
    session=${1}
    tmux new-session -d -s ${session}
    tmux split-window -v
    tmux split-window -h
    tmux select-pane -t 0
    tmux split-window -h
}

launch_xvfb() {
    # Set defaults if the user did not specify envs.
    export DISPLAY=${XVFB_DISPLAY:-:1}
    local screen=${XVFB_SCREEN:-0}
    local resolution=${XVFB_RESOLUTION:-1280x1024x24}
    local timeout=${XVFB_TIMEOUT:-5}

    # Start and wait for either Xvfb to be fully up or we hit the timeout.
    sudo Xvfb ${DISPLAY} -screen ${screen} ${resolution} &
    local loopCount=0
    until xdpyinfo -display ${DISPLAY} > /dev/null 2>&1
    do
        loopCount=$((loopCount+1))
        sleep 1
        if [ ${loopCount} -gt ${timeout} ]
        then
            echo "${G_LOG_E} xvfb failed to start."
            exit 1
        fi
    done
}

launch_window_manager() {
    local timeout=${XVFB_TIMEOUT:-5}

    # Start and wait for either fluxbox to be fully up or we hit the timeout.
    fluxbox &
    local loopCount=0
    until wmctrl -m > /dev/null 2>&1
    do
        loopCount=$((loopCount+1))
        sleep 1
        if [ ${loopCount} -gt ${timeout} ]
        then
            echo "${G_LOG_E} fluxbox failed to start."
            exit 1
        fi
    done
}

run_vnc_server() {
    local passwordArgument='-nopw'

    if [ -n "${VNC_SERVER_PASSWORD}" ]
    then
        local passwordFilePath="${HOME}/x11vnc.pass"
        if ! x11vnc -storepasswd "${VNC_SERVER_PASSWORD}" "${passwordFilePath}"
        then
            echo "${G_LOG_E} Failed to store x11vnc password."
            exit 1
        fi
        passwordArgument=-"-rfbauth ${passwordFilePath}"
        echo "${G_LOG_I} The VNC server will ask for a password."
    else
        echo "${G_LOG_W} The VNC server will NOT ask for a password."
    fi

    x11vnc -display ${DISPLAY} -forever ${passwordArgument} &
    wait $!
}

control_c() {
    echo ""
    exit
}

trap control_c SIGINT SIGTERM SIGHUP

main

#while true; do sleep 1; done
