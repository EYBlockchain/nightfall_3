import React from 'react';
import { useHistory } from 'react-router-dom';

import { ZkpKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import {
  checkIndexDBForCircuit,
  checkIndexDBForCircuitHash,
  getMaxBlock,
} from '@Nightfall/services/database';
import { fetchAWSfiles } from '@Nightfall/services/fetch-circuit';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';

const {
  AWS: { s3Bucket },
} = global.config;

const { eventWsUrl } = global.config;

export const initialState = {
  compressedZkpPublicKey: '',
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
  const [lastBlockHash, setLastBlockHash] = React.useState('0x0');
  const history = useHistory();

  const deriveAccounts = async (mnemonic, numAccts) => {
    const accountRange = Array.from({ length: numAccts }, (v, i) => i);
    const zkpKeys = await Promise.all(
      accountRange.map(i => ZkpKeys.generateZkpKeysFromMnemonic(mnemonic, i)),
    );
    const aesGenParams = { name: 'AES-GCM', length: 128 };
    const key = await crypto.subtle.generateKey(aesGenParams, false, ['encrypt', 'decrypt']);
    await storeBrowserKey(key);
    await Promise.all(zkpKeys.map(zkpKey => encryptAndStore(zkpKey)));
    Storage.ZkpPubKeyArraySet(
      '',
      zkpKeys.map(z => z.compressedZkpPublicKey),
    );
    setState(previousState => {
      return {
        ...previousState,
        compressedZkpPublicKey: zkpKeys[0].compressedZkpPublicKey,
      };
    });
  };

  const syncState = async () => {
    const compressedZkpPublicKeys = Storage.ZkpPubKeyArrayGet('');
    if (compressedZkpPublicKeys) {
      setState(previousState => {
        return {
          ...previousState,
          compressedZkpPublicKey: compressedZkpPublicKeys[0],
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
      socket.send(JSON.stringify({ type: 'sync', lastBlock, lastBlockHash }));
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
    const { compressedZkpPublicKey, socket } = state;
    if (compressedZkpPublicKey === '') return;

    if (messageEventHandler) {
      socket.removeEventListener('message', messageEventHandler);
    }

    // Listen for messages
    messageEventHandler = async function (event) {
      console.log('Message from server ', JSON.parse(event.data));
      const parsed = JSON.parse(event.data);
      const { nullifierKey, zkpPrivateKey } = await retrieveAndDecrypt(compressedZkpPublicKey);
      if (parsed.type === 'sync') {
        await parsed.historicalData
          .sort((a, b) => a.block.blockNumberL2 - b.block.blockNumberL2)
          .reduce(async (acc, curr) => {
            await acc; // Acc is a promise so we await it before processing the next one;
            return blockProposedEventHandler(curr, [zkpPrivateKey], [nullifierKey]); // TODO Should be array
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
      } else if (parsed.type === 'blockProposed') {
        setLastBlockHash(parsed.data.blockHash);
        await blockProposedEventHandler(parsed.data, [zkpPrivateKey], [nullifierKey]);
      } else if (parsed.type === 'resync') console.log('Resync DB');
      // TODO Rollback Handler
    };

    socket.addEventListener('message', messageEventHandler);
  };

  React.useEffect(() => {
    setupWebSocket();
  }, []);

  React.useEffect(async () => {
    if (state.compressedZkpPublicKey === '') {
      console.log('Sync State');
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [history.location.pathname]);

  React.useEffect(() => {
    configureMessageListener();
  }, [state.compressedZkpPublicKey]);

  useInterval(
    async () => {
      const circuitInfo = JSON.parse(
        new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')),
      );

      const circuitCheck = await Promise.all(circuitInfo.map(c => checkIndexDBForCircuit(c.name)));
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
    Check if hash circuit functions from manifest have changed. If the have, resync again
  */
  useInterval(
    async () => {
      const circuitInfo = JSON.parse(
        new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')),
      );

      const hashCheck = await Promise.all(circuitInfo.map(c => checkIndexDBForCircuitHash(c)));
      console.log('Circuit Check', hashCheck);
      if (!hashCheck.every(c => c)) {
        setState(previousState => {
          return {
            ...previousState,
            circuitSync: false,
          };
        });
        setSyncing(true);
      }
    },
    isSyncing ? null : 30000,
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
