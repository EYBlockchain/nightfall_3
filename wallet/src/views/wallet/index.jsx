import React, { useEffect, useState, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import PropTypes from 'prop-types';
import Button from 'react-bootstrap/Button';
import { generateMnemonic, validateMnemonic } from 'bip39';
import InputGroup from 'react-bootstrap/InputGroup';
import FormControl from 'react-bootstrap/FormControl';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import importTokens from '@TokenList/index';
import Assets from '@Components/Assets/index.jsx';
import Header from '@Components/Header/header.jsx';
import SideBar from '@Components/SideBar/index.jsx';
import Tokens from '@Components/Tokens/index.jsx';
import { getWalletBalance } from '@Nightfall/services/commitment-storage.js';
import Lottie from 'lottie-react';
import { UserContext } from '../../hooks/User/index.jsx';

import './wallet.scss';
import * as Storage from '../../utils/lib/local-storage';
import Web3 from '../../common-files/utils/web3';
import { useAccount } from '../../hooks/Account/index.tsx';
import useInterval from '../../hooks/useInterval.js';
import {
  getIndexedDBObjectRowsFromBackupFile,
  convertFileToObject,
  addObjectStoreToIndexedDB,
} from '../../utils/CommitmentsBackup/import';
import isCommitmentsCPKDMatchDerivedKeys from '../../utils/CommitmentsBackup/commitmentsVerification.js';
import successHand from '../../assets/img/modalImages/success-hand.png';
import checkMarkCross from '../../assets/lottie/check-mark-cross.json';

const supportedTokens = importTokens();

const { DEFAULT_ACCOUNT_NUM } = global.config;

const { ethereum } = global;

function WalletModal(props) {
  const [, , deriveAccounts] = useContext(UserContext);
  const [screenMnemonic, setScreenMnemonic] = useState();
  const [isNewWallet, setIsNewWallet] = useState(true);
  const [backupFile, setBackupFile] = useState(null);
  const [isMnemonicValid, setIsMnemonicValid] = useState(false);
  const [mnemonicRecArray, setMnemonicRecArray] = useState([
    [
      { id: 0, word: '' },
      { id: 1, word: '' },
      { id: 2, word: '' },
      { id: 3, word: '' },
      { id: 4, word: '' },
      { id: 5, word: '' },
    ],
    [
      { id: 6, word: '' },
      { id: 7, word: '' },
      { id: 8, word: '' },
      { id: 9, word: '' },
      { id: 10, word: '' },
      { id: 11, word: '' },
    ],
  ]);

  /**
   *
   * @param {*} event
   * @description got the file choosen by the input for upload
   * file and handle the import commitments and backup flow.
   */
  const uploadBackupFile = async event => {
    event.preventDefault();
    try {
      const objectRecovered = await convertFileToObject(event.target.files[0]);
      setBackupFile(objectRecovered);
    } catch {
      setBackupFile(null);
    }
  };

  const concatAllWords = () => {
    return new Promise(resolve => {
      let mnemonic = '';
      mnemonicRecArray.forEach((objRow, indexR) => {
        objRow.forEach((objCol, indexC) => {
          if (indexR === mnemonicRecArray.length - 1 && indexC === objRow.length - 1) {
            mnemonic = mnemonic.concat(objCol.word);
          } else {
            mnemonic = mnemonic.concat(objCol.word).concat(' ');
          }
        });
      });
      resolve(mnemonic);
    });
  };

  const setIndexedDBObjectsStore = async () => {
    const commitments = await getIndexedDBObjectRowsFromBackupFile(backupFile, 'commitments');
    await addObjectStoreToIndexedDB('nightfall_commitments', commitments, 'commitments');
    const transactions = await getIndexedDBObjectRowsFromBackupFile(backupFile, 'transactions');
    await addObjectStoreToIndexedDB('nightfall_commitments', transactions, 'transactions');
  };

  const clearSiteData = indexedDBDatabaseName => {
    indexedDB.deleteDatabase(indexedDBDatabaseName);
    window.localStorage.clear();
    window.sessionStorage.clear();
  };

  const recoverWallet = async () => {
    let mnemonic = await concatAllWords();
    setMnemonicRecArray([]);
    const isValid = validateMnemonic(mnemonic);

    if (!isValid) {
      setIsMnemonicValid(isValid);
      return;
    }

    if (!backupFile) {
      return;
    }

    setIsMnemonicValid(isValid);
    await deriveAccounts(mnemonic, DEFAULT_ACCOUNT_NUM);
    new Promise((resolve, reject) => {
      let flag = false;
      let myIndexedDB;
      // const request = indexedDB.open('MyDatabase', 1);

      while (!flag) {
        try {
          myIndexedDB = indexedDB.open('nightfall_commitments', 1);
          flag = true;
        } catch (e) {
          flag = false;
        }
      }

      myIndexedDB.onerror = function () {
        reject(myIndexedDB.error);
      };

      myIndexedDB.onsuccess = () => {
        const OBJ_STORE_NAME = 'keys';
        const db = myIndexedDB.result;
        let transaction;
        flag = false;
        while (!flag) {
          transaction = db.transaction([OBJ_STORE_NAME], 'readwrite');
          if (transaction) {
            flag = true;
          }
        }

        const objectStore = transaction.objectStore(OBJ_STORE_NAME);
        const objectStoreRequest = objectStore.getAllKeys();
        objectStoreRequest.onsuccess = function () {
          // report the success of our request
          db.close();
          resolve(objectStoreRequest.result);
        };
      };
    }).then(async res => {
      mnemonic = '';
      if (
        await isCommitmentsCPKDMatchDerivedKeys(
          res,
          await getIndexedDBObjectRowsFromBackupFile(backupFile, 'commitments'),
        )
      ) {
        setIndexedDBObjectsStore();
        props.setIsWalletRecovered(true);
        props.setShowWalletRecoveredModal(true);
        props.onHide();
      } else {
        clearSiteData('nightfall_commitments');
        props.setIsWalletRecovered(false);
        props.setShowWalletRecoveredModal(true);
        props.onHide();
      }
    });
  };

  const updateState = async (event, indexRow, indexColumn) => {
    await new Promise(resolve => {
      setMnemonicRecArray(prevState => {
        const newStateRow = prevState.map((objRow, indexR) => {
          if (indexR === indexRow) {
            const newCol = objRow.map((obj, indexC) => {
              if (indexC === indexColumn) {
                return { ...obj, word: event.target.value };
              }
              return { ...obj };
            });
            return newCol;
          }
          return objRow;
        });
        return newStateRow;
      });
      resolve(true);
    });
  };

  const verifyMnemonic = async () => {
    setIsMnemonicValid(validateMnemonic(await concatAllWords()));
  };

  return (
    <Modal {...props} size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          {isNewWallet && <h3>Create a new Polygon Nightfall Wallet</h3>}
          {!isNewWallet && <h3>Recover your Polygon Nightfall Wallet</h3>}
          <div style={{ marginTop: '20px', marginBottom: '10px' }}>
            <Button
              style={{ backgroundColor: isNewWallet ? '#7b3fe4' : '#997bcf', border: '0px' }}
              onClick={() => {
                setScreenMnemonic(generateMnemonic());
                setIsNewWallet(true);
              }}
            >
              Generate Mnemonic
            </Button>
            <Button
              style={{
                marginLeft: '10px',
                backgroundColor: !isNewWallet ? '#7b3fe4' : '#997bcf',
                border: '0px',
              }}
              onClick={() => {
                setIsNewWallet(false);
              }}
            >
              Recover Wallet
            </Button>
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isNewWallet && (
          <p>
            Polygon Nightfall accounts are protected by a 12 word mnemonic. It is important that you
            securely store these words. Losing access to these words will result in a loss of access
            to your funds. Do not reveal them to anyone.
          </p>
        )}
        {!isNewWallet && (
          <p
            style={{
              padding: '0px 8px',
            }}
          >
            Polygon Nightfall accounts are protected by a 12 word mnemonic.{' '}
            <b>Insert the words that you have securely storeds and select your backup file.</b>
          </p>
        )}
        <Container style={{ display: 'inline-block', margin: '0' }}>
          {[0, 1].map(r => (
            <Row key={r}>
              {[0, 1, 2, 3, 4, 5].map(c => (
                <Col key={c}>
                  <InputGroup className="mb-3">
                    {isNewWallet && (
                      <FormControl
                        readOnly
                        value={
                          typeof screenMnemonic !== 'undefined'
                            ? screenMnemonic.split(' ')[r * 5 + (r === 0 ? c : c + 1)]
                            : ''
                        }
                        aria-label="Recipient's username"
                        aria-describedby="basic-addon2"
                      />
                    )}
                    {!isNewWallet && (
                      <input
                        onChange={e => updateState(e, r, c)}
                        onBlur={() => verifyMnemonic()}
                        style={{
                          width: '100px',
                          height: '40px',
                          borderRadius: '5px',
                          padding: '5px 10px',
                        }}
                        type={true && 'text'}
                      ></input>
                    )}
                  </InputGroup>
                </Col>
              ))}
            </Row>
          ))}
        </Container>
        {!isNewWallet && (
          <input
            type="file"
            id="myfile"
            name="myfile"
            accept=".json"
            onChange={e => uploadBackupFile(e)}
            style={{
              borderRadius: '3px',
              padding: '20px 8px 0',
              outline: 'none',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              textShadow: '1px 1px #fff',
              fontWeight: '500',
              fontSize: '12pt',
            }}
          />
        )}
        <div style={{ margin: '15px 0 0 10px' }}>
          {!isMnemonicValid && !isNewWallet && (
            <p style={{ margin: '5px 0 0 10px', color: 'red' }}>Insert a valid mnemonic, please.</p>
          )}
          {!backupFile && !isNewWallet && (
            <p style={{ margin: '10px 0 0 10px', color: 'red' }}>
              Choose a valid backup file, please.
            </p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {isNewWallet && (
          <Button
            onClick={async () => {
              // await configureMnemonic(screenMnemonic);
              await deriveAccounts(screenMnemonic, DEFAULT_ACCOUNT_NUM);
              setScreenMnemonic('');
              props.onHide();
            }}
            style={{ backgroundColor: '#7b3fe4', border: '0px' }}
            disabled={typeof screenMnemonic === 'undefined'}
          >
            Create Wallet
          </Button>
        )}
        {!isNewWallet && (
          <Button
            onClick={async () => {
              // await configureMnemonic(screenMnemonic);
              recoverWallet();
            }}
            style={{ backgroundColor: '#7b3fe4', border: '0px' }}
          >
            Recover
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

function RecoveredWalletModal(props) {
  return (
    <Modal {...props} size="md" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Body>
        <div
          style={{
            marginTop: '15px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {props.isRecovered && (
            <h5
              style={{
                marginLeft: '15px',
              }}
            >
              Your wallet has been successfully recovered!
            </h5>
          )}
          {!props.isRecovered && (
            <h5
              style={{
                marginLeft: '15px',
              }}
            >
              Your commitments do not match with your mnemonic. Please insert other mnemonic or
              generate a new wallet!
            </h5>
          )}
          {props.isRecovered && (
            <img
              style={{
                marginTop: '15px',
              }}
              src={successHand}
              alt="transfer completed"
            />
          )}
          {!props.isRecovered && (
            <Lottie
              style={{
                marginTop: '15px',
              }}
              animationData={checkMarkCross}
            />
          )}
          {props.isRecovered && (
            <Button
              onClick={async () => {
                props.onHide();
              }}
              style={{
                marginTop: '30px',
                width: '100px',
                backgroundColor: '#7b3fe4',
                border: '0px',
              }}
            >
              Ok
            </Button>
          )}
          {!props.isRecovered && (
            <Button
              onClick={async () => {
                props.onHide();
                props.setShowModal(true);
                window.location.reload();
              }}
              style={{
                marginTop: '30px',
                width: '100px',
                backgroundColor: '#7b3fe4',
                border: '0px',
              }}
            >
              Ok
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default function Wallet() {
  const { setAccountInstance } = useAccount();
  const initialPrices = {};
  supportedTokens.forEach(t => {
    initialPrices[t.id] = 0;
  }, {});

  const [currencyValues, setCurrencyValues] = useState({ now: 0, ...initialPrices });

  const initialTokenState = supportedTokens.map(t => {
    return {
      l2Balance: '0',
      currencyValue: currencyValues[t.id],
      ...t,
    };
  });
  const [tokens, setTokens] = useState(initialTokenState);
  const [state] = useContext(UserContext);
  const [modalShow, setModalShow] = useState(false);
  const [showWalletRecoveredModal, setShowWalletRecoveredModal] = useState(false);
  const [delay, setDelay] = React.useState(50);
  const [isWalletRecoverd, setIsWalletRecovered] = useState(false);

  useEffect(async () => {
    const web3 = Web3.connection();
    const accounts = await web3.eth.getAccounts();
    setAccountInstance({
      address: accounts[0],
    });
    ethereum.on('accountsChanged', ([account]) => {
      setAccountInstance({
        address: account,
      });
    });
    return () => {
      ethereum.removeListener('accountsChanged', ([account]) => {
        setAccountInstance({
          address: account,
        });
      });
    };
  }, []);

  useEffect(async () => {
    const zkpPubKeysDerived = Storage.ZkpPubKeyArrayGet('');
    if (state.compressedZkpPublicKey === '' && !zkpPubKeysDerived) setModalShow(true);
    else setModalShow(false);
  }, []);

  useEffect(async () => {
    if (!Storage.getPricing()) await Storage.setPricing(supportedTokens.map(t => t.id));
    else if (Date.now() - Storage.getPricing().time > 86400)
      await Storage.setPricing(supportedTokens.map(t => t.id));
    setCurrencyValues(Storage.getPricing);
  }, []);

  useInterval(async () => {
    const l2BalanceObj = await getWalletBalance(state.compressedZkpPublicKey);
    const updatedState = await Promise.all(
      tokens.map(async t => {
        const currencyValue = currencyValues[t.id];
        if (Object.keys(l2BalanceObj).includes(state.compressedZkpPublicKey)) {
          const token = l2BalanceObj[state.compressedZkpPublicKey][t.address.toLowerCase()] ?? 0;
          return {
            ...t,
            l2Balance: token.toString(),
            currencyValue,
          };
        }
        return t;
      }),
    );
    setTokens(updatedState);
    setDelay(10000);
  }, delay);

  return (
    <div>
      {process.env.REACT_APP_MODE === 'local' ? <Header /> : <></>}
      <div className="wallet">
        <div className="walletComponents">
          <div className="walletComponents__left">
            <SideBar />
          </div>
          <div className="walletComponents__right">
            <Assets tokenList={tokens} />
            <Tokens tokenList={tokens} />
          </div>
        </div>
        <div>
          <WalletModal
            show={modalShow}
            onHide={() => {
              setModalShow(false);
            }}
            setIsWalletRecovered={setIsWalletRecovered}
            setShowWalletRecoveredModal={setShowWalletRecoveredModal}
          />
          <RecoveredWalletModal
            show={showWalletRecoveredModal}
            isRecovered={isWalletRecoverd}
            setShowModal={setModalShow}
            onHide={() => {
              setShowWalletRecoveredModal(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
  setIsWalletRecovered: PropTypes.func.isRequired,
  setShowWalletRecoveredModal: PropTypes.func.isRequired,
};

RecoveredWalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
  isRecovered: PropTypes.bool,
  setShowModal: PropTypes.func.isRequired,
};
