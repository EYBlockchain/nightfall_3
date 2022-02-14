import React, { useContext } from 'react';
import jsSha3 from 'js-sha3';
import { useLocation } from 'react-router-dom';

import Web3 from '../../common-files/utils/web3';
import { METAMASK_MESSAGE, DEFAULT_NF_ADDRESS_INDEX } from '../../constants';
import * as Storage from '../../utils/lib/local-storage';
import { generateKeys } from '../../nightfall-browser/services/keys';
import blockProposedEventHandler from '../../nightfall-browser/event-handlers/block-proposed';

const { eventWsUrl } = global.config;

export const reducer = (state, action) => {
  switch (action.type) {
    case 'toggle_button':
      return {
        ...state,
        active: !state.active,
      };
    default:
      return state;
  }
};

export const initialState = {
  active: false,
  zkpKeys: {
    pkd: '',
    nsk: '',
    ask: '',
  },
};

export const UserContext = React.createContext({
  state: initialState,
});

// eslint-disable-next-line react/prop-types
export const UserProvider = ({ children }) => {
  // const [state, dispatch] = React.useReducer(reducer, initialState);
  const [state, setState] = React.useState(initialState);
  const [isSyncComplete, setIsSyncComplete] = React.useState(false);
  const location = useLocation();
  // const [isRoot, setIsRoot] = React.useState(location.pathname === '/');

  const configureMnemonic = async mnemonic => {
    const signature = await Web3.signMessage(METAMASK_MESSAGE);
    const passphrase = jsSha3.keccak256(signature);
    Storage.mnemonicSet(await Web3.getAccount(), mnemonic, passphrase);
    setState(previousState => {
      return {
        ...previousState,
        mnemonic,
      };
    });
  };

  const syncState = async () => {
    const mnemonicExists = Storage.mnemonicGet(await Web3.getAccount());
    if (mnemonicExists) {
      const signature = await Web3.signMessage(METAMASK_MESSAGE);
      const passphrase = jsSha3.keccak256(signature);
      const mnemonic = Storage.mnemonicGet(await Web3.getAccount(), passphrase);
      setState(previousState => {
        return {
          ...previousState,
          mnemonic,
        };
      });
    }
  };

  const setupWebSocket = () => {
    if (!state.zkpKeys) return;
    const socket = new WebSocket(eventWsUrl);

    // Connection opened
    socket.addEventListener('open', function () {
      console.log(`Websocket is open`);
      socket.send('proposedBlock');
    });

    // Listen for messages
    socket.addEventListener('message', async function (event) {
      console.log('Message from server ', event.data);
      await blockProposedEventHandler(JSON.parse(event.data), state.zkpKeys.ivk, state.zkpKeys.nsk);
    });
    setState(previousState => {
      return {
        ...previousState,
        socket,
      };
    });
  };

  const configureZkpKeys = async mnemonic => {
    if (!mnemonic) return;
    const zkpKeys = await generateKeys(
      mnemonic,
      `m/44'/60'/0'/${DEFAULT_NF_ADDRESS_INDEX.toString()}`,
    );
    setState(previousState => {
      return {
        ...previousState,
        zkpKeys,
      };
    });
  };

  React.useEffect(async () => {
    if (location.pathname !== '/' && !state.mnemonic) {
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [location]);

  React.useEffect(() => {
    setupWebSocket();
  }, [state.zkpKeys]);

  React.useEffect(() => {
    configureZkpKeys(state.mnemonic);
  }, [state.mnemonic]);

  /*
   * TODO: children should render when sync is complete
   * like implement a loader till sync is not complete
   * for example with blank page:
   *  '{isSyncComplete || true ? children : <div> Signing to MetaMask </div>}'
   *  instead of '{children}'
   */
  return (
    <UserContext.Provider value={[state, setState, configureMnemonic]}>
      {children}
    </UserContext.Provider>
  );
};

function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('O hook useAuth deve ser usado dentro do componente AuthProvider');
  }
  return context;
}

export { useUser };
