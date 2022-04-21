import React, { useState, useEffect, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { FiSearch } from 'react-icons/fi';
import axios from 'axios';
import tokensList from './Bridge/TokensList/tokensList';
import stylesModal from '../../styles/modal.module.scss';
import { UserContext } from '../../hooks/User';
import maticImg from '../../assets/img/polygon-chain.svg';
import transfer from '../../nightfall-browser/services/transfer';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import { getContractAddress } from '../../common-files/utils/contract';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';
import styles from '../../styles/bridge.module.scss';
import approveImg from '../../assets/img/modalImages/adeposit_approve1.png';
import depositConfirmed from '../../assets/img/modalImages/adeposit_confirmed.png';
import successHand from '../../assets/img/modalImages/success-hand.png';
import transferCompletedImg from '../../assets/img/modalImages/tranferCompleted.png';
import { saveTransaction } from '../../nightfall-browser/services/database';
import BigFloat from '../../common-files/classes/bigFloat';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { proposerUrl } = global.config;

type SendModalProps = {
  currencyValue: number;
  l2Balance: string;
  name: string;
  symbol: string;
  address: string;
  logoURI: string;
  decimals: number;
  show: boolean;
  onHide: () => void;
};

const SendModal = (props: SendModalProps): JSX.Element => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const [state] = useContext(UserContext); // Why does typescript think this is an object?
  const [valueToSend, setTransferValue] = useState(0);
  const [recipient, setRecipient] = useState('');
  const { onHide, show, ...initialSendToken } = props;
  const [sendToken, setSendToken] = useState(initialSendToken);
  const [filteredTokens, setFilteredTokens] = useState(
    tokensList.tokens.map(({ name, symbol, address, logoURI, decimals }) => {
      return {
        name,
        symbol,
        address,
        logoURI,
        decimals,
        currencyValue: 0,
        l2Balance: '0',
      };
    }),
  );
  const [l2Balance, setL2Balance] = useState(0n);
  const [showTokensListModal, setShowTokensListModal] = useState(false);

  const filterTxs = (criteria: string) =>
    tokensList.tokens
      .filter(t => t.name.toLowerCase().includes(criteria))
      .map(({ name, symbol, address, logoURI, decimals }) => {
        return {
          name,
          symbol,
          address,
          logoURI,
          decimals,
          currencyValue: 0,
          l2Balance: '0',
        };
      });

  useEffect(() => {
    console.log('state', state);
    const getBalance = async () => {
      const l2bal: Record<string, Record<string, bigint>> = await getWalletBalance(
        state?.compressedPkd,
      );
      if (Object.hasOwnProperty.call(l2bal, state?.compressedPkd))
        setL2Balance(l2bal[state.compressedPkd][sendToken.address.toLowerCase()] ?? 0n);
      else setL2Balance(0n);
    };
    getBalance();
  }, [sendToken, state]);

  const [showModalConfirm, setShowModalConfirm] = useState(false);
  const [showModalTransferInProgress, setShowModalTransferInProgress] = useState(true);
  const [showModalTransferEnRoute, setShowModalTransferEnRoute] = useState(false);
  const [showModalTransferConfirmed, setShowModalTransferConfirmed] = useState(false);
  // const [showTransferModal, setShowTransferModal] = useState(false);

  const [readyTx, setReadyTx] = useState({ type: '', rawTransaction: '', transaction: {} });
  const [shieldContractAddress, setShieldAddress] = useState('');

  function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // TODO Make this dependent on proof generation time.
  const handleCloseConfirmModal = () => {
    setShowModalConfirm(false);
    setShowModalTransferInProgress(false);
    setShowModalTransferEnRoute(false);
    setShowModalTransferConfirmed(false);
  };
  // const handleClose = () => setShowTransferModal(false);

  async function submitTx() {
    console.log('readyTx', readyTx);
    console.log('submitTx State', state);
    try {
      switch (readyTx.type) {
        case 'offchain':
          await axios
            .post(
              `${proposerUrl}/proposer/offchain-transaction`,
              { transaction: readyTx.transaction },
              { timeout: 3600000 },
            )
            .catch(err => {
              throw new Error(err);
            });
          break;
        default:
          console.log('Error when sending');
      }
      await saveTransaction(readyTx.transaction);
      props.onHide();
      handleCloseConfirmModal();
      return true;
    } catch (error) {
      props.onHide();
      handleCloseConfirmModal();
      return false;
    }
  }

  useEffect(() => {
    const getShieldAddress = async () => {
      const { address } = (await getContractAddress('Shield')).data;
      setShieldAddress(address);
    };
    getShieldAddress();
  }, []);

  async function sendTx() {
    if (shieldContractAddress === '')
      setShieldAddress((await getContractAddress('Shield')).data.address);
    setShowModalConfirm(true);
    setShowModalTransferInProgress(true);
    const { nsk, ask } = await retrieveAndDecrypt(state.compressedPkd);
    await timeout(2000);
    setShowModalTransferInProgress(false);
    setShowModalTransferEnRoute(true);
    // const { address } = (await getContractAddress('ERC20Mock')).data; // TODO Only for testing now
    const { transaction, rawTransaction } = await transfer(
      {
        offchain: true,
        ercAddress: sendToken.address,
        tokenId: 0,
        recipientData: {
          recipientCompressedPkds: [recipient],
          values: [new BigFloat(valueToSend, sendToken.decimals).toBigInt().toString()],
        },
        nsk,
        ask,
        fee: 1,
      },
      shieldContractAddress,
    );
    setShowModalTransferEnRoute(false);
    setShowModalTransferConfirmed(true);
    return {
      type: 'offchain',
      transaction,
      rawTransaction,
    };
  }

  return (
    <>
      <Modal contentClassName={stylesModal.modalFather} show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>Send</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {showTokensListModal ? (
            <div className={stylesModal.modalBody}>
              <div className={stylesModal.sendModal}>
                <p className="input_search_title">
                  Choose token from <span>Ethereum</span>
                </p>
                <div className="input_wrapper">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="Search here"
                    onChange={e => setFilteredTokens(filterTxs(e.target.value.toLowerCase()))}
                  />
                </div>
                <ul className="tokens_list">
                  {filteredTokens.map((token, index) => (
                    <li
                      className="tokens_line"
                      key={index}
                      onClick={() => {
                        setSendToken(token);
                        setShowTokensListModal(false);
                      }}
                    >
                      <div>
                        <img src={token.logoURI} alt="token image" />
                        <p>{token.name}</p>
                      </div>
                      <p>Balance</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className={stylesModal.modalBody}>
              <div className={stylesModal.sendModal}>
                <div>
                  <input
                    type="text"
                    placeholder="Enter a Nightfall Address"
                    onChange={e => setRecipient(e.target.value)}
                    id="TokenItem_modalSend_compressedPkd"
                  />
                  <p>Enter a valid address existing on the Polygon Nightfall L2</p>
                </div>
                <div className={stylesModal.sendModalBalance}>
                  <div className={stylesModal.letfItems}>
                    <input
                      type="text"
                      placeholder="0.00"
                      onChange={e => setTransferValue(Number(e.target.value))}
                      id="TokenItem_modalSend_tokenAmount"
                    />
                    <div className={stylesModal.maxButton}>MAX</div>
                  </div>
                  <div
                    className={stylesModal.rightItems}
                    onClick={() => setShowTokensListModal(true)}
                    id="TokenItem_modalSend_tokenName"
                  >
                    <img src={sendToken.logoURI} alt="matic" />
                    <div>{sendToken.symbol}</div>
                    <AiOutlineDown />
                  </div>
                </div>
                <div className={stylesModal.balanceText}>
                  <p>
                    ${' '}
                    {new BigFloat(l2Balance, sendToken.decimals)
                      .mul(sendToken.currencyValue)
                      .toFixed(4)}
                  </p>
                  <div className={stylesModal.right}>
                    <p>Available Balance:</p>
                    <p>
                      {new BigFloat(l2Balance, sendToken.decimals).toFixed(4)} {sendToken.symbol}
                    </p>
                  </div>
                </div>

                <div className={stylesModal.sendModalfooter}>
                  <img src={maticImg} alt="matic icon" />
                  <p className={stylesModal.gasFee}> 0.00 Matic Transfer Fee</p>
                </div>
              </div>
              <button
                type="button"
                className={stylesModal.continueTrasferButton}
                onClick={async () => {
                  props.onHide();
                  setShowModalConfirm(true);
                  setShowModalTransferInProgress(true);
                  setReadyTx(await sendTx());
                }}
              >
                Continue
              </button>
            </div>
          )}
        </Modal.Body>
      </Modal>
      <Modal
        contentClassName={stylesModal.modalFather}
        show={showModalConfirm}
        onHide={handleCloseConfirmModal}
      >
        <Modal.Header closeButton>
          <div className={styles.modalTitle}>Transfer in progress</div>
        </Modal.Header>
        {showModalTransferInProgress && (
          <Modal.Body>
            <div className={stylesModal.modalBody}>
              <div className={styles.processImages}>
                <img src={approveImg} alt="approve" />
              </div>
              <div className={stylesModal.divider} />
              <div className={styles.spinnerBox}>
                <div className={styles.spinnerBoard}>
                  <div className={styles.spinner} />
                </div>
              </div>

              <div className={stylesModal.transferModeModal}>
                <h3>Creating Transaction</h3>
                <div className={stylesModal.modalText}>
                  Retrieving your commitments and generating transaction inputs.
                </div>
                {/* <a className={styles.footerText}>View on etherscan</a> */}
              </div>
            </div>
          </Modal.Body>
        )}

        {showModalTransferEnRoute && (
          <Modal.Body>
            <div className={stylesModal.modalBody}>
              <div className={styles.processImages}>
                <img src={depositConfirmed} alt="deposit confirmed" />
              </div>
              <div className={stylesModal.divider} />
              <div className={styles.spinnerBox}>
                <div className={styles.spinnerBoard}>
                  <div className={styles.spinner} />
                </div>
              </div>
              <div className={stylesModal.transferModeModal}>
                <h3>Generating Zk Proof</h3>
                <div className={stylesModal.modalText}>
                  Proof generation may take up to 2 mins to complete. Do not navigate away.
                </div>
                {/* <a className={styles.footerText}>View on etherscan</a> */}
              </div>
            </div>
          </Modal.Body>
        )}

        {showModalTransferConfirmed && (
          <Modal.Body>
            <div className={stylesModal.modalBody}>
              <div className={styles.processImages}>
                <img src={transferCompletedImg} alt="transfer completed" />
              </div>
              <div className={stylesModal.divider} />
              <div className={styles.spinnerBox}>
                <img src={successHand} alt="success hand" />
              </div>
              <div className={stylesModal.transferModeModal} id="Bridge_modal_success">
                <h3>Transaction created sucessfully.</h3>
                <div className={stylesModal.modalText}>Your transfer is ready to send.</div>
                <button
                  type="button"
                  className={stylesModal.continueTrasferButton}
                  id="Bridge_modal_continueTransferButton"
                  onClick={() => submitTx()}
                >
                  Send Transaction
                </button>
                {/* <a className={styles.footerText}>View on etherscan</a> */}
              </div>
            </div>
          </Modal.Body>
        )}
      </Modal>
    </>
  );
};

export default SendModal;
