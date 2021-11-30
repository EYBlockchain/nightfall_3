# Selenium usage

## Installation guide

### Docker
1. Start wallet-test container
```
./start-nightfall -wt -s
```
This configuration starts a docker container including the wallet at port 3010, a headless version of chrome/chromium driver, metamask plugin and selenium tests.
If you exec into this container (`docker exec -it <WALLET_TEST_CONTAINER_ID> bash), tests are launched under `tmux a -t selenium`.
When tests are finished, you can see either `Selenium tests PASSED` or `Selenium tests FAILED` in the container logs.

#### Debugging Wallet Unit Tests
Launching selenium tests with the docker prevents any debugging if test unexpectedly fail. In order to gain more visibility of what is going on, you need to start a real chrome session (graphic). To do this:
1. Start Chrome docker container
```
./start-nightfall -w -s
```
2. Start vncviewer. You can install vncviewer from [here](https://www.realvnc.com/es/connect/download/viewer/)
```
vncviewer
```
3. Go to 127.0.0.1
Password is `password`

4. Open Chrome
Right click mouse on  `vnc viewer` screen, `Applications -> Network -> Web Browsing -> Google Chrome`

5. Check Nightfall wallet is correctly deployed
On a Chrome tab, go to http://localhost:3010/login

6. Open a terminal on VNC viewer
Right click mouse on `vnc viewer` screen, `Applications -> Shells -> Bash`

7. Launch Selenium tests
```
cd test && pyhon3 wallet_test.py docker
```




### Linux

1. Install python, pip and google chrome
   google chrome:
   - `wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add - `
   - `sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'`
   - `sudo apt-get update`
   - `sudo apt-get install google-chrome-stable`
   python:
   - `sudo apt install python3.8`
   pip:
   - `sudo apt-get -y install python3-pip`
2. Install Selenium python library, in case of a server install `pyvirtualdisplay` python library and `xvfb` too
   - `pip3 install selenium`
   - `sudo apt install -y xvfb`
   - `pip3 install pyvirtualdisplay`
**NOTE**: For MacOS there is no `xvfb` library, so you can skip installing `xvfb` and `pyvirtualdisplay`. The downside is that you will need to run tests in UI mode.
3. Get metamask crx: Change the following URL, updating the VERSION_GOOGLE_CHROME for yours, ( Version can be found searching in the browser chrome://settings/help) and save it as
   `metamask.crx` in the `extensions/` folder
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion={VERSION_GOOGLE_CHROME}&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
   Example with `Version 87.0.4280.66 (Official Build) (64-bit)`
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=87.0.4280.66&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
4. Get your chrome driver of your version here: https://sites.google.com/chromium.org/driver/downloads?authuser=0 and save it as `chromedriver` in the `drivers/` folder
5. Make sure nightfall, proposer and wallet are running:
- Running nightfall: In nightfall's root folder:
```
./setup-nightfall
./start-nightfall -g -s
```
- Running proposer : in nightfall's root folder:
```
./proposer
```
- Running wallet: In wallet's root folder:
```
cd ../cli
npm run build
cd -
npm run start
```
6. Run the script wallet_test.py (see *Usage* section)

### Mac

1. Check you have Python 3.8 and Pip 3 installed (and install Chrome if you don't already have it):
```sh
python3 --version
pip3 --version
```
If necessary upgrade pip3 (Selenium will error if the version you have is too early)
```sh
/Library/Developer/CommandLineTools/usr/bin/python3 -m pip install --upgrade pip
```
2. Install Selenium python library:
```sh
pip3 install selenium
```
3. Get metamask crx: Change the following URL, updating the VERSION_GOOGLE_CHROME for yours, ( Version can be found searching in the browser chrome://settings/help) and save it as
   `metamask.crx` in the `extensions/` folder
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion={VERSION_GOOGLE_CHROME}&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
   Example with `Version 87.0.4280.66 (Official Build) (64-bit)`
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=87.0.4280.66&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
4. Get your chrome driver of your version here: https://sites.google.com/chromium.org/driver/downloads?authuser=0 and save it as `chromedriver` in the `drivers/` folder
5. Give the driver permission to run: `xattr -d com.apple.quarantine chromedriver`
6. Run the script wallet_test.py (see *Usage* section)

## Usage:

Both scripts support server mode or UI mode (which display the browser to the user). Server mode is not relevant for a Mac

- Server mode: `python3 wallet_test.py server localhost`
- UI mode: `python3 wallet_test.py localhost`
