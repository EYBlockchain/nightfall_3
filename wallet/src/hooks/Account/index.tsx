import React, {
  createContext,        
  useContext,
  useState    
} from 'react';

type AccountType = {
  address: string;
}

const accountType: AccountType = {
  address: ""
};

type AccountContextType = {
  accountInstance: AccountType;
  setAccountInstance: React.Dispatch<React.SetStateAction<AccountType>>        
}

const AccountContext = createContext<AccountContextType>({} as AccountContextType);

/**
* Component which will be inserted under the main component to allow the 
* context use
* @param children
*/
const AccountProvider = ({ children }: any) => {

  const [accountInstance, setAccountInstance] = useState<AccountType>(accountType)    

  return (              
      <AccountContext.Provider
          value={{                
              accountInstance,
              setAccountInstance
          }}
      >
          {children}
      </AccountContext.Provider>      
  );
};

/**
* Hook to allow the context call   
*/
const useAccount = () => {
  const context = useContext(AccountContext);
      
  if (!context) {
      throw new Error(
          'Hook useWeb3Instance must be created inner the component UserInstanceProvider',
      );
  }

  return context;
}

export { useAccount, AccountProvider };