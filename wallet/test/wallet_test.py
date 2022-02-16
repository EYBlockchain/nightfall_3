from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from selenium.common.exceptions import TimeoutException
import sys
from time import sleep

from helpers.find_elements import *
from helpers.selenium import *
from helpers.metamask import *
from helpers.wallet import *
from constants import *

# import tests
from tx_test import *
from effect_test import *
from login_test import *
from token_test import *
from new_tx_test import *
from new_effect_test import *
from new_login_test import *
from new_token_test import *

# virtual display
from pyvirtualdisplay import Display

testEnvironment="localhost"
testToRun = { 
    'all': True,   # Run all tests
    'new': True,  # Run new wallet tests
    'old': False,   # Run old wallet tests
    'effects': False,
    'tokens': False,
    'tx': False,
    'login': False,
}
for arg in sys.argv:
    if arg.lower() == "server":
        display = Display(visible=0, size=(1920, 1080))
        display.start()
    if arg.lower() == "docker":
        testEnvironment="docker"
    if arg.lower() == "ropsten":
        testEnvironment="ropsten"
    if arg.lower() == "new-wallet":
       testToRun['new'] = True
       testToRun['old'] = False 
    if arg.lower() == "old-wallet":
       testToRun['new'] = False 
       testToRun['old'] = True
    if arg.lower() == "effects":
        testToRun['effects'] = True
        testToRun['all'] = False
    if arg.lower() == "tokens":
        testToRun['tokens'] = True
        testToRun['all'] = False
    if arg.lower() == "tx":
        testToRun['tx'] = True
        testToRun['all'] = False
    if arg.lower() == "login":
        testToRun['tokens'] = True
        testToRun['all'] = False

#####################
# Declare variables #
#####################
driver=None
findElementsInstance=None
nightfallTab=None
metamaskTab=None
networkConfig = networkConfigLocalhost
walletUrl = walletUrlLocalhost

try:
  ###################
  # Load selenium  #
  ###################
  # Load chrome driver
  driver = initializeSelenium()
  
  # Load find elements with the default wait
  defaultWaitSeconds = 5
  defaultWaitObject = WebDriverWait(driver, defaultWaitSeconds)
  findElementsInstance = findElements(defaultWaitObject)
  
  # Identify the current tabs open
  nightfallTab=driver.window_handles[1]
  metamaskTab=driver.window_handles[0]
  driver.switch_to.window(metamaskTab)
  
  # Configure variables depending on test environment
  if testEnvironment == "docker":
      networkConfig = networkConfigDocker
      walletUrl = walletUrlDocker
  elif testEnvironment == "ropsten":
      networkConfig = networkConfigRopsten
      walletUrl = walletUrlRopsten
     

  ###################
  # Load Metamask   #
  ###################
  driver.switch_to.window(metamaskTab)
  initializeMetamask(driver, findElementsInstance, metamaskConfig)
  #deleteNetworkMetamask(driver, findElementsInstance, deleteNetworkConfig)
  #selectTestNetworkMetamask(driver, findElementsInstance, networkConfigRopsten)
  selectNetworkMetamask(driver, findElementsInstance, networkConfig)
  #addEthAccountMetamask(driver, findElementsInstance, ethAccount1Params)
  addEthAccountMetamask(driver, findElementsInstance, ethAccount2Params)
  
  # Add tokens to metamask
  #addTokenMetamask("0x4232AF76301fd6c2B144A7A5A7796331B2A43D90", findElementsInstance)
  ########################
  # Log in wallet #
  ########################
  if testToRun['old']:
    loginNightfallWallet(driver, findElementsInstance, metamaskTab, nightfallTab, walletUrl)
    testEthAddress = findElementsInstance.element_exist_xpath('//*[@id="wallet-info-cell-ethaddress"]').text
    assert(testEthAddress.lower() == ethAccount2Params["ethereumAddress"].lower())
  else:
    # TODO Add login mechanism to new wallet
    loginNewNightfallWallet(driver, findElementsInstance, metamaskTab, nightfallTab, walletUrl)
  skipTest=False
except Exception as e:
  print("FAILED", e)
  skipTest=True
  
########################
# Start Tests          
########################
if not skipTest:
  if testToRun['all'] or testToRun['effects']:
    if testToRun['old']:
      effectTest(findElementsInstance, driver, metamaskTab, nightfallTab, walletUrl)
    else:
      newEffectTest(findElementsInstance, driver, metamaskTab, nightfallTab, walletUrl)
  if testToRun['all'] or testToRun['login']:
    if testToRun['old']:
      loginTest(findElementsInstance, driver, metamaskTab, nightfallTab)
    else:
      newLoginTest(findElementsInstance, driver, metamaskTab, nightfallTab)
  if testToRun['all'] or testToRun['tokens']:
    if testToRun['old']:
      tokenTest(findElementsInstance, driver, metamaskTab, nightfallTab)
    else:
      newTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab)
  if testToRun['all'] or testToRun['tx']:
    if testToRun['old']:
      txTest(findElementsInstance, driver, metamaskTab, nightfallTab)
    else:
      newTxTest(findElementsInstance, driver, metamaskTab, nightfallTab)

if driver is not None:
  driver.quit()
