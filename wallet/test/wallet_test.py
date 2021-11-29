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

# virtual display
from pyvirtualdisplay import Display

for arg in sys.argv:
    if arg.lower() == "server":
        display = Display(visible=0, size=(1920, 1080))
        display.start()

###################
# Load selenium  #
###################
# Load chrome driver
driver = initializeSelenium()

# Load find elements with the default wait
defualtWaitSeconds = 5
defaultWaitObject = WebDriverWait(driver, defualtWaitSeconds)
findElementsInstance = findElements(defaultWaitObject)

# Identify the current tabs open
nightfallTab=driver.window_handles[1]
metamaskTab=driver.window_handles[0]
driver.switch_to.window(metamaskTab)

###################
# Load Metamask   #
###################
initializeMetamask(driver, findElementsInstance, metamaskConfig)
#deleteNetworkMetamask(driver, findElementsInstance, deleteNetworkConfig)
selectNetworkMetamask(driver, findElementsInstance, networkConfigLocalhost)
addEthAccountMetamask(driver, findElementsInstance, ethAccount1Params)
addEthAccountMetamask(driver, findElementsInstance, ethAccount2Params)

# Add tokens to metamask
#addTokenMetamask("0x4232AF76301fd6c2B144A7A5A7796331B2A43D90", findElementsInstance)

########################
# Log in wallet #
########################
loginNightfallWallet(driver, findElementsInstance, metamaskTab, nightfallTab, walletURL)
testEthAddress = findElementsInstance.element_exist_xpath('//*[@id="wallet-info-cell-ethaddress"]').text
assert(testEthAddress.lower() == ethAccount2Params["ethereumAddress"].lower())

########################
# Start Tests          
########################
sleep(1000)
#effectTest(findElementsInstance, driver, metamaskTab, nightfallTab, walletUrl)
#loginTest(findElementsInstance, driver, metamaskTab, nightfallTab)
#tokenTest(findElementsInstance, driver, metamaskTab, nightfallTab)
#txTest(findElementsInstance, driver, metamaskTab, nightfallTab)

driver.quit()
