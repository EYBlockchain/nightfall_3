from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.test import *

class txTest(walletTest):
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(txTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, txTestsList)

def transactionsTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    #tokenTypes = ["erc20", "erc721", "erc1155"]
    # TODO: Waiting for all toke types to be correctly configured. For now, only ERC20 works
    tokenTypes = ["erc20"]
    txTypes = ["Deposit", "Transfer", "Withdraw"]
  
    txParams = {
      "amount": 10,
      "fee": 10,
    }

    for tokenType in tokenTypes:
      txParams["tokenType"] = tokenType
      txParams["tokenAddress"] =  tokens[txParams["tokenType"]]
  
      for txType in txTypes:
        txParams["txType"] = txType
  
        logging.info(tokenType, txType)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab, cancel=1)
        logging.info(tokenType, txType)
        sleep(10)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(10)
        logging.info(tokenType, txType)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(10)
  
      # Instant withdraw


txTestsList = [
  {
    'name': transactionsTest,
    'description' : 'Performs deposit, transfer and withdraw of ERC20, ERC721 and ERC1155 tokens'
  }
]
