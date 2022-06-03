import React, { useEffect, useState, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import PropTypes from 'prop-types';
import Button from 'react-bootstrap/Button';
import { generateMnemonic } from 'bip39';
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
} from '../../useCases/CommitmentsBackup/import';
import { exportIndexdDB } from '../../useCases/CommitmentsBackup/export.js';

const supportedTokens = importTokens();

const { DEFAULT_ACCOUNT_NUM } = global.config;

const { ethereum } = global;

/**
This is a modal to detect if a wallet has been initialized
*/

function WalletModalRecover(props) {
  const [, , deriveAccounts] = useContext(UserContext);
  const [objectStore, setObjectStore] = useState();
  const [backupFile, setBackupFile] = useState();
  const [mnemonicRecArray, setMnemonicRecArray] = useState([
    [
      { id: 0, word: '' },
      { id: 1, word: '' },
      { id: 2, word: '' },
      { id: 3, word: '' },
    ],
    [
      { id: 4, word: '' },
      { id: 5, word: '' },
      { id: 6, word: '' },
      { id: 7, word: '' },
    ],
    [
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
    let objectRecovered = await convertFileToObject(event.target.files[0]);
    setBackupFile(objectRecovered);
  };

  const concatAllWords = () => {
    return new Promise(resolve => {
      let mnemonic = '';
      mnemonicRecArray.map((objRow, indexR) => {
        objRow.map((objCol, indexC) => {
          if (indexR === mnemonicRecArray.length - 1 && indexC === objRow.length - 1) {
            mnemonic = mnemonic + objCol.word;
          } else {
            mnemonic = mnemonic + objCol.word + ' ';
          }
        });
      });
      resolve(mnemonic);
    });
  };

  const recoverWallet = async () => {
    let mnemonic = await concatAllWords();
    await deriveAccounts(mnemonic, DEFAULT_ACCOUNT_NUM);

    /**
     * TODO
     * Conditional to verify if the commitments keys match with the keys derivated
     * from the mnemonic
     */
    // new Promise(async resolve => {
    //   let flag = false;
    //   let myIndexedDB;

    //   while (!flag) {
    //     try {
    //       myIndexedDB = indexedDB.open('nightfall_commitments', 1);
    //       flag = true;
    //     } catch (e) {
    //       flag = false;
    //     }
    //   }

    //   myIndexedDB.onerror = function () {
    //     reject(myIndexedDB.error);
    //   };

    //   flag = false;

    //   const db = myIndexedDB.result;
    //   let objStore;
    //   while (!flag) {
    //     if (db.transaction(['keys'], 'readwrite').objectStore('keys')) {
    //       resolve(db.transaction(['keys'], 'readwrite').objectStore('keys'));
    //       console.log('E AQUI NADA?? ', db.transaction(['keys'], 'readwrite').objectStore('keys'));
    //       flag = true;
    //     }
    //   }
    // }).then(res => console.log('ESSA::::: ', objectStore));
    setIndexedDBObjectsStore();
  };

  const setIndexedDBObjectsStore = async () => {
    let commitments = await getIndexedDBObjectRowsFromBackupFile(backupFile, 'commitments');
    await addObjectStoreToIndexedDB('nightfall_commitments', commitments, 'commitments');
    let transactions = await getIndexedDBObjectRowsFromBackupFile(backupFile, 'transactions');
    await addObjectStoreToIndexedDB('nightfall_commitments', transactions, 'transactions');
  };

  const updateState = (event, indexRow, indexColumn) => {
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
  };

  return (
    <Modal {...props} size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Recover your Polygon Nightfall Wallet
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p
          style={{
            padding: '0px 8px',
          }}
        >
          Polygon Nightfall accounts are protected by a 12 word mnemonic. Insert the words that you
          have securely storeds and select your backup file.
        </p>
        <Container style={{ display: 'inline-block', margin: '0' }}>
          {[0, 1, 2].map(r => (
            <Row key={r}>
              {[0, 1, 2, 3].map(c => (
                <Col key={c}>
                  <InputGroup className="mb-3">
                    <input
                      onChange={e => updateState(e, r, c)}
                      style={{ width: '130px' }}
                      type={true && 'text'}
                    ></input>
                  </InputGroup>
                </Col>
              ))}
            </Row>
          ))}
        </Container>
        {/* <Button onClick={() => setScreenMnemonic(generateMnemonic())}>Recover</Button> */}
        <input
          type="file"
          id="myfile"
          name="myfile"
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
      </Modal.Body>
      <Modal.Footer>
        <Button
          style={{ backgroundColor: '#7b3fe4', border: '0px' }}
          onClick={() => {
            // await configureMnemonic(screenMnemonic);
            recoverWallet();
            props.onHide();
          }}
        >
          Recover Wallet
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function WalletModal(props) {
  const [, , deriveAccounts] = useContext(UserContext);
  const [screenMnemonic, setScreenMnemonic] = useState();
  return (
    <Modal {...props} size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Create a new Polygon Nightfall Wallet
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Polygon Nightfall</h4>
        <p>
          Polygon Nightfall accounts are protected by a 12 word mnemonic. It is important that you
          securely store these words. Losing access to these words will result in a loss of access
          to your funds. Do not reveal them to anyone.
        </p>
        <Container style={{ display: 'inline-block', margin: '0' }}>
          {[0, 1].map(r => (
            <Row key={r}>
              {[0, 1, 2, 3, 4, 5].map(c => (
                <Col key={c}>
                  <InputGroup className="mb-3">
                    <FormControl
                      value={
                        typeof screenMnemonic !== 'undefined'
                          ? screenMnemonic.split(' ')[r * 5 + (r === 0 ? c : c + 1)]
                          : ''
                      }
                      readOnly
                      aria-label="Recipient's username"
                      aria-describedby="basic-addon2"
                    />
                  </InputGroup>
                </Col>
              ))}
            </Row>
          ))}
        </Container>
        <Button onClick={() => setScreenMnemonic(generateMnemonic())}>Generate Mnemonic</Button>
        <Button
          style={{ marginLeft: '10px' }}
          onClick={() => {
            props.onHide();
          }}
        >
          Recover Wallet
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={async () => {
            // await configureMnemonic(screenMnemonic);
            console.log('SCREEN MNEMO: ', screenMnemonic);
            await deriveAccounts(screenMnemonic, DEFAULT_ACCOUNT_NUM);
            props.onHide();
          }}
          disabled={typeof screenMnemonic === 'undefined'}
        >
          Create Wallet
        </Button>
      </Modal.Footer>
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
  const [modalRecoverShow, setModalRecoverShow] = useState(false);
  const [delay, setDelay] = React.useState(50);

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
    const pkdsDerived = Storage.pkdArrayGet('');
    if (state.compressedPkd === '' && !pkdsDerived) setModalShow(true);
    else setModalShow(false);
  }, []);

  useEffect(async () => {
    if (!Storage.getPricing()) await Storage.setPricing(supportedTokens.map(t => t.id));
    else if (Date.now() - Storage.getPricing().time > 86400)
      await Storage.setPricing(supportedTokens.map(t => t.id));
    setCurrencyValues(Storage.getPricing);
  }, []);

  useInterval(async () => {
    const l2BalanceObj = await getWalletBalance(state.compressedPkd);
    const updatedState = await Promise.all(
      tokens.map(async t => {
        const currencyValue = currencyValues[t.id];
        if (Object.keys(l2BalanceObj).includes(state.compressedPkd)) {
          const token = l2BalanceObj[state.compressedPkd][t.address.toLowerCase()] ?? 0;
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
              setModalRecoverShow(true);
            }}
          />
          <WalletModalRecover show={modalRecoverShow} onHide={() => setModalRecoverShow(false)} />
        </div>
      </div>
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
};
