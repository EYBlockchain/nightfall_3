import React from 'react';
import { useHistory } from 'react-router-dom';

import { ZkpKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import rollbackEventHandler from '@Nightfall/event-handlers/rollback';
import {
  checkIndexDBForCircuit,
  checkIndexDBForCircuitHash,
  storeClientId, getClientId,
  emptyStoreBlocks,
  emptyStoreTimber,
} from '@Nightfall/services/database';
import { fetchAWSfiles } from '@Nightfall/services/fetch-circuit';
import mqtt from 'mqtt';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';
import { wsMqMapping, topicRollback, topicBlockProposed } from '../../common-files/utils/mq';
import init from '../../web-worker/index.js';

const { USE_STUBS, usernameMq, pswMQ } = global.config;

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
  const [client, setClient] = React.useState(null);  
  const [lastBlock, setLastBlock] = React.useState({ blockHash: '0x0' });
  const history = useHistory();

  const mqttConnect = (host, mqttOption) => {
    setClient(mqtt.connect(host, mqttOption));
  };

  const setupWebSocket = async () => {
    const options = {
      clientId: await getClientId(0),
      clean: false,
      username: usernameMq,
      password: pswMQ,
      rejectUnauthorized: false,
      reconnectPeriod: 1000,
    };

    mqttConnect(wsMqMapping[process.env.REACT_APP_MODE], options);

    setState(previousState => {
      return {
        ...previousState,
      };
    });
  };

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

    const clientId =
      Math.floor(new Date().getTime() / 1000) +
      Math.floor(Math.random() * 100) +
      zkpKeys[0].compressedPkd;
    storeClientId(clientId);
    setState(previousState => {
      return {
        ...previousState,
        compressedZkpPublicKey: zkpKeys[0].compressedZkpPublicKey,
      };
    });
    setupWebSocket();
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

  const configureMessageListener = () => {
    const { compressedZkpPublicKey, socket } = state;
    if (compressedZkpPublicKey === '') return;

    if (messageEventHandler) {
      socket.removeEventListener('message', messageEventHandler);
    }

    // Listen for messages
      if(client) {
        client.on('message', async (topic, message) => {

          const { type, data } = JSON.parse(message.toString());
          const { ivk, nsk } = await retrieveAndDecrypt(compressedPkd);
          if (topic === 'blockProposed') {
            if(type == topic)
              await blockProposedEventHandler(data, [ivk], [nsk]);
            else
              console.log("Error: messange sent on wrong topic")
          }
          else if (topic === 'rollback'){
            if(type == topic)
              await rollbackEventHandler(data);
            else
              console.log("Error: messange sent on wrong topic")
          }
        });
      }
  };

  React.useEffect(() => {
    if (client) {
      client.on('connect', () => {
        console.log('connected');
        client.subscribe(topicRollback, { qos: 2 }, function (err, granted) {
          if (err) {
            console.log(err);
          } else if (granted) {
            console.log('subscribe to ', topicRollback, granted);
          }
        });

        client.subscribe(topicBlockProposed, { qos: 2 }, function (err, granted) {
          if (err) {
            console.log(err);
          } else if (granted) {
            console.log('subscribe to ', topicBlockProposed, granted);
          }
        });
      });

      client.on('error', err => {
        console.error('Connection error: ', err);
        client.end();
      });

      client.on('reconnect', () => {
        console.log('Reconnecting');
      });

      const { compressedPkd } = state;
      if (compressedPkd === '') return;

      // Listen for messages

      client.on('message', async (topic, message) => {
        const { type, data } = JSON.parse(message.toString());
        const { ivk, nsk } = await retrieveAndDecrypt(compressedPkd);
        console.log('message received', data, topic);

        if (topic === topicBlockProposed) {
          if (type === topic) await blockProposedEventHandler(data, [ivk], [nsk]);
          else console.log('Error: messange sent on wrong topic');
        } else if (topic === topicRollback) {
          if (type === topic) await rollbackEventHandler(data);
          else console.log('Error: messange sent on wrong topic');
        }
      });
    }
  }, [client]);

  React.useEffect(async () => {
    if (await getClientId(0)) setupWebSocket();
  }, []);

  React.useEffect(async () => {
    if (state.compressedZkpPublicKey === '') {
      console.log('Sync State');
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [history.location.pathname]);

  // React.useEffect(() => {
  //   configureMessageListener();
  // }, [state.compressedPkd]);

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
