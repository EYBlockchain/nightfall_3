import React from 'react';
import { useHistory } from 'react-router-dom';

import { generateKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import rollbackEventHandler from '@Nightfall/event-handlers/rollback';
import { checkIndexDBForCircuit, storeClientId, getClientId } from '@Nightfall/services/database';
import mqtt from 'mqtt';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';
import { wsMqMapping, topicRollback, topicBlockProposed } from '../../common-files/utils/mq';

const { USE_STUBS, usernameMq, pswMQ } = global.config;

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
  const [client, setClient] = React.useState(null);

  const mqttConnect = (host, mqttOption) => {
    setClient(mqtt.connect(host, mqttOption));
  };

  const history = useHistory();

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

    const clientId =
      Math.floor(new Date().getTime() / 1000) +
      Math.floor(Math.random() * 100) +
      zkpKeys[0].compressedPkd;
    storeClientId(clientId);
    setState(previousState => {
      return {
        ...previousState,
        compressedPkd: zkpKeys[0].compressedPkd,
      };
    });
    setupWebSocket();
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
    if (state.compressedPkd === '') {
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
