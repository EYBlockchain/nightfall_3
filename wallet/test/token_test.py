from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

class tokenTest(walletTest):
  """Tests different token addition and removal scenarios
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(tokenTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, tokenTestsList)

def addTokensTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def removeTokensTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def removeInexistentTokensTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addNoAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addNoContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addNoERCContractAddressTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

def addDuplicateTokenTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  return "NOT IMPLEMENTED\n"

tokenTestsList = [
  {
    'name': addTokensTest,
    'description' : 'Add N tokens and check they are added correctly'
  },
  {
    'name': removeTokensTest,
    'description' : 'Remove N tokens and check they are added correctly'
  },
  {
    'name': removeInexistentTokensTest,
    'description' : 'Remove token that does not exist'
  },
  {
    'name': addNoAddressTokenTest,
    'description' : 'Add invalid token => not an Ethereum address'
  },
  {
    'name': addNoContractAddressTokenTest,
    'description' : 'Add invalid token => not contract address'
  },
  {
    'name': addNoERCContractAddressTokenTest,
    'description' : 'Add invalid token => not ERC20, ERC721 or ERC1155 contract address'
  },
  {
    'name': addDuplicateTokenTest,
    'description' : 'Add duplicate token test'
  },
]
