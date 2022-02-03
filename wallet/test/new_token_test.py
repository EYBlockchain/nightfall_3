from time import sleep
import logging    
import random

from constants import *
from helpers.wallet import *
from helpers.metamask import *
from helpers.test import *


class newTokenTest(walletTest):
  """Tests different token addition and removal scenarios
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(newTokenTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, newTokenTestsList)


newTokenTestsList = [
]
