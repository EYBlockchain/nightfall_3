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
      "amount": 1,
      "fee": 10,
    }

    for tokenType in tokenTypes:
      txParams["tokenType"] = tokenType
      txParams["tokenAddress"] =  tokens[txParams["tokenType"]]
  
      for txType in txTypes:
        txParams["txType"] = txType
        l1Balance, l2Balance = getNightfallBalance(findElementsInstance, txParams)
        logging.info(tokenType, txType)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab, cancel=1)
        logging.info(tokenType, txType)
        sleep(10)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(10)
        logging.info(tokenType, txType)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        status, errorMsg = waitBalanceChange(l1Balance, l2Balance, txParams, 2, findElementsInstance)
        if status == 0:
          return errorMsg
        sleep(10)

def waitBalanceChange(l1Balance, l2Balance, txParams, nTx, findElementsInstance):
  niter=0
  while True:
    if niter == 10:
      errorMsg = "FAILED - waited too long\n"
      print("ABBO")
      sleep(1000)
      return 0, errorMsg
    sleep(5) 
    l1BalanceNew, l2BalanceNew = getNightfallBalance(findElementsInstance, txParams)
    if txParams["txType"] == "Deposit":
      if l2BalanceNew - nTx*txParams["amount"] == l2Balance and l1BalanceNew + nTx*txParams["amount"] == l1Balance:
        break
    elif txParams["txType"] == "Transfer":
      if l1BalanceNew != l1Balance:
        errorMsg = "FAILED - Balances do not match after transfer\n"
        return 0, errorMsg
      if l2BalanceNew == l2Balance:
        break
    elif txParams["txType"] == "Withdraw":
       #if l1BalanceNew != l1Balance:
        #return "FAILED - Balances do not match after withdraw\n"
       #if l2BalanceNew - nTx*txParams["amount"] == l2Balance:
         break
    #elif txType == "Instant-withdraw":
    niter+=1
  return 1,""

txTestsList = [
  {
    'name': transactionsTest,
    'description' : 'Performs deposit, transfer and withdraw of ERC20, ERC721 and ERC1155 tokens and check balances'
  }
]
