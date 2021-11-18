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
    'tokenAddress' : '0xe1b7B854F19A2CEBF96B433ba30050D8890618ab',
  },
  {
    'tokenName' : 'Token2',
    'tokenType' : 'ERC721',
    'tokenAddress' : '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
  {
    'tokenName' : 'Token3',
    'tokenType' : 'ERC1155',
    'tokenAddress' : '0xb5acbe9a0f1f8b98f3fc04471f7fe5d2c222cb44'
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
  addTokenNightfallWallet(driver, findElementsInstance, TokenListNoContract[0])
  removeTokenNightfallWallet(driver, findElementsInstance, TokenListNoContract[0])
  addTokenNightfallWallet(driver, findElementsInstance, TokenListNoContract[1])
  removeTokenNightfallWallet(driver, findElementsInstance, TokenListNoContract[0])

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
    addTokenNightfallWallet(driver, findElementsInstance, token)
    try: 
      removeTokenNightfallWallet(driver, findElementsInstance, token)
      return "FAILED\n"
    except Exception:
      pass


def addNoContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  for token in TokenListNoContract:
    addTokenNightfallWallet(driver, findElementsInstance, token)
    try: 
      removeTokenNightfallWallet(driver, findElementsInstance, token)
      return "FAILED\n"
    except Exception:
      pass


def addNoERCContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addDuplicateByAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  for token in TokenListNoContract:
    if not token['tokenAddress'].startswith('0x'):
      token['tokenAddress'] = '0x' + token['tokenAddress']
    addTokenNightfallWallet(driver, findElementsInstance, token)
    addTokenNightfallWallet(driver, findElementsInstance, token)
    addedToken = findElementsInstance.element_exist_xpath('//*[@title="' + token['tokenAddress'].lower() + '"]')
    if isinstance(addedToken, list):
      return "FAILED\n"
    removeTokenNightfallWallet(driver, findElementsInstance, token)


def addDuplicateByNameTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  driver.switch_to.window(nightfallTab)
  duplicateTokenListNoContract = TokenListNoContract.copy() 
  for token1, token2 in zip(TokenListNoContract, duplicateTokenListNoContract):
    if not token1['tokenAddress'].startswith('0x'):
      token1['tokenAddress'] = '0x' + token1['tokenAddress']
      token2['tokenAddress'] = '0x' + token2['tokenAddress']
    addTokenNightfallWallet(driver, findElementsInstance, token1)
    token2['tokenAddress'] = '0x0000000000000000000000000000000000000000'
    addTokenNightfallWallet(driver, findElementsInstance, token2)
    addedToken1 = findElementsInstance.element_exist_xpath('//*[@title="' + token1['tokenAddress'].lower() + '"]')
    addedToken2 = findElementsInstance.element_exist_xpath('//*[@title="' + token2['tokenAddress'].lower() + '"]')
    if addedToken1 and addedToken2:
      removeTokenNightfallWallet(driver, findElementsInstance, token1)
      removeTokenNightfallWallet(driver, findElementsInstance, token2)
      return "FAILED\n"

tokenTestsList = [
  {
    'name': addTokenCancelTest,
    'description' : 'Add tokens and cancel'
  },
  {
    'name': addTokensTest,
    'description' : 'Add and remove N tokens and check they are added and removed correctly (contract address may not start by 0x)'
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
  {
    'name': addNoERCContractAddressTokenTest,
    'description' : 'Add invalid token => not ERC20, ERC721 or ERC1155 contract address. Tokens should not be added'
  },
  {
    'name': addDuplicateByAddressTokenTest,
    'description' : 'Add duplicate token (same address) test. Tokens should not be added'
  },
  {
    'name': addDuplicateByNameTokenTest,
    'description' : 'Add duplicate token (same name) test. Tokens should not be added'
  },
]
