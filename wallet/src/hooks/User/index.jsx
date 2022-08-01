import React from 'react';
import { useHistory } from 'react-router-dom';

import { generateKeys } from '@Nightfall/services/keys';
import blockProposedEventHandler from '@Nightfall/event-handlers/block-proposed';
import rollbackEventHandler from '@Nightfall/event-handlers/rollback';
import {
  checkIndexDBForCircuit,
  storeClientId,
  getClientId,
  saveTree,
  getMaxBlock,
} from '@Nightfall/services/database';
import mqtt from 'mqtt';
import axios from 'axios';
import * as Storage from '../../utils/lib/local-storage';
import { encryptAndStore, retrieveAndDecrypt, storeBrowserKey } from '../../utils/lib/key-storage';
import useInterval from '../useInterval';
import { wsMqMapping, topicRollback, topicBlockProposed } from '../../common-files/utils/mq';
import logger from 'common-files/utils/logger';

const { USE_STUBS, usernameMq, pswMQ, twoStepSyncUrl, twoStepSyncDeployment } = global.config;

export const initialState = {
  compressedPkd: '',
  chainSync: false,
  circuitSync: false,
  timberSync: false,
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
  const [blockClient, setBlockClient] = React.useState(null);

  const mqttConnect = async host => {
    const currentClientId = await getClientId(0);
    const options = {
      clientId: currentClientId,
      clean: false,
      username: usernameMq,
      password: pswMQ,
      rejectUnauthorized: false,
      reconnectPeriod: 1000,
    };
    console.log("options1", options)
    setClient(mqtt.connect(host, options));

    const blockOptions = {
      clientId: `block_${currentClientId}`,
      clean: true,
      username: usernameMq,
      password: pswMQ,
      rejectUnauthorized: false,
      reconnectPeriod: 1000,
    };
    console.log("options2", blockOptions)
    setBlockClient(mqtt.connect(host, blockOptions));
  };

  const history = useHistory();

  const setupMqtt = async () => {
    mqttConnect(wsMqMapping[process.env.REACT_APP_MODE]);

    setState(previousState => {
      return {
        ...previousState,
      };
    });
  };

  const createClientId = async address => {
    const clientId =
      Math.floor(new Date().getTime() / 1000) + Math.floor(Math.random() * 100) + address;
    storeClientId(clientId);
  };

  const timberAndBlockSync = async (
    lastTimberBlock,
    lastL2Block,
    isTimberSynced,
    isL2Synced = false,
  ) => {
    if (isTimberSynced && isL2Synced) {
      return;
    }

    const res = await axios
      .get(
        `${twoStepSyncUrl}?deployment=${twoStepSyncDeployment}&lastTimberBlock=${lastTimberBlock}&lastL2Block=${lastL2Block}&isTimberSynced=${isTimberSynced}`,
      )
      .catch(err => {
        console.log(err);
      });

    for (const timb of res.data.timber.data) {
      // eslint-disable-next-line
      await saveTree(timb.timber.blockNumber, timb.blockNumberL2, timb.timber);
    }

    if (res.data.timber.isSynced) {
      setState(previousState => {
        return {
          ...previousState,
          timberSync: res.data.timber.isSynced,
        };
      });
    }

    for (const block of res.data.l2Block.data) {
      /* eslint-disable */
      const { ivk, nsk } = await retrieveAndDecrypt(state.compressedPkd);
      await blockProposedEventHandler(block, [ivk], [nsk], false);
      /* eslint-enable */
    }

    if (res.data.l2Block.isSynced) {
      setState(previousState => {
        return {
          ...previousState,
          chainSync: res.data.l2Block.isSynced,
        };
      });
    }

    timberAndBlockSync(
      res.data.timber.lastBlock,
      res.data.l2Block.lastBlock,
      res.data.timber.isSynced,
      res.data.l2Block.isSynced,
    );
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

    createClientId(zkpKeys[0].compressedPkd);
    setState(previousState => {
      return {
        ...previousState,
        compressedPkd: zkpKeys[0].compressedPkd,
      };
    });
    await timberAndBlockSync(-1, -1, false);
    setupMqtt();
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

  const mqttClientOnChange = async (mqClient, topic) => {
    mqClient.on('connect', () => {
      console.log('connected');

      mqClient.subscribe(topic, { qos: 2 }, function (err, granted) {
        if (err) {
          console.log(err);
        } else if (granted) {
          console.log('subscribe to ', topic, granted);
        }
      });
    });

    mqClient.on('error', err => {
      console.error('Connection error: ', err);
      mqClient.end();
    });

    mqClient.on('reconnect', () => {
      console.log('Reconnecting');
    });
  };

  React.useEffect(() => {
    if (client) {
      mqttClientOnChange(client, topicRollback);
      client.on('message', async (topic, message) => {
        logger.info(message.toString());
        const { type, data } = JSON.parse(message.toString());
        if (topic === topicBlockProposed) {
          console.log('Error: messange sent on wrong topic');
        } else if (topic === topicRollback) {
          if (type === topic) {
            const maxBlockTimber = await getMaxBlock();
            if (data <= maxBlockTimber) {
              await rollbackEventHandler(data);
              await timberAndBlockSync(maxBlockTimber, maxBlockTimber, false);
            }
          } else console.log('Error: messange sent on wrong topic');
        }
      });
    }
  }, [client]);

  React.useEffect(() => {
    if (blockClient) {
      mqttClientOnChange(blockClient, topicBlockProposed);
      const { compressedPkd } = state;
      if (compressedPkd === '') return;
      blockClient.on('message', async (topic, message) => {
        const { type, data } = JSON.parse(message.toString());
        const { ivk, nsk } = await retrieveAndDecrypt(compressedPkd);
        if (topic === topicBlockProposed && state.chainSync) {
          if (type === topic) await blockProposedEventHandler(data, [ivk], [nsk]);
          else console.log('Error: messange sent on wrong topic');
        } else if (topic === topicRollback) {
          console.log('Error: messange sent on wrong topic');
        }
      });
    }
  }, [blockClient]);

  React.useEffect(async () => {
    const maxBlockTimber = await getMaxBlock();
    if (await getClientId(0)) await setupMqtt();
    await timberAndBlockSync(maxBlockTimber, maxBlockTimber, false);
  }, []);

  React.useEffect(async () => {
    if (state.compressedPkd === '') {
      console.log('Sync State');
      await syncState();
    }
    if (!isSyncComplete) setIsSyncComplete({ isSyncComplete: true });
  }, [history.location.pathname]);

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
