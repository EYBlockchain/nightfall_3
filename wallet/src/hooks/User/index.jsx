import React from 'react';
import jsSha3 from 'js-sha3';

import Web3 from '../../common-files/utils/web3';
import { METAMASK_MESSAGE, DEFAULT_NF_ADDRESS_INDEX } from '../../constants.js';
import * as Storage from '../../utils/lib/local-storage';
import { generateKeys } from '../../nightfall-browser/services/keys.js';
import blockProposedEventHandler from '../../nightfall-browser/event-handlers/block-proposed.js';

const { optimistWsUrl } = global.config;

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
};

export const UserContext = React.createContext({
  state: initialState,
});

// eslint-disable-next-line react/prop-types
export const UserProvider = ({ children }) => {
  // const [state, dispatch] = React.useReducer(reducer, initialState);
  const [state, setState] = React.useState(initialState);
  const [isSyncComplete, setIsSyncComplete] = React.useState(false);

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
    console.log('in syncState', state);
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
    console.log('in setupWebSocket 1');
    if (!state.zkpKeys) return;
    console.log('in setupWebSocket 2');
    const socket = new WebSocket(optimistWsUrl);

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
    console.log('in configureZkpKeys 1');
    if (!mnemonic) return;
    console.log('in configureZkpKeys 2');
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
    console.log('in hook useEffect 1', state);
    await syncState();
    setIsSyncComplete({ isSyncComplete: true });
  }, []);

  React.useEffect(() => {
    console.log('in hook useEffect 2', state);
    setupWebSocket();
  }, [state.zkpKeys]);

  React.useEffect(() => {
    console.log('in hook useEffect 3', state);
    configureZkpKeys(state.mnemonic);
  }, [state.mnemonic]);

  return (
    <UserContext.Provider value={[state, setState, configureMnemonic]}>
      {isSyncComplete ? children : <div> Signing to MetaMask </div>}
    </UserContext.Provider>
  );
};
