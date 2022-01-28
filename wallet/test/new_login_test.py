from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *

class newLoginTest(walletTest):
  """Tests different login scenarios
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(newLoginTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, newLoginTestsList)


newLoginTestsList = [
]
