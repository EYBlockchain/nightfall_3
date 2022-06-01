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

import '../../styles/assets.scss';
import { exportIndexdDB } from '../../useCases/CommitmentsBackup/export';
import {
  getIndexedDBObjectRowsFromBackupFile,
  convertFileToObject,
  addObjectStoreToIndexedDB,
} from '../../useCases/CommitmentsBackup/import';

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
    await addObjectStoreToIndexedDB('nightfall_commitments', commitments, 'commitments');
    let transactions = await getIndexedDBObjectRowsFromBackupFile(objectRecovered, 'transactions');
    await addObjectStoreToIndexedDB('nightfall_commitments', transactions, 'transactions');
  };

  const handleExportIndedexDB = async () => {
    const exportedDB = await exportIndexdDB('nightfall_commitments');
    const filteredTables = exportedDB.filter(
      arr => arr.table === 'commitments' || arr.table === 'transactions',
    );
    downloadFile(JSON.stringify(filteredTables));
  };

  function downloadFile(content) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    a.href = URL.createObjectURL(file);
    a.download = 'json-file-name.json';
    a.click();
  }

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
        <button onClick={() => handleExportIndedexDB()}>Download</button>
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
