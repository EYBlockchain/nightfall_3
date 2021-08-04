/**
 * This module discovers and manages optimistic peers for direct transfers
 */
import axios from 'axios';
import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';

const { MONGO_URL, COMMITMENTS_DB, PEERS_COLLECTION, STATE_CONTRACT_NAME } = config;

export const retrievePeers = async () => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(PEERS_COLLECTION).find().toArray();
};

export const savePeers = async peers => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  if (peers.length === 0) return [];
  return db.collection(PEERS_COLLECTION).insertMany(peers);
};

const deletePeers = async peers => {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { peers };
  return db.collection(PEERS_COLLECTION).deleteMany(query);
};

const connectRelay = async relayAddress => {
  const response = await axios
    .get(`${relayAddress}/proposer/proposers`, { timeout: 3600000 })
    .catch(err => {
      logger.debug(`Peer Connection Failed with code: ${err.status}`);
      return [];
    });
  return response.body;
};

const getProposers = async () => {
  const proposersContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
  const currentProposer = await proposersContractInstance.methods.currentProposer().call();
  const proposerList = [currentProposer.thisAddress];
  let nextProposer = await proposersContractInstance.methods
    .proposers(currentProposer.nextAddress)
    .call();
  while (currentProposer.thisAddress !== nextProposer.thisAddress) {
    proposerList.push(nextProposer.thisAddress);
    // eslint-disable-next-line no-await-in-loop
    nextProposer = await proposersContractInstance.methods
      .proposers(nextProposer.nextAddress)
      .call();
  }
  return proposerList;
};

const validatePeers = async peerList => {
  // Can swap the below requirements for a light client/infura endpoint
  const proposers = await getProposers();
  // Filter the peerlist
  const [validPeers, invalidPeers] = Object.keys(peerList).reduce(
    (acc, pAddr) => {
      if (proposers.includes(pAddr)) {
        const newArr = acc[0];
        newArr[pAddr] = peerList[pAddr];
        return [newArr, acc[1]];
      }
      const newArr = acc[1];
      newArr[pAddr] = peerList[pAddr];
      return [acc[0], newArr];
    },
    [[], []],
  );
  logger.debug(`Validate Proposers; ${validPeers}`);
  if (Object.keys(invalidPeers).length > 0) await deletePeers(invalidPeers);
  if (Object.keys(validPeers).length > 0) await savePeers(validPeers);
  return validPeers;
};

export const discoverPeers = async discoverMethod => {
  const peerList = [];
  switch (discoverMethod) {
    case 'Local':
      (await retrievePeers()).forEach(peer => {
        peerList[peer.address] = peer.enode;
      });
      break;
    case 'Relay':
      (await connectRelay('add')).forEach(peer => {
        peerList[peer.address] = peer.enode;
      });
      break;
    default:
      throw new Error('invalid discover method');
  }
  const validPeerList = await validatePeers(peerList);
  return validPeerList;
};
