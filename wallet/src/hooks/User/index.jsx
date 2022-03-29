import React from 'react';
import { useLocation } from 'react-router-dom';

import Web3 from '../../common-files/utils/web3';
import * as Storage from '../../utils/lib/local-storage';
import { generateKeys } from '../../nightfall-browser/services/keys';
import blockProposedEventHandler from '../../nightfall-browser/event-handlers/block-proposed';
import { getMaxBlock } from '../../nightfall-browser/services/database';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';

const { eventWsUrl } = global.config;

export const initialState = {
  compressedPkd: '',
};

export const UserContext = React.createContext({
  state: initialState,
});

// eslint-disable-next-line react/prop-types
export const UserProvider = ({ children }) => {
  const [state, setState] = React.useState(initialState);
  const [isSyncComplete, setIsSyncComplete] = React.useState(false);
  const location = useLocation();

  const deriveAccounts = async (mnemonic, numAccts) => {
    const accountRange = Array.from({ length: numAccts }, (v, i) => i);
    const zkpKeys = await Promise.all(
      accountRange.map(i => generateKeys(mnemonic, `m/44'/60'/0'/${i.toString()}`)),
    );
    const aesGenParams = { name: 'AES-GCM', length: 128 };
    const key = await crypto.subtle.generateKey(aesGenParams, false, ['encrypt', 'decrypt']);
    await storeBrowserKey(key);
    await Promise.all(zkpKeys.map(zkpKey => encryptAndStore(zkpKey)));
    Storage.pkdArraySet(
      await Web3.getAccount(),
      zkpKeys.map(z => z.compressedPkd),
    );
    setState(previousState => {
      return {
        ...previousState,
        compressedPkd: zkpKeys[0].compressedPkd,
      };
    });
  };

  const syncState = async () => {
    const pkds = Storage.pkdArrayGet(await Web3.getAccount());
    if (pkds) {
      setState(previousState => {
        return {
          ...previousState,
          compressedPkd: pkds[0],
        };
      });
    }
  };

  const setupWebSocket = () => {
    if (!state.compressedPkd) return;
    const socket = new WebSocket(eventWsUrl);

    // Connection opened
    socket.addEventListener('open', async function () {
      console.log(`Websocket is open`);
      const lastBlock = (await getMaxBlock()) ?? -1;
      console.log('LastBlock', lastBlock);
      socket.send(JSON.stringify({ type: 'sync', lastBlock }));
    });

    // Listen for messages
    socket.addEventListener('message', async function (event) {
      console.log('Message from server ', JSON.parse(event.data));
      const parsed = JSON.parse(event.data);
      const { ivk, nsk } = await retrieveAndDecrypt(state.compressedPkd);
      if (parsed.type === 'sync') {
        parsed.historicalData
          .sort((a, b) => a.block.blockNumberL2 - b.block.blockNumberL2)
          .reduce(async (acc, curr) => {
            await acc; // Acc is a promise so we await it before processing the next one;
            return blockProposedEventHandler(curr, [ivk], [nsk]); // TODO Should be array
          }, Promise.resolve());
      } else if (parsed.type === 'blockProposed') await blockProposedEventHandler(parsed.data, [ivk], [nsk]);
      // TODO Rollback Handler
    });
    setState(previousState => {
      return {
        ...previousState,
        socket,
      };
    });
  };

  React.useEffect(async () => {
    if (location.pathname !== '/' && !state.compressedPkd) {
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [location]);

  React.useEffect(() => {
    setupWebSocket();
  }, [state.compressedPkd]);

  /*
   * TODO: children should render when sync is complete
   * like implement a loader till sync is not complete
   * for example with blank page:
   *  '{isSyncComplete || true ? children : <div> Signing to MetaMask </div>}'
   *  instead of '{children}'
   */
  return (
    <UserContext.Provider value={[state, setState, deriveAccounts]}>
      {children}
    </UserContext.Provider>
  );
};
