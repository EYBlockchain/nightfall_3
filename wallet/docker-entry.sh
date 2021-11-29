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
    tmux send-keys "npm start" Enter
    # if VNC is enabled, start server
    if [ ${ENABLE_VNC_SERVER} -eq 1 ]; then
      tmux select-pane -t 1
      tmux send-keys "launch_xvfb" Enter
      tmux send-keys "launch_window_manager" Enter
      tmux send-keys "run_vnc_server" Enter
    fi
    # Start selenium tests (after ganache has started and app has been deployed)
    if [ ${RUN_SELENIUM_TESTS} -eq 1]; then
      wait_ready
      tmux select-pane -t 1
      tmux send-keys "ls" Enter
      tmux send-keys "node  ../cli/src/proposer.mjs" Enter
      tmux select-pane -t 2
      tmux send-keys "node ../cli/src/liquidity_provider.mjs" Enter 
      tmux select-pane -t 3
      tmux send-keys "cd test && python3 wallet_test.py server" Enter
      tmux send-keys "touch .done" Enter
      wait_tests_done
    fi
}

wait_tests_done() {
   while true; do
     if [ -f .done ]; then
        break
     fi
     sleep 10
   done

}
wait_app_deployed() {
  app_deployed=$(curl http://selenium:3000 | grep favicon)
  while [ -z "${app_deployed}" ]; do
    sleep 10;
    app_deployed=$(curl http://selenium:3000 | grep favicon)
  done
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
    Xvfb ${DISPLAY} -screen ${screen} ${resolution} &
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
