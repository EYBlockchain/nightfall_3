from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

testWalletUrl=None

class newEffectTest(walletTest):
  """Tests different effects
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab, walletUrl):
    global testWalletUrl
    testWalletUrl=walletUrl
    super(newEffectTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, newEffectTestsList)

def exampleTest(findElementsInstance, driver, metamaskTab, nightfallTab):
  pass

newEffectTestsList = [
  {
    'name': exampleTest,
    'description' : 'Add description of test',
  },

]
