/**
 * Generate Random bytes
 * generateKeys
 *
 */

import { openDB } from 'idb';

type ZkpAccount = {
  nullifierKey: string;
  rootKey: string;
  compressedZkpPublicKey: string;
};

type CipherText = {
  cipherText: string;
  iv: Uint8Array;
};

const {
  COMMITMENTS_DB,
  TIMBER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  COMMITMENTS_COLLECTION,
  KEYS_COLLECTION,
  CIRCUIT_COLLECTION,
  CIRCUIT_HASH_COLLECTION,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} = global.config;

const connectDB = async () => {
  return openDB(COMMITMENTS_DB, 1, {
    upgrade(newDb) {
      newDb.createObjectStore(COMMITMENTS_COLLECTION);
      newDb.createObjectStore(TIMBER_COLLECTION);
      newDb.createObjectStore(SUBMITTED_BLOCKS_COLLECTION);
      newDb.createObjectStore(TRANSACTIONS_COLLECTION);
      newDb.createObjectStore(KEYS_COLLECTION);
      newDb.createObjectStore(CIRCUIT_COLLECTION);
      newDb.createObjectStore(CIRCUIT_HASH_COLLECTION);
    },
  });
};

export const storeBrowserKey = async (key: CryptoKey): Promise<IDBValidKey> => {
  const db = await connectDB();
  return db.put(KEYS_COLLECTION, key, 'cryptokey');
};

const encrypt = async (acct: ZkpAccount, key: CryptoKey): Promise<CipherText> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buffer = new TextEncoder().encode(JSON.stringify(acct));
  const cipherText = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);
  return {
    cipherText: Buffer.from(cipherText).toString('base64'),
    iv,
  };
};

export const encryptAndStore = async (acct: ZkpAccount): Promise<IDBValidKey> => {
  const db = await connectDB();
  const key = await db.get(KEYS_COLLECTION, 'cryptokey');
  const cipherText = await encrypt(acct, key);
  return db.put(KEYS_COLLECTION, cipherText, acct.compressedZkpPublicKey);
};

const decrypt = async (
  cipherText: BufferSource,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<ZkpAccount> => {
  const plainText: BufferSource = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherText,
  );
  const decodeBuffer = new TextDecoder().decode(plainText);
  return JSON.parse(decodeBuffer); // TODO error handling
};

export const retrieveAndDecrypt = async (compressedZkpPublicKey: string): Promise<ZkpAccount> => {
  const db = await connectDB();
  const key = await db.get(KEYS_COLLECTION, 'cryptokey');
  const { cipherText, iv } = await db.get(KEYS_COLLECTION, compressedZkpPublicKey); // TODO error handling
  return decrypt(Buffer.from(cipherText, 'base64'), key, iv);
};

export const rotateKey = async (): Promise<IDBValidKey> => {
  const db = await connectDB();
  const keysCollection = await db.getAllKeys(KEYS_COLLECTION);
  // Retrieve zkpPubKeys
  const compressedZkpPublicKeys = keysCollection.filter(k => k !== 'cryptokey');
  // Generate New Key
  const aesGenParams = { name: 'AES-GCM', length: 128 };
  const newKey: CryptoKey = await crypto.subtle.generateKey(aesGenParams, false, [
    'encrypt',
    'decrypt',
  ]);
  // Retrieve and Decrypt all accounts
  const decryptedZkpAccounts = await Promise.all(
    compressedZkpPublicKeys.map(async (recipientPublicKey: IDBValidKey) =>
      retrieveAndDecrypt(recipientPublicKey.toString()),
    ),
  );
  // Re-encrypt these accounts under the new key and store.
  await Promise.all(
    decryptedZkpAccounts.map(async dec => {
      const cipherText = await encrypt(dec, newKey);
      return db.put(KEYS_COLLECTION, cipherText, dec.compressedZkpPublicKey);
    }),
  );
  // Store the new key.
  return storeBrowserKey(newKey);
};