import loadWeb3 from "./loadWeb3";
declare var window: any

type AccountType = {
  address: string
};

const loadAccount = async (): Promise<AccountType | null> => {
  
  loadWeb3();      
    
  if (window.web3) {
    const web3 = window.web3      
    const accounts = await web3.eth.getAccounts()
    
    return {
      address: accounts[0]
    };            
  }
  
  return null;
}

export default loadAccount;