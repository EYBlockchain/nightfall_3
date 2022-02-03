from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.test import *

class newTxTest(walletTest):
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(newTxTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, newTxTestsList)


  
def transactionsTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    txTypes = ["Deposit", "Transfer", "Withdraw"]
  
    tokens = [
     {
      'tokenName': 'MATIC',
      'tokenType': 'erc20',
     }
    ]

    txParams = {
      "amount": 1.0,
      "fee": 10,
      "instantWithdrawFee": 1000,
      "erc1155Id": '0',
      "transferMode": "On-Chain",
    }

    sleep(10)
    for token in tokens:
      txParams["tokenType"] = token["tokenType"]
      txParams["tokenName"] = token["tokenName"]
  
      for txType in txTypes:
        txParams["txType"] = txType

        if txParams["txType"] == "Instant-withdraw" and txParams["tokenType"] != "erc20":
          continue

        l2Balance = getNewNightfallBalance(findElementsInstance, txParams)
        print(txType, token["tokenType"], l2Balance)
        logging.info(token["tokenType"], txType)
        print("Cancel")
        submitTxNewWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab, cancel=1)
        logging.info(token["tokenType"], txType)
        sleep(10)
        print("Tx")
        submitTxNewWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(15)
        logging.info(token["tokenType"], txType)
        print("Tx")
        submitTxNewWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        status, errorMsg = waitBalanceChange(l2Balance, txParams, 2, findElementsInstance)
        if status == 0:
          return errorMsg
        sleep(15)

def waitBalanceChange(l2Balance, txParams, nTx, findElementsInstance):
  niter=0
  while True:
    sleep(5)
    if niter == 15:
      errorMsg = "FAILED - waited too long\n"
      return 0, errorMsg
    sleep(1) 
    l2BalanceNew = getNewNightfallBalance(findElementsInstance, txParams)
    print(txParams["txType"], txParams["tokenType"],l2BalanceNew)
    if txParams["txType"] == "Deposit":
      print("Match", l2BalanceNew - Decimal(nTx*txParams["amount"]), l2Balance) 
      if l2BalanceNew - Decimal(nTx*txParams["amount"]) == l2Balance: 
        break
    elif txParams["txType"] == "Transfer":
      print("Match",l2BalanceNew, l2Balance)
      if l2BalanceNew == l2Balance:
        break
    elif txParams["txType"] == "Withdraw":
       #if l1BalanceNew != l1Balance:
        #return "FAILED - Balances do not match after withdraw\n"
       print("Match",l2BalanceNew + nTx*txParams["amount"],l2Balance)
       if l2BalanceNew + nTx*txParams["amount"] == l2Balance:
         break
    elif txParams["txType"] == "Instant-withdraw":
      print("Match", l2BalanceNew ,l2Balance)
      if l2BalanceNew == l2Balance: 
       break
    niter+=1
  return 1,""

newTxTestsList = [
  {
    'name': transactionsTest,
    'description' : 'Performs deposit, transfer withdraw and instant withdraw of ERC20, ERC721 and ERC1155 tokens and check balances'
  },
]
