from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

TokenListNoAddress = [
  { 
    'tokenName' : 'Token1',
    'tokenType' : 'ERC20',
    'tokenAddress' : '0xbfg1234s',
  },
  {
    'tokenName' : 'Token2',
    'tokenType' : 'ERC721',
    'tokenAddress' :'0x000000000000000000000000000000000000000r',
  },
  {
    'tokenName' : 'Token3',
    'tokenType' : 'ERC1155',
    'tokenAddress' :'0x123456781234567812343',
  },
  {
    'tokenName' : 'Token4',
    'tokenType' : 'ERC20',
    'tokenAddress' :'1231231231231231231231231231231231231231'
  }
]

TokenListNoContract = [
  {
    'tokenName' : 'Token1',
    'tokenType' : 'ERC20',
    'tokenAddress' : '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
  },
  {
    'tokenName' : 'Token1',
    'tokenType' : 'ERC20',
    'tokenAddress' : '9C8B2276D490141Ae1440Da660E470E7C0349C63',
  },
  {
    'tokenName' : 'Token2',
    'tokenType' : 'ERC721',
    'tokenAddress' : '0xfeEDA3882Dd44aeb394caEEf941386E7ed88e0E0',
  },
  {
    'tokenName' : 'Token3',
    'tokenType' : 'ERC1155',
    'tokenAddress' : '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
  },
]

TokenListERCContract = [
  {
    'tokenName' : 'Token1',
    'tokenType' : 'ERC20',
    'tokenAddress' : '0xb5acbe9a0f1f8b98f3fc04471f7fe5d2c222cb44',
  },
  {
    'tokenName' : 'Token2',
    'tokenType' : 'ERC721',
    'tokenAddress' : '0x103ac4b398bca487df8b27fd484549e33c234b0d',
  },
  {
    'tokenName' : 'Token3',
    'tokenType' : 'ERC1155',
    'tokenAddress' : '0x9635c600697587dd8e603120ed0e76cc3a9efe4c'
  }
]

class tokenTest(walletTest):
  """Tests different token addition and removal scenarios
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(tokenTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, tokenTestsList)

def addTokenCancelTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  findElementsInstance.element_exist_xpath('//button[text()="Add Token"]').click() # Add tokens 
  findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel signature
  addTokenButton = findElementsInstance.element_exist_xpath('//button[text()="Add Token"]') 
  if not addTokenButton:
    return "FAILED\n"

def addTokensTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  removeTokenNightfallWallet(driver, findElementsInstance, TokenListERCContract[0])
  addAndCheckTokenNightfallWallet(driver, findElementsInstance, TokenListERCContract[0])
  removeTokenNightfallWallet(driver, findElementsInstance, TokenListERCContract[1])
  addAndCheckTokenNightfallWallet(driver, findElementsInstance, TokenListERCContract[1])

def removeInexistentTokensTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  try: 
    removeTokenNightfallWallet(driver, findElementsInstance, TokenListNoContract[0])
    return "FAILED\n"
  except Exception:
    findElementsInstance.element_exist_xpath('//button[@id="wallet-info-cell-remove-token"]').click() # Remove Token
    return "PASSED\n"
  
def addNoAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  for token in TokenListNoAddress:
    try:
      addTokenNightfallWallet(driver, findElementsInstance, token)
      return "FAILED\n"
    except Exception:
      findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel 
      pass


def addNoContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  for token in TokenListNoContract:
    try: 
      addTokenNightfallWallet(driver, findElementsInstance, token)
      return "FAILED\n"
    except Exception:
      findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel 
      pass


def addNoERCContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addDuplicateByAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  try:
    for token in TokenListERCContract:
      addTokenNightfallWallet(driver, findElementsInstance, token)
      removeTokenNightfallWallet(driver, findElementsInstance, token)
      return "FAILED\n"
  except Exception:
    findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel 
    pass


def addDuplicateByNameTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  duplicateTokenListERCContract = TokenListERCContract.copy() 
  token1 = TokenListERCContract[0]
  token2 = duplicateTokenListERCContract[1]
  token2['tokenAddress'] = token1['tokenAddress']
  removeTokenNightfallWallet(driver, findElementsInstance, token1)
  try:
    addTokenNightfallWallet(driver, findElementsInstance, token2)
    return "FAILED\n"
  except Exception:
    findElementsInstance.element_exist_xpath('//button[text()="Cancel"]').click() # Cancel 
    addTokenNightfallWallet(driver, findElementsInstance, token1)
    pass

tokenTestsList = [
  {
    'name': addTokenCancelTest,
    'description' : 'Add tokens and cancel'
  },
  {
    'name': addTokensTest,
    'description' : 'Add and remove N tokens and check they are added and removed correctly'
  },
  {
    'name': removeInexistentTokensTest,
    'description' : 'Remove token that does not exist'
  },
  {
    'name': addNoAddressTokenTest,
    'description' : 'Add invalid token => not an Ethereum address. Tokens should not be added'
  },
  {
    'name': addNoContractAddressTokenTest,
    'description' : 'Add invalid token => not a contract address. Tokens should not be added'
  },
  #{
    #'name': addNoERCContractAddressTokenTest,
    #'description' : 'Add invalid token => not ERC20, ERC721 or ERC1155 contract address. Tokens should not be added'
  #},
  {
    'name': addDuplicateByAddressTokenTest,
    'description' : 'Add duplicate token (same address) test. Tokens should not be added'
  },
  {
    'name': addDuplicateByNameTokenTest,
    'description' : 'Add duplicate token (same name) test. Tokens should not be added'
  },
]
