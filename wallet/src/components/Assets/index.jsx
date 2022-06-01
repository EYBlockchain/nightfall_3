import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import { Modal } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Lottie from 'lottie-react';
import { RiQrCodeLine } from 'react-icons/ri';
import { FiSend } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import styled from 'styled-components';
import { UserContext } from '../../hooks/User';
import checkMarkYes from '../../assets/lottie/check-mark-yes.json';
import SendModal from '../Modals/sendModal';

import Dexie from 'dexie';
import { importDB, exportDB } from 'dexie-export-import';
import * as fs from 'fs';

import '../../styles/assets.scss';

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const HeaderTitle = styled.p`
  left: 17.08%;
  right: 16.18%;
  top: 36.36%;
  bottom: 36.36%;

  margin: 12px 0;

  /* Header/H5 */

  font-style: normal;
  font-weight: bold;
  font-size: 18px;
  /* identical to box height, or 150% */

  text-align: center;
  letter-spacing: 0.01em;

  /* Dark_Gray_700 */

  color: #061024;
`;

const MyBody = styled.div`
  text-align: center;
  width: 100%;

  div {
    margin-top: 48px;
  }

  p {
    margin-top: 32px;
    font-size: 14px;
    color: #3b465c;
    margin-bottom: 10px;
  }

  span {
    font-size: 15px;
    font-weight: bold;
  }
`;

const MyFooter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  text-align: center;
`;

const QrCodeButton = styled.button`
  color: #fff;
  background-color: #854ce6;
  display: block;
  width: 100%;
  border: 0 !important;
  cursor: pointer;
  outline: none;
  border: none;

  margin-top: 2%;
  padding: 20px;

  &:focus,
  &:active,
  &.focus,
  &.active,
  &:hover {
    cursor: pointer;
    color: #fff;
    background-color: #854ce6;
    box-shadow: none !important;
    outline: none;
    border: none;
  }
`;

function ReceiveModal(props) {
  const [state] = useContext(UserContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied)
      setTimeout(() => {
        setCopied(false);
      }, 1500);
  }, [copied]);

  return (
    <div>
      <Modal
        size="lg"
        dialogClassName="modal-90w"
        centered
        className="modal_wrapper"
        show
        {...props}
      >
        <Modal.Header closeButton>
          <Header>
            <HeaderTitle>Receive on Polygon Nightfall</HeaderTitle>
          </Header>
        </Modal.Header>
        <Modal.Body style={{ padding: '0px' }}>
          <MyBody>
            <div>
              <QRCode value={state.compressedPkd} />
            </div>
            <p>Wallet Address</p>
            <span>{state.compressedPkd}</span>
            {copied ? (
              <MyFooter>
                <Lottie
                  style={{ height: '32px', width: '32px', margin: '20px' }}
                  animationData={checkMarkYes}
                  loop
                />
              </MyFooter>
            ) : (
              <CopyToClipboard text={state.compressedPkd} onCopy={() => setCopied(true)}>
                <MyFooter>
                  <QrCodeButton>Copy Address</QrCodeButton>
                </MyFooter>
              </CopyToClipboard>
            )}
          </MyBody>
        </Modal.Body>
      </Modal>
    </div>
  );
}
export default function Assets({ tokenList }) {
  const [modalShow, setModalShow] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const tokenDepositId = `TokenItem_tokenDeposit${tokenList[0].symbol}`;
  const total = tokenList.reduce(
    (acc, curr) =>
      acc + (Number(curr.currencyValue) * Number(curr.l2Balance)) / 10 ** Number(curr.decimals),
    0,
  );

  const exportDB = async () => {
    const db = await new Dexie('nightfall_commitments').open();
    console.log('DB: ', db);
    const exportedDB = await exportIndexdDB(db);
    const filteredTables = exportedDB.filter(
      arr => arr.table === 'commitments' || arr.table === 'transactions',
    );
    const stringfy = JSON.stringify(filteredTables);
    download(stringfy);
  };

  function download(content) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    a.href = URL.createObjectURL(file);
    a.download = 'json-file-name.json';
    a.click();
  }

  function exportIndexdDB(db) {
    return db.transaction('r', db.tables, () => {
      return Promise.all(
        db.tables.map(table => table.toArray().then(rows => ({ table: table.name, rows: rows }))),
      );
    });
  }

  /**
   *
   * @param {*} objectRecovered the object converted from the backup.
   * file uploaded.
   * @param {*} objectStoreName the name of indexedDB database objectStore.
   * @description get the rows from the objectsStore recovered from the
   * backup file.
   * @returns promise of array of rows.
   */
  const getIndexedDBObjectRowsFromBackupFile = (objectRecovered, objectStoreName) => {
    return new Promise((resolve, reject) => {
      try {
        resolve(objectRecovered.filter(obj => obj.table === objectStoreName)[0].rows);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   *
   * @param {File} file
   * @description read the content of the file got, and convert this
   * in a object.
   * @returns {Promise<object>} Promise of object
   */
  const convertFileToObject = file => {
    return new Promise((resolve, reject) => {
      try {
        let objectRecovered;
        const reader = new FileReader();
        reader.onload = async e => {
          const fileText = e.target.result;
          objectRecovered = JSON.parse(fileText);
          resolve(objectRecovered);
        };
        reader.readAsText(file);
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   *
   * @param {*} event
   * @description got the file choosen by the input for upload
   * file and handle the import commitments and backup flow.
   */
  const handleImportCommitmentsAndTransactionsFlow = async event => {
    event.preventDefault();
    let objectRecovered = await convertFileToObject(event.target.files[0]);
    console.log('OBJ REC: ', objectRecovered);
    let commitments = await getIndexedDBObjectRowsFromBackupFile(objectRecovered, 'commitments');
    await addObjectStoreToIndexedDB(commitments, 'commitments');
    let transactions = await getIndexedDBObjectRowsFromBackupFile(objectRecovered, 'transactions');
    await addObjectStoreToIndexedDB(transactions, 'transactions');
  };

  const addObjectStoreToIndexedDB = (arrayOfObjects, nameOfObjectStore) => {
    return new Promise((resolve, reject) => {
      const myIndexedDB = indexedDB.open('nightfall_commitments', 1);

      myIndexedDB.onerror = function () {
        reject(myIndexedDB.error);
      };

      myIndexedDB.onsuccess = function () {
        let db = myIndexedDB.result;
        arrayOfObjects.map((obj, index) => {
          console.log(`OBJ ${index}: ${obj}`);
          let transaction = db.transaction([nameOfObjectStore], 'readwrite');
          console.log('DB TRANSACTION: ', transaction);
          let objStore = transaction.objectStore(nameOfObjectStore);
          console.log(`${nameOfObjectStore}: ${objStore}`);

          let request = objStore.add(obj, obj._id); // (3)

          request.onsuccess = function () {
            console.log(`${nameOfObjectStore} added to the store ${request.result}`);
          };

          request.onerror = function () {
            reject(`Error, ${request.error}`);
          };
        });
        db.close();
        resolve(true);
      };
    });
  };

  return (
    <div className="dashboardTopSection">
      <div className="container">
        <div className="containerLeftSide">
          <div className="heading">Polygon Nightfall</div>
          <div className="amount">&#36;{total.toFixed(2)}</div>
          <div className="buttonsWrapper">
            <button type="button" onClick={() => setModalShow(true)}>
              <RiQrCodeLine />
              <span>Receive</span>
            </button>
            <button type="button" icon-name="navbar/send" onClick={() => setShowSendModal(true)}>
              <FiSend />
              <span>Send</span>
            </button>
          </div>
        </div>

        <div className="depositWrapper">
          <a
            className="linkButton"
            href="https://docs.polygon-nightfall.technology/Nightfall/tools/nightfall-wallet/"
            target="_blank"
            rel="noopener noreferrer"
          >
            How it works?
          </a>

          <button type="button" className="linkButton" onClick={() => {}}>
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenAddress: tokenList[0].address,
                  initialTxType: 'deposit',
                },
              }}
              id={tokenDepositId}
            >
              <span>Move funds from Ethereum to Nightfall</span>
            </Link>
          </button>
        </div>
        <button onClick={() => exportDB()}>Download</button>
        <input
          type="file"
          id="myfile"
          name="myfile"
          onChange={e => handleImportCommitmentsAndTransactionsFlow(e)}
        />
      </div>
      <ReceiveModal show={modalShow} onHide={() => setModalShow(false)} />
      <SendModal
        show={showSendModal}
        onHide={() => setShowSendModal(false)}
        currencyValue={tokenList[0].currencyValue}
        l2Balance={tokenList[0].l2Balance}
        name={tokenList[0].name}
        symbol={tokenList[0].symbol}
        address={tokenList[0].address}
        logoURI={tokenList[0].logoURI}
        decimals={tokenList[0].decimals}
      />
    </div>
  );
}

Assets.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
