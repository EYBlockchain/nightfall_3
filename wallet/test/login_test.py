from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

class loginTest(walletTest):
  """Tests different login scenarios
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(loginTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, loginTestsList)

def logoutTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)

def cancelLoginTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel
  nightfallWalletStartButton = findElementsInstance.element_exist_xpath('//*[local-name()="svg"]') # nightfall Metamask button
  if not nightfallWalletStartButton:
    return "FAILED\n"

def mnemonicTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  mnemonic = []
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  for i in range(10):
    findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
    mnemonic.append(findElementsInstance.element_exist_xpath('//textarea').text)

  if (len(set(mnemonic)) != len(mnemonic)):  
    logging.error("There are repeated mnemonics")
    return "FAILED\n"
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel

def toggleTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]').click() # Enable backup
  findElementsInstance.element_exist_xpath('//div[contains(@class, "ui checked toggle checkbox")]').click() # Disable backup
  findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]').click() # Enable backup
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel

  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  backupToggleDisabled = findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]') # Backup is disabled
  if not backupToggleDisabled:
    logging.error("Backup button is not disabled")
    findElementsInstance.element_exist_xpath('//div[contains(@class, "ui checked toggle checkbox")]').click() # Disable backup
    findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel
    return "FAILED\n"
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel

def initialConditionsTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  mnemonic = findElementsInstance.element_exist_xpath('//textarea').text
  submitButton = findElementsInstance.element_exist_xpath('//button[text()="Submit"]') # Submit button
  backupToggleDisabled = findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]') # Backup is disabled

  fail = False
  if len(mnemonic) > 0:
    logging.error("Initial mnemonic is not empty")
    fail = True

  if submitButton.get_attribute("enabled"):
    logging.error("Submit button is not disabled")
    fail = True

  if not backupToggleDisabled:
    logging.error("Backup button is not disabled")
    findElementsInstance.element_exist_xpath('//div[contains(@class, "ui checked toggle checkbox")]').click() # Disable backup
    fail = True

  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel

  if fail: return "FAILED\n"

def loginNoBackupTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
  findElementsInstance.element_exist_xpath('//button[text()="Submit"]').click() # Submit button
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)

  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
  findElementsInstance.element_exist_xpath('//button[text()="Submit"]').click() # Submit button
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)

def loginBackupCancelTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  sleep(1000)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
  findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]').click() # Enable backup
  findElementsInstance.element_exist_xpath('//button[text()="Submit"]').click() # Submit button
  driver.switch_to.window(metamaskTab)
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel signature
  
  # log back in and check that i am asked mnemonic
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel

def loginBackupTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
  findElementsInstance.element_exist_xpath('//div[contains(@class, "ui toggle checkbox")]').click() # Enable backup
  findElementsInstance.element_exist_xpath('//button[text()="Submit"]').click() # Submit button
  driver.switch_to.window(metamaskTab)
  findElementsInstance.element_exist_xpath('//button[text()="Sign"]').click() # Sign signature

  driver.switch_to.window(nightfallTab)
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  driver.switch_to.window(metamaskTab)
  findElementsInstance.element_exist_xpath('//button[text()="Sign"]').click() # Sign signature
  driver.switch_to.window(nightfallTab)
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)

def clearBackupTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  driver.switch_to.window(metamaskTab)
  findElementsInstance.element_exist_xpath('//button[text()="Sign"]').click() # Sign signature
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//button[text()="Account Settings"]').click() # Account Settings
  findElementsInstance.element_exist_xpath('//label[text()="Clear Local Storage"]').click() # Clear local storage
  logoutNightfallWallet(driver, findElementsInstance, nightfallTab)
  findElementsInstance.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
  findElementsInstance.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
  findElementsInstance.element_exist_xpath('//button[text()="Submit"]').click() # Submit button


loginTestsList = [
  {
    'name': logoutTest,
    'description' : 'Verify that logout works'
  },
  {
    'name': cancelLoginTest,
    'description' : 'Cancel login. Expected result is to go back to login page'
  },
  {
   'name': mnemonicTest,
   'description' : 'Verify that every time we press New button, there is a new mnemonic'
  },
  {
   'name': toggleTest,
   'description' : 'Verify that toggle backup button works. Leave enabled before cancel'
  },
  {
   'name': initialConditionsTest,
   'description' : 'Verify that mnemonic text is empty, and submit button and backup checkbox disabled'
  },
  {
   'name': loginNoBackupTest,
   'description' : 'Login without backup. Then log out, and log back in. Expected result is that you will be prompted the mnemonic'
  },
  {
   'name': loginBackupCancelTest,
   'description' : 'Login selecting backup, but reject option to sign. Expected result is to  be logged out'
  },
  {
   'name': loginBackupTest,
   'description' : 'Login selecting backup, and accept signature. Then log out, and log back in. Expected result is that you need to sign the second time as well'
  },
  {
   'name': clearBackupTest,
   'description' : 'Login selecting backup, and accept signature. Then wipe local storage. Then log out and log back in. Expected result is that you will need to enter the mnemonic again'
  },
]
