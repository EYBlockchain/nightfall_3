import React from 'react';
import { useHistory } from 'react-router-dom';

import { generateKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import { checkIndexDBForCircuit, getMaxBlock } from '@Nightfall/services/database';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';

const { eventWsUrl, USE_STUBS } = global.config;

export const initialState = {
  compressedPkd: '',
  chainSync: false,
  circuitSync: false,
};

export const UserContext = React.createContext({
  state: initialState,
});

// eslint-disable-next-line react/prop-types
export const UserProvider = ({ children }) => {
  const [state, setState] = React.useState(initialState);
  const [isSyncComplete, setIsSyncComplete] = React.useState(false); // This is not really a sync;
  const [isSyncing, setSyncing] = React.useState(true);
  const history = useHistory();

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
      '',
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
    const pkds = Storage.pkdArrayGet('');
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
    const socket = new WebSocket(eventWsUrl);

    // Connection opened
    socket.addEventListener('open', async function () {
      console.log(`Websocket is open`);
      const lastBlock = (await getMaxBlock()) ?? -1;
      console.log('LastBlock', lastBlock);
      socket.send(JSON.stringify({ type: 'sync', lastBlock }));
    });

    setState(previousState => {
      return {
        ...previousState,
        socket,
      };
    });
  };

  let messageEventHandler;
  const configureMessageListener = () => {
    const { compressedPkd, socket } = state;
    if (compressedPkd === '') return;

    if (messageEventHandler) {
      socket.removeEventListener('message', messageEventHandler);
    }

    // Listen for messages
    messageEventHandler = async function (event) {
      console.log('Message from server ', JSON.parse(event.data));
      const parsed = JSON.parse(event.data);
      const { ivk, nsk } = await retrieveAndDecrypt(compressedPkd);
      if (parsed.type === 'sync') {
        await parsed.historicalData
          .sort((a, b) => a.block.blockNumberL2 - b.block.blockNumberL2)
          .reduce(async (acc, curr) => {
            await acc; // Acc is a promise so we await it before processing the next one;
            return blockProposedEventHandler(curr, [ivk], [nsk]); // TODO Should be array
          }, Promise.resolve());
        if (Number(parsed.maxBlock) !== 1) {
          socket.send(
            JSON.stringify({
              type: 'sync',
              lastBlock:
                parsed.historicalData[parsed.historicalData.length - 1].block.blockNumberL2,
            }),
          );
        }
        console.log('Sync complete');
        setState(previousState => {
          return {
            ...previousState,
            chainSync: true,
          };
        });
      } else if (parsed.type === 'blockProposed')
        await blockProposedEventHandler(parsed.data, [ivk], [nsk]);
      // TODO Rollback Handler
    };

    socket.addEventListener('message', messageEventHandler);
  };

  React.useEffect(() => {
    setupWebSocket();
  }, []);

  React.useEffect(async () => {
    if (state.compressedPkd === '') {
      console.log('Sync State');
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [history.location.pathname]);

  React.useEffect(() => {
    configureMessageListener();
  }, [state.compressedPkd]);

  useInterval(
    async () => {
      const circuitName = USE_STUBS
        ? ['deposit_stub', 'single_transfer_stub', 'double_transfer_stub', 'withdraw_stub']
        : ['deposit', 'single_transfer', 'double_transfer', 'withdraw'];

      const circuitCheck = await Promise.all(circuitName.map(c => checkIndexDBForCircuit(c)));
      console.log('Circuit Check', circuitCheck);
      if (circuitCheck.every(c => c)) {
        setState(previousState => {
          return {
            ...previousState,
            circuitSync: true,
          };
        });
        setSyncing(false);
      }
    },
    isSyncing ? 30000 : null,
  );
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
