from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.test import *

class newTxTest(walletTest):
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(newTxTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, newTxTestsList)



newTxTestsList = [
]
