from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

testWalletUrl=None

class effectTest(walletTest):
  """Tests different effects
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab, walletUrl):
    global testWalletUrl
    testWalletUrl=walletUrl
    super(effectTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, effectTestsList)

def reloadTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    driver.switch_to.window(nightfallTab)
    driver.refresh()
    nightfallWalletStartButton = findElementsInstance.element_exist_xpath('//*[local-name()="svg"]') # nightfall Metamask button
    if not nightfallWalletStartButton:
      return "FAILED"
    return localhostTest(findElementsInstance, driver, metamaskTab, nightfallTab)

def localhostTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    driver.switch_to.window(metamaskTab)
    selectNetworkMetamask(driver, findElementsInstance, networkConfigLocalhost)
    loginNightfallWallet(driver, findElementsInstance, metamaskTab, nightfallTab, testWalletUrl)
    testEthAddress = findElementsInstance.element_exist_xpath('//*[@id="wallet-info-cell-ethaddress"]').text
    if testEthAddress.lower() != ethAccount2Params["ethereumAddress"].lower():
      return "FAILED"

def ropstenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    driver.switch_to.window(metamaskTab)
    selectNetworkMetamask(driver, findElementsInstance, networkConfigRopsten)
    driver.switch_to.window(nightfallTab)
    nightfallWalletStartButton = findElementsInstance.element_exist_xpath('//*[local-name()="svg"]') # nightfall Metamask button
    if not nightfallWalletStartButton:
      return "FAILED"
    return localhostTest(findElementsInstance, driver, metamaskTab, nightfallTab)

def changeAccountTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    driver.switch_to.window(metamaskTab)
    selectEthAccountMetamask(driver, findElementsInstance, ethAccount1Params)
    driver.switch_to.window(nightfallTab)
    nightfallWalletStartButton = findElementsInstance.element_exist_xpath('//*[local-name()="svg"]') # nightfall Metamask button
    if not nightfallWalletStartButton:
      return "FAILED"
    driver.switch_to.window(metamaskTab)
    selectEthAccountMetamask(driver, findElementsInstance, ethAccount2Params)
    driver.switch_to.window(nightfallTab)
    return localhostTest(findElementsInstance, driver, metamaskTab, nightfallTab)

effectTestsList = [
  {
    'name': reloadTest,
    'description' : 'After reloading the wallet page, expected results is to be logged out'
  },
  #{
    #'name': ropstenTest,
    #'description' : 'Wallet expects to work on localhost, but we use Ropsten. Expected result is to be logged out'
  #},
  #{
    #'name': changeAccountTest,
    #'description' : 'Wallet expects to work on same Eth account. When we change account, the expected result is to be logged out'
  #},
]
