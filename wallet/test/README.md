# Selenium usage

## Installation guide

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
3. Get metamask crx: Change the following URL, updating the VERSION_GOOGLE_CHROME for yours, ( Version can be found searching in the browser chrome://settings/help) and save it as
   `metamask.crx` in the `extensions/` folder
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion={VERSION_GOOGLE_CHROME}&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
   Example with `Version 87.0.4280.66 (Official Build) (64-bit)`
   `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=87.0.4280.66&acceptformat=crx2,crx3&x=id%3Dnkbihfbeogaeaoehlefnkodbefgpgknn%26uc`
4. Get your chrome driver of your version here: https://sites.google.com/chromium.org/driver/downloads?authuser=0 and save it as `chromedriver` in the `drivers/` folder
5. Run the script wallet_test.py

## Usage:

Both scripts support server mode or UI mode (wich display the browser to the user)

- Server mode: `python3 wallet_test.py server` 
- UI mode: `python3 wallet_test` 
