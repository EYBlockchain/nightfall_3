from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from .find_elements import *
from time import sleep    

def initializeMetamask(driver, findElements, metamaskConfig):
    # Load metamask, check if the account is already set up
    firstTimeButton = findElements.element_exist_xpath('//button[text()="Get Started"]')
    if firstTimeButton:
        #######################
        # Set up the metamask #
        #######################
        firstTimeButton.click()
        findElements.element_exist_xpath('//button[text()="Import wallet"]').click() # Import wallet
        findElements.element_exist_xpath('//button[text()="I Agree"]').click() # Agree terms
        sleep(3)
        findElements.element_exist_xpath('//input[@placeholder="Paste Secret Recovery Phrase from clipboard"]').send_keys(metamaskConfig['mnemonic']) # Seed phrase

        findElements.element_exist_xpath('//*[@id="password"]').send_keys(metamaskConfig['password']) # Password
        findElements.element_exist_xpath('//*[@id="confirm-password"]').send_keys(metamaskConfig['password']) # Repeat password
        findElements.element_exist_xpath('//div[contains(@class, "first-time-flow__checkbox first-time-flow__terms")]').click() # Read agreements ( for sure)
        findElements.element_exist_xpath('//button[text()="Import"]').click() # Read agreements ( for sure)
        findElements.element_exist_xpath('//button[text()="All Done"]').click() # All Done button


        # Accept all the emerging popups of the first metamask login
        driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')
        while True:
            popupMetamask = findElements.element_exist_xpath('//button[@class="fas fa-times popover-header__button"]')
            if popupMetamask:
                popupMetamask.click()
                driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')
                popupMetamask = findElements.element_exist_xpath('//button[@class="fas fa-times popover-header__button"]')
            else:
                break
    else:
        #######################
        #    Login metamask   #
        #######################
        passwordElement = WebDriverWait(driver, 1000).until(
            EC.presence_of_element_located((By.ID, "password"))
        )
        passwordElement.send_keys(metamaskConfig['password'])
        clickElement = driver.find_element_by_class_name("MuiButton-label")
        clickElement.click()


def selectNetworkMetamask(driver, findElements, networkConfig):
    # Configure network
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')

    # Select network
    findElements.element_exist_xpath('//*[@id="app-content"]/div/div[1]/div/div[2]/div[1]/div/span').click() # Select network
    # Find network
    networkElement = findElements.element_exist_xpath('(//*[contains(text(), "' + networkConfig['name'] + '")] | //*[@value="' + networkConfig['name'] + '"])')
    if not networkElement:
      findElements.element_exist_xpath('//button[text()="Add Network"]').click()  # Add Network
      #findElements.element_exist_xpath('(//*[contains(text(), "' + networkConfig['type'] + '")])').click()
      findElements.element_exist_xpath('(//*[contains(@class, "form-field__input")])[1]').send_keys(networkConfig['name'])
      findElements.element_exist_xpath('(//*[contains(@class, "form-field__input")])[2]').send_keys(networkConfig['url'])
      findElements.element_exist_xpath('(//*[contains(@class, "form-field__input")])[3]').send_keys(networkConfig['chainId'])
      #findElements.element_exist_xpath('//input[@id="network-name"]').send_keys(networkConfig['name']) # Name
      #findElements.element_exist_xpath('//input[@id="rpc-url"]').send_keys(networkConfig['url']) # URL
      #findElements.element_exist_xpath('//input[@id="chainId"]').send_keys(networkConfig['chainId']) # ChainId
      #findElements.element_exist_xpath('//input[@id="network-ticker"]').send_keys(networkConfig['ticker']) # ChainId
      findElements.element_exist_xpath('//button[text()="Save"]').click() # Save
    else:
      findElements.element_exist_xpath('(//*[contains(text(), "' + networkConfig['name'] + '")])').click()

def selectTestNetworkMetamask(driver, findElements, networkConfig):
    # Configure network
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')

    # Select network
    findElements.element_exist_xpath('//*[@id="app-content"]/div/div[1]/div/div[2]/div[1]/div/span').click() # Select network
    # Find network
    networkElement = findElements.element_exist_xpath('(//*[contains(text(), "' + networkConfig['name'] + '")] | //*[@value="' + networkConfig['name'] + '"])')
    try:
       networkElement.click()
    except Exception:
        findElements.element_exist_xpath('//*[contains(@class, "network-dropdown-content--link")]').click() # Show networks
        findElements.element_exist_xpath('//*[@id="app-content"]/div/div[3]/div/div[2]/div[2]/div[2]/div[7]/div[2]/div/div/div[1]/div[2]').click() # Enable test networks
        findElements.element_exist_xpath('//*[contains(@class, "settings-page__close-button")]').click() # Save
        findElements.element_exist_xpath('//*[@id="app-content"]/div/div[1]/div/div[2]/div[1]/div/span').click() # Select network
        findElements.element_exist_xpath('//*[contains(text(), "' + networkConfig['name'] + '")]').click()

def deleteNetworkMetamask(driver, findElements, networkConfig):
    # Configure network
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')

    # Select network
    findElements.element_exist_xpath('//*[local-name()="svg"]').click() # Color button 
    findElements.element_exist_xpath('//div[contains(text(),"Settings")]').click() # Settings
    findElements.element_exist_xpath('//div[contains(text(),"Networks")]').click() # Network
    networkToDelete = findElements.element_exist_xpath('//div[contains(text(), "' + networkConfig['name'] + '")]')

    if networkToDelete:
      networkToDelete.click()
      findElements.element_exist_xpath('//button[text()="Delete"]').click() # Delete
      findElements.element_exist_xpath('//button[text()="Delete"]').click() # Delete

    findElements.element_exist_xpath('//div[contains(@class, "close-button")]').click() # Close

def addEthAccountMetamask(driver, findElements, accountParams):
    # Configure network
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')

    # Select network
    findElements.element_exist_xpath('//*[local-name()="svg"]').click() # Color button 
    findElements.element_exist_xpath('//div[contains(text(),"Import Account")]').click() # Import account
    findElements.element_exist_xpath('//input[@id="private-key-box"]').send_keys(accountParams['privateKey']) # Private Key
    findElements.element_exist_xpath('//button[text()="Import"]').click() # Import

def selectEthAccountMetamask(driver, findElements, accountParams):
    # Configure network
    driver.get('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#')

    # Select network
    findElements.element_exist_xpath('//*[local-name()="svg"]').click() # Color button 
    findElements.element_exist_xpath('//div[contains(text(), "' + accountParams['name'] + '")]').click()

def addTokenMetamask(tokenAddress, findElements):
    # Add DAI token
    findElements.element_exist_xpath('//button[@class="button btn-secondary btn--rounded add-token-button__button"]').click() # Add token button
    findElements.element_exist_xpath('//*[@id="custom-address"]').send_keys(tokenAddress) # Address textbox

    # Check if the token is already added
    isTokenAdded = findElements.element_exist_xpath("//*[contains(text(), 'Token has already been added')]")
    if not isTokenAdded:
        findElements.element_exist_xpath('//*[@id="app-content"]/div/div[4]/div/div[2]/div[2]/footer/button[2]').click() # Next
        findElements.button_clickable_xpath('//*[@id="app-content"]/div/div[4]/div/div[3]/footer/button[2]').click() # Add Token


def signTransactionMetamask(driver, findElements, stop=0):
    sleep(5)
    activityButton = findElements.element_exist_xpath('//button[text()="Activity"]')
    if activityButton:
         activityButton.click()

    while True:
      sleep(4)
      pendingTx = findElements.element_exist_xpath('//div[contains(@class, "list-item transaction-list-item transaction-list-item--unconfirmed")]')
      approve = findElements.element_exist_xpath('//button[text()="Confirm"]') # Confirm approve
      if pendingTx:
        pendingTx.click()
      elif approve:
          approve.click()
      else:
        break
