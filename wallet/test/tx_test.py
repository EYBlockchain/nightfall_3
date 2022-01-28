from time import sleep
import logging    

from constants import *
from helpers.wallet import *
from helpers.test import *

class txTest(walletTest):
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab):
    super(txTest, self).__init__(findElementsInstance, driver, metamaskTab, nightfallTab, txTestsList)

def emptyWithdrawTest(findElementsInstance, driver, metamaskTab, nightfallTab):
   findElementsInstance.element_exist_xpath('//button[text()="Withdrawal Information"]').click() # Withdrawal information
   withdrawAvail = findElementsInstance.element_exist_xpath('//div[contains(@class, "ui info message")]') # no wihtrdraw message
   if not withdrawAvail:
     return "FAILED\n"
   findElementsInstance.element_exist_xpath('//button[text()="Close"]').click() # Close


def transactionsTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    tokenTypes = ["erc20", "erc1155"]
    txTypes = ["Deposit", "Transfer", "Withdraw", "Instant-withdraw"]
  
    txParams = {
      "amount": 1,
      "fee": 10,
      "instantWithdrawFee": 1000,
      "erc1155Id": '0'
    }

    txTestParams = {
      "tokenAddress": tokens['erc20'],
    }

    # Get Compressed PKD
    findElementsInstance.element_exist_xpath('//button[text()="Account Settings"]').click() # Account Settings
    txParams["compressedPkd"] = findElementsInstance.element_exist_xpath('//input[@type="text"]').get_attribute("value") # read compressed Pkd
    findElementsInstance.element_exist_xpath('//button[text()="Save"]').click() # Save
    txParams["ethereumAddress"] = findElementsInstance.element_exist_xpath('//*[@id="wallet-info-cell-ethaddress"]').text
    tokenRefresh(txTestParams,findElementsInstance)
    sleep(10)
    for tokenType in tokenTypes:
      txParams["tokenType"] = tokenType
      txParams["tokenAddress"] =  tokens[txParams["tokenType"]]
  
      for txType in txTypes:
        txParams["txType"] = txType
        #If token is erc721 or erc1155 and we request and instant withdraw, skip as it is not possible
        if txParams["txType"] == "Instant-withdraw" and txParams["tokenType"] != "erc20":
          continue
        if txParams["tokenType"] == "erc1155":
          #Ensure erc1155 menu is displayed
          erc1155Token = findElementsInstance.element_exist_xpath('//*[@id="token type' + txParams['tokenAddress'].lower() + txParams['erc1155Id'] +'"]') # Find subtoken
          if not erc1155Token:
            findElementsInstance.element_exist_xpath('//*[@title="' + txParams['tokenAddress'].lower() + '"]').click() # Select token

        l1Balance, l2Balance, pendingDeposit, pendingTransferredOut = getNightfallBalance(findElementsInstance, txParams)
        print(txType, tokenType, l1Balance, l2Balance, pendingDeposit, pendingTransferredOut)
        logging.info(tokenType, txType)
        print("Cancel")
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab, cancel=1)
        logging.info(tokenType, txType)
        sleep(10)
        print("Tx")
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(15)
        logging.info(tokenType, txType)
        print("Tx")
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        status, errorMsg = waitBalanceChange(l1Balance, l2Balance, txParams, 2, findElementsInstance)
        if status == 0:
          return errorMsg
        sleep(15)

def transactionsErrorTest(findElementsInstance, driver, metamaskTab, nightfallTab):
    #tokenTypes = ["erc20", "erc721", "erc1155"]
    # TODO: Waiting for all toke types to be correctly configured. For now, only ERC20 amd ERC721 works
    tokenTypes = ["erc20"]
    txTypes = ["Deposit", "Transfer", "Withdraw"]
  
    txParams = {
      "amount": 10000000,
      "fee": 10,
      "instantWithdrawFee": 1000,
    }

    # Get Compressed PKD
    findElementsInstance.element_exist_xpath('//button[text()="Account Settings"]').click() # Account Settings
    txParams["compressedPkd"] = findElementsInstance.element_exist_xpath('//input[@type="text"]').get_attribute("value") # read compressed Pkd
    findElementsInstance.element_exist_xpath('//button[text()="Save"]').click() # Save
    txParams["ethereumAddress"] = findElementsInstance.element_exist_xpath('//*[@id="wallet-info-cell-ethaddress"]').text

    for tokenType in tokenTypes:
      txParams["tokenType"] = tokenType
      txParams["tokenAddress"] =  tokens[txParams["tokenType"]]
  
      for txType in txTypes:
        txParams["txType"] = txType
        #If token is erc721 and we request and instant withdraw, skip as it is not possible
        if txParams["txType"] == "Instant-withdraw" and txParams["tokenType"] == "erc721":
          continue
        l1Balance, l2Balance, pendingDeposit, pendingTransferredOut = getNightfallBalance(findElementsInstance, txParams)
        logging.info(tokenType, txType)
        submitTxWallet(txParams, findElementsInstance, driver, metamaskTab, nightfallTab)
        sleep(10)

def waitBalanceChange(l1Balance, l2Balance, txParams, nTx, findElementsInstance):
  niter=0
  txTestParams = {
    "tokenAddress": tokens['erc20'],
  }
  while True:
    sleep(5)
    tokenRefresh(txTestParams,findElementsInstance)
    if niter == 15:
      errorMsg = "FAILED - waited too long\n"
      return 0, errorMsg
    sleep(1) 
    l1BalanceNew, l2BalanceNew, pendingDepositNew, pendingTransferredOutNew = getNightfallBalance(findElementsInstance, txParams)
    print(txParams["txType"], txParams["tokenType"],l1BalanceNew, l2BalanceNew, pendingDepositNew, pendingTransferredOutNew)
    if txParams["txType"] == "Deposit":
      print("Match", l2BalanceNew - nTx*txParams["amount"], l2Balance , l1BalanceNew + nTx*txParams["amount"], l1Balance)
      if l2BalanceNew - nTx*txParams["amount"] == l2Balance and l1BalanceNew + nTx*txParams["amount"] == l1Balance:
        break
    elif txParams["txType"] == "Transfer":
      print("Match",l2BalanceNew, l2Balance)
      if l1BalanceNew != l1Balance:
        errorMsg = "FAILED - Balances do not match after transfer\n"
        return 0, errorMsg
      if l2BalanceNew == l2Balance:
        break
    elif txParams["txType"] == "Withdraw":
       #if l1BalanceNew != l1Balance:
        #return "FAILED - Balances do not match after withdraw\n"
       print("Match",l2BalanceNew + nTx*txParams["amount"],l2Balance)
       if l2BalanceNew + nTx*txParams["amount"] == l2Balance:
         break
    elif txParams["txType"] == "Instant-withdraw":
      print("Match", l2BalanceNew ,l2Balance ,l1BalanceNew ,nTx*txParams["amount"] + l1Balance)
      if l2BalanceNew == l2Balance and l1BalanceNew == l1Balance + nTx*txParams["amount"]:
       break
    niter+=1
  return 1,""

txTestsList = [
  {
    'name': emptyWithdrawTest,
    'description' : 'Attempts to request an instant withdraw, but since no previous withdraws exists, it fails'
  },
  {
    'name': transactionsTest,
    'description' : 'Performs deposit, transfer withdraw and instant withdraw of ERC20, ERC721 and ERC1155 tokens and check balances'
  },
  #{
    #'name': transactionsErrorTest,
    #'description' : 'Performs incorrect deposit, transfer and withdraw of ERC205 tokens and checks error message'
  #},
]
