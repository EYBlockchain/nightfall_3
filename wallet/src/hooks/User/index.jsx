import React from 'react';
import jsSha3 from 'js-sha3';
import { useLocation } from 'react-router-dom';

import Web3 from '../../common-files/utils/web3';
import { METAMASK_MESSAGE, DEFAULT_NF_ADDRESS_INDEX } from '../../constants';
import * as Storage from '../../utils/lib/local-storage';
import { generateKeys } from '../../nightfall-browser/services/keys';
import blockProposedEventHandler from '../../nightfall-browser/event-handlers/block-proposed';
import { getMaxBlock } from '../../nightfall-browser/services/database';

const { eventWsUrl } = global.config;

// export const reducer = (state, action) => {
//   switch (action.type) {
//     case 'toggle_button':
//       return {
//         ...state,
//         active: !state.active,
//       };
//     default:
//       return state;
//   }
// };

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
    socket.addEventListener('open', async function () {
      console.log(`Websocket is open`);
      const lastBlock = (await getMaxBlock())?._id ?? -1;
      console.log('LasBlock', lastBlock);
      socket.send(JSON.stringify({ type: 'sync', lastBlock }));
    });

    // Listen for messages
    socket.addEventListener('message', async function (event) {
      console.log('Message from server ', JSON.parse(event.data));
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'sync')
        await Promise.all(
          parsed.historicalData.map(e => {
            return blockProposedEventHandler(e, state.zkpKeys.ivk, state.zkpKeys.nsk);
          }),
        );
      else if (parsed.type === 'blockProposed')
        await blockProposedEventHandler(parsed.data, state.zkpKeys.ivk, state.zkpKeys.nsk);
      // TODO Rollback Handler
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
