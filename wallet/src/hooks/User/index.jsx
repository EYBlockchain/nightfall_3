import React from 'react';
import { useHistory } from 'react-router-dom';

import { ZkpKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import {
  checkIndexDBForCircuit,
  checkIndexDBForCircuitHash,
  getMaxBlock,
  emptyStoreBlocks,
  emptyStoreTimber,
} from '@Nightfall/services/database';
import { fetchAWSfiles } from '@Nightfall/services/fetch-circuit';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';
import init from '../../web-worker/index.js';

const {
  utilApiServerUrl,
  AWS: { s3Bucket },
  isLocalRun,
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
  const [lastBlock, setLastBlock] = React.useState({ blockHash: '0x0' });
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
      const lastBlockL2 = (await getMaxBlock()) ?? -1;
      console.log('LastBlock', lastBlockL2);
      socket.send(JSON.stringify({ type: 'sync', lastBlock: lastBlockL2 }));
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

        // We want to verify that the received block is from the current contract deployment.
        // for this, we store the lastBlock received in lastBlock, and compare the hash with the previousBlockHash
        // from the received block. If they don't match, then there has been a redeployment.
        if (Number(parsed.maxBlock) !== 1) {
          if (
            parsed.historicalData[parsed.historicalData.length - 1].block.previousBlockHash !==
              lastBlock.blockHash &&
            Number(lastBlock.blockHash) !== 0
          ) {
            // resync
            console.log('Resync DB');
            emptyStoreBlocks();
            emptyStoreTimber();
            Storage.shieldAddressSet();
          } else if (
            parsed.historicalData[parsed.historicalData.length - 1].block.previousBlockHash ===
              lastBlock.blockHash ||
            Number(lastBlock.blockHash) === 0
          ) {
            setLastBlock(parsed.historicalData[parsed.historicalData.length - 1].block);
            socket.send(
              JSON.stringify({
                type: 'sync',
                lastBlock:
                  parsed.historicalData[parsed.historicalData.length - 1].block.blockNumberL2,
              }),
            );
          }
        } else if (lastBlock.blockHash) console.log('Sync complete');
        setState(previousState => {
          return {
            ...previousState,
            chainSync: true,
          };
        });
      } else if (parsed.type === 'blockProposed') {
        console.log('blockProposed Event');
        if (
          parsed.data.block.previousBlockHash !== lastBlock.blockHash &&
          Number(lastBlock.blockHash) !== 0
        ) {
          // resync
          console.log('Resync DB');
          emptyStoreBlocks();
          emptyStoreTimber();
          Storage.shieldAddressSet();
        } else {
          setLastBlock(parsed.data.block);
          await blockProposedEventHandler(parsed.data, [zkpPrivateKey], [nullifierKey]);
        }
      }
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
      const circuitInfo = isLocalRun
        ? await fetch(`${utilApiServerUrl}/s3_hash.txt`).then(response => response.json())
        : JSON.parse(new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')));

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
      } else {
        console.log('RELOAD CIRCUITS');
        init();
      }
    },
    isSyncing ? 30000 : null,
  );

  /*
    Check if hash circuit functions from manifest have changed. If the have, resync again
  */
  useInterval(
    async () => {
      const circuitInfo = isLocalRun
        ? await fetch(`${utilApiServerUrl}/s3_hash.txt`).then(response => response.json())
        : JSON.parse(new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')));
      const hashCheck = await Promise.all(circuitInfo.map(c => checkIndexDBForCircuitHash(c)));
      console.log('Circuit Hash Check', hashCheck);
      if (!hashCheck.every(c => c)) {
        setState(previousState => {
          return {
            ...previousState,
            circuitSync: false,
          };
        });
        setSyncing(true);
        console.log('RELOAD CIRCUITS');
        init();
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
