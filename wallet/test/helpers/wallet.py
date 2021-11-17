from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from .find_elements import *
from .metamask import *

def loginNightfallWallet(driver, findElements, metamaskTab, nightfallTab, walletURL):
    driver.switch_to.window(nightfallTab)
    driver.get(walletURL)
    findElements.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
    sleep(3)

    ## Connect Account to network
    driver.switch_to.window(metamaskTab)
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/popup.html#')
    nextButton = findElements.element_exist_xpath('//button[text()="Next"]') # Select new account
    if nextButton:
        nextButton.click()
        findElements.element_exist_xpath('//button[text()="Connect"]').click() # Connect

    driver.switch_to.window(nightfallTab)
    findElements.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel
    sleep(1)
    findElements.element_exist_xpath('//*[local-name()="svg"]').click() # nightfall Metamask button
    sleep(1)
    findElements.element_exist_xpath('//button[text()="New"]').click() # New Mnemonic
    sleep(1)
    findElements.element_exist_xpath('//button[text()="Submit"]').click() # Submit Mnemonic

def logoutNightfallWallet(driver, findElements, nightfallTab):
    driver.switch_to.window(nightfallTab)
    findElements.element_exist_xpath('//button[text()="Logout"]').click() # Cancel

def submitTxWallet(txParams, findElements, driver, metamaskTab, nightfallTab, cancel=0):
    #TODO - read PL-X and PK-Y when there are deterministic
    findElements.element_exist_xpath('//*[@title="' + txParams['tokenAddress'] + '"]').click() # Select token
    txType = txParams["txType"]
    if txParams["txType"] == "instant-withdraw":
        txType="Withdraw"

    depositButtonEn = findElements.element_exist_xpath('//button[text()="' + txType + '"]') # Deposit
    if depositButtonEn.get_attribute("disabled"):
      findElements.element_exist_xpath('//*[@title="' + txParams['tokenAddress'] + '"]').click() # Select token
    depositButtonEn.click()

    if txParams["tokenType"] != "erc721":
      findElements.element_exist_xpath('//*[@id="amount"]').send_keys(txParams['amount']) # Amount
    findElements.element_exist_xpath('//*[@id="fee"]').send_keys(txParams['fee']) # Fee
    testTokenType = findElements.element_exist_xpath('//*[@id="token-type"]').get_attribute("value") # Read Token Type
    testTokenAddress = findElements.element_exist_xpath('//*[@id="token-address"]').get_attribute("value") # Read Token Address
    assert(testTokenType.lower() == txParams['tokenType'].lower())
    assert(testTokenAddress.lower() == txParams['tokenAddress'].lower())
    if cancel == 1:
      findElements.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel
      return

    findElements.element_exist_xpath('//button[text()="Submit"]').click() # Submit

    ## Sign the transactions
    driver.switch_to.window(metamaskTab)

    stop=0
    if txParams['tokenType'] == "erc20" and txType == "Withdraw":
       stop=0
    # Approve tokens
    signTransactionMetamask(driver, findElements, stop).click() # sign transaction

    # Make deposit, if tokens were already approved, or is eth then it's already done
    #confirmButton = signTransactionMetamask(driver, findElements) # search if transaction pending
    #if confirmButton:
    #  confirmButton.click()

    driver.switch_to.window(nightfallTab)
