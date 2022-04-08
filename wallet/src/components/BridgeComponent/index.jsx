import React, { useContext, useState, useCallback, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import { MdArrowForwardIos } from 'react-icons/md';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import styles from '../../styles/bridge.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import ethChainImage from '../../assets/img/ethereum-chain.svg';
import polygonNightfall from '../../assets/svg/polygon-nightfall.svg';
import discloserBottomImage from '../../assets/img/discloser-bottom.svg';
import lightArrowImage from '../../assets/img/light-arrow.svg';
import { approve, getContractAddress, submitTransaction } from '../../common-files/utils/contract';
import Web3 from '../../common-files/utils/web3';
import deposit from '../../nightfall-browser/services/deposit';
import withdraw from '../../nightfall-browser/services/withdraw';
import approveImg from '../../assets/img/modalImages/adeposit_approve1.png';
import depositConfirmed from '../../assets/img/modalImages/adeposit_confirmed.png';
import successHand from '../../assets/img/modalImages/success-hand.png';
import transferCompletedImg from '../../assets/img/modalImages/tranferCompleted.png';
import { UserContext } from '../../hooks/User/index.jsx';
import './styles.scss';
import Input from '../Input/index.tsx';
import TokensList from '../Modals/Bridge/TokensList/index.tsx';
import { useAccount } from '../../hooks/Account/index.tsx';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';
import './toast.css';
import ERC20 from '../../contract-abis/ERC20.json';
import tokensList from '../Modals/Bridge/TokensList/tokensList';
import { APPROVE_AMOUNT } from '../../constants';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import { decompressKey } from '../../nightfall-browser/services/keys';
import { saveTransaction } from '../../nightfall-browser/services/database';

const { proposerUrl } = global.config;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gen = require('general-number');

const { generalise } = gen;

const BridgeComponent = () => {
  const [state] = useContext(UserContext);
  const { setAccountInstance, accountInstance } = useAccount();
  const [l1Balance, setL1Balance] = useState(0n);
  const [l2Balance, setL2Balance] = useState(0n);
  const [shieldContractAddress, setShieldAddress] = useState('');
  const location = useLocation();

  const initialTx = location?.tokenState?.initialTxType ?? 'deposit';
  const initialToken =
    tokensList.tokens.find(t => t.address.toLowerCase() === location?.tokenState?.tokenAddress) ??
    tokensList.tokens[0];

  const [token, setToken] = useState(initialToken);
  const [txType, setTxType] = useState(initialTx);
  const [transferValue, setTransferValue] = useState(0);
  const [show, setShow] = useState(false);

  const [showTokensListModal, setShowTokensListModal] = useState(false);

  useEffect(async () => {
    const web3 = Web3.connection();
    const accounts = await web3.eth.getAccounts();
    setAccountInstance({
      address: accounts[0],
    });
  }, []);

  useEffect(() => {
    document.getElementById('inputValue').value = 0;
  }, [txType]);

  useEffect(() => {
    const getShieldAddress = async () => {
      const { address } = (await getContractAddress('Shield')).data;
      setShieldAddress(address);
    };
    getShieldAddress();
  }, []);

  const [showModalConfirm, setShowModalConfirm] = useState(false);
  const [showModalTransferInProgress, setShowModalTransferInProgress] = useState(true);
  const [showModalTransferEnRoute, setShowModalTransferEnRoute] = useState(false);
  const [showModalTransferConfirmed, setShowModalTransferConfirmed] = useState(false);
  const [readyTx, setReadyTx] = useState('');

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // TODO Make this dependent on proof generation time.
  const handleCloseConfirmModal = () => {
    setShowModalConfirm(false);
    setShowModalTransferInProgress(false);
    setShowModalTransferEnRoute(false);
    setShowModalTransferConfirmed(false);
  };

  // const handleShowModalConfirm = async () => {
  //   setShowModalConfirm(true);
  //   setShowModalTransferInProgress(true);
  //   // await timeout(3000);
  //   setShowModalTransferInProgress(false);
  //   setShowModalTransferEnRoute(true);

  //   // await timeout(3000);
  //   setShowModalTransferEnRoute(false);
  //   setShowModalTransferConfirmed(true);
  // };

  const handleClose = () => setShow(false);

  async function submitTx() {
    console.log('readyTx', readyTx);
    try {
      switch (readyTx.type) {
        case 'onchain':
          await submitTransaction(readyTx.rawTransaction, shieldContractAddress, 1);
          break;
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
      handleClose();
      handleCloseConfirmModal();
      return true;
    } catch (error) {
      handleClose();
      handleCloseConfirmModal();
      return false;
    }
  }

  async function triggerTx() {
    if (shieldContractAddress === '')
      setShieldAddress((await getContractAddress('Shield')).data.address);
    // const { address } = (await getContractAddress('ERC20Mock')).data; // TODO Only for testing now
    // const ercAddress = address; // TODO Location to be removed later
    const ercAddress = token.address;
    console.log('ercAddress', ercAddress);
    const zkpKeys = await retrieveAndDecrypt(state.compressedPkd);
    switch (txType) {
      case 'deposit': {
        const pkd = decompressKey(generalise(state.compressedPkd));
        await approve(ercAddress, shieldContractAddress, 'ERC20', APPROVE_AMOUNT);
        setShowModalConfirm(true);
        setShowModalTransferInProgress(true);
        await timeout(2000);
        setShowModalTransferInProgress(false);
        setShowModalTransferEnRoute(true);
        const { rawTransaction, transaction } = await deposit(
          {
            ercAddress,
            tokenId: 0,
            value: (BigInt(transferValue) * 10n ** BigInt(token.decimals)).toString(),
            pkd,
            nsk: zkpKeys.nsk,
            fee: 1,
            tokenType: 'ERC20',
          },
          shieldContractAddress,
        );
        setShowModalTransferEnRoute(false);
        setShowModalTransferConfirmed(true);
        return {
          type: 'onchain',
          rawTransaction,
          transaction,
        };
      }
      case 'withdraw': {
        setShowModalConfirm(true);
        setShowModalTransferInProgress(true);
        await timeout(2000);
        setShowModalTransferInProgress(false);
        setShowModalTransferEnRoute(true);
        const { transaction } = await withdraw(
          {
            offchain: true,
            ercAddress,
            tokenId: 0,
            value: (BigInt(transferValue) * 10n ** BigInt(token.decimals)).toString(),
            recipientAddress: await Web3.getAccount(),
            nsk: zkpKeys.nsk,
            ask: zkpKeys.ask,
            tokenType: 'ERC20',
            fees: 1,
          },
          shieldContractAddress,
        );
        setShowModalTransferEnRoute(false);
        setShowModalTransferConfirmed(true);
        return {
          type: 'offchain',
          transaction,
        };
      }
      default:
        break;
    }
    return false;
  }

  const handleChange = useCallback(
    e => {
      setTransferValue(e.target.value);
    },
    [transferValue],
  );

  const handleShow = () => {
    if (
      (txType === 'deposit' && (BigInt(transferValue) * 10n ** BigInt(token.decimals)) > l1Balance) ||
      (txType === 'withdraw' && (BigInt(transferValue) * 10n ** BigInt(token.decimals)) > l2Balance)
    )
      toast.error("Input value can't be greater than balance!");
    else if (!transferValue) toast.warn('Input a value for transfer, please.');
    else if (transferValue === 0) toast.warn("Input a value can't be zero.");
    setShow(true);
  };

  async function updateL1Balance() {
    console.log('L1 Balance');
    if (token && token?.address) {
      // const { address } = (await getContractAddress('ERC20Mock')).data; // TODO REMOVE THIS WHEN OFFICIAL ADDRESSES
      // console.log('ERC20', defaultTokenAddress);
      const contract = new window.web3.eth.Contract(ERC20, token.address);
      const result = await contract.methods.balanceOf(accountInstance.address).call(); // 29803630997051883414242659
      setL1Balance(result);
    } else {
      setL1Balance(0);
    }
  }

  async function updateL2Balance() {
    if (token && token.address) {
      // const { address } = (await getContractAddress('ERC20Mock')).data; // TODO REMOVE THIS WHEN OFFICIAL ADDRESSES
      const l2bal = await getWalletBalance(state.compressedPkd);
      if (Object.hasOwnProperty.call(l2bal, state.compressedPkd))
        setL2Balance(l2bal[state.compressedPkd][token.address.toLowerCase()] ?? 0n);
      else setL2Balance(0n);
    }
  }

  useEffect(() => {
    updateL1Balance();
    updateL2Balance();
  }, [token, txType]);

  const updateInputValue = () => {
    if (txType === 'deposit') {
      document.getElementById('inputValue').value = l1Balance;
      setTransferValue(l1Balance);
      return;
    }
    document.getElementById('inputValue').value = l2Balance;
    setTransferValue(l2Balance);
  };

  return (
    <div>
      {showTokensListModal && (
        <div className="modalWrapper">
          <TokensList handleClose={setShowTokensListModal} setToken={setToken} />
        </div>
      )}

      <div className="bridge-wrapper">
        <div>
          <div>
            <div className="tabs">
              <div
                className={txType === 'deposit' ? 'tabs_button_checked' : 'tabs_button'}
                value="deposit"
                onClick={() => setTxType('deposit')}
              >
                <p>Deposit</p>
              </div>
              <div
                className={txType === 'withdraw' ? 'tabs_button_checked' : 'tabs_button'}
                value="withdraw"
                onClick={() => setTxType('withdraw')}
              >
                <p>Withdraw</p>
              </div>
            </div>
          </div>

          <div className="brige_body">
            {/* FROM SECTION */}
            <div className="from_label">From</div>
            <div className="from_section">
              <div className="chain_balance_details">
                <div className="chain_details">
                  {txType === 'deposit' ? (
                    <img src={ethChainImage} alt="ethereum chain logo" />
                  ) : (
                    <img src={polygonNightfall} alt="polygon chain logo" height="24" width="24" />
                  )}
                  <p>{txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}</p>
                </div>
                <div className="balance_details">
                  <p>Balance: </p>
                  {token && txType === 'deposit' && (
                    // <p> {token.decimals} </p>
                    // <p>{`${(l1Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                    <p>{
                      `${l1Balance.toString().slice(0,l1Balance.toString().length - token.decimals)}.
                      ${(l1Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                    }</p>
                  )}
                  {token && txType === 'withdraw' && (
                    // <p>{`${(l2Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                    <p>{
                      `${l2Balance.toString().slice(0,l2Balance.toString().length - token.decimals)}.
                      ${(l2Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                    }</p>
                  )}
                  {!token && (
                    <p>
                      0
                      {/* {txType === 'deposit'
                        ? `${(l1Balance / 10 ** token.decimals).toFixed(4)}`
                        : `${(l2Balance / 10 ** token.decimals).toFixed(4)}`} */}
                    </p>
                  )}
                </div>
              </div>
              <div className="from_section_line"></div>
              <div className="token_amount_details">
                <div className="amount_details">
                  <div className="amount_value_wrapper">
                    <Input
                      id="inputValue"
                      name="price"
                      prefix="$"
                      placeholder="0,00"
                      onChange={handleChange}
                    />
                    <div className="amount_details_max" onClick={() => updateInputValue()}>
                      <span>MAX</span>
                    </div>
                  </div>
                </div>
                <div className="token_details">
                  <div
                    className="token_details_wapper"
                    onClick={() => setShowTokensListModal(true)}
                  >
                    {token && token.logoURI && token.symbol && (
                      <>
                        <img src={token.logoURI} alt="chain logo" height="24" width="24" />
                        <div className="token_details_text" id="bridge_tokenDetails_tokenName">
                          <span>{token.symbol}</span>
                        </div>
                      </>
                    )}
                    {!token && (
                      <>
                        <div></div>
                        <div className="token_details_text" id="bridge_tokenDetails_tokenName">
                          <span>Select</span>
                        </div>
                      </>
                    )}
                    <img src={discloserBottomImage} alt="discloser icon" height="24" width="24" />
                  </div>
                </div>
              </div>
            </div>

            <div className="arrow_icon_wrapper">
              <img src={lightArrowImage} alt="to arrow" />
            </div>

            {/* TO SECTION */}
            <div className="to_text">To</div>
            <div className="to_wrapper">
              <div className="chain_details">
                {txType === 'withdraw' ? (
                  <img src={ethChainImage} alt="ethereum chain logo" height="24" width="24" />
                ) : (
                  <img src={polygonNightfall} alt="polygon chain logo" height="24" width="24" />
                )}
                <p>{txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}</p>
              </div>
              <div className="balance_details">
                <p>Balance: </p>
                {token && txType === 'deposit' && (
                  // <p>{`${(l2Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                  <p>{
                    `${l2Balance.toString().slice(0,l2Balance.toString().length - token.decimals)}.
                    ${(l2Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                  }</p>
                )}
                {token && txType === 'withdraw' && (
                  // <p>{`${(l1Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                  <p>{
                    `${l1Balance.toString().slice(0,l1Balance.toString().length - token.decimals)}.
                    ${(l1Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                  }</p>
                )}
                {!token && (
                  // <p>
                  //   {txType === 'withdraw'
                  //     ? `${(l2Balance / 10 ** token.decimals).toFixed(4)}`
                  //     : `${(l1Balance / 10 ** token.decimals).toFixed(4)}`}
                  // </p>
                  <p>
                    {txType === 'withdraw'
                      ? `${l2Balance.toString().slice(0,l2Balance.toString().length - token.decimals)}.${(l2Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                      : `${l1Balance.toString().slice(0,l1Balance.toString().length - token.decimals)}.${(l1Balance.toString().slice(-token.decimals)).slice(0,4)} ${token.symbol}`
                  }
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* TRANSFER MODE */}
          <div className="transfer_mode">
            <span className="transfer_mode_text"> Transfer Mode: </span>
            <span className="transfer_bridge_text">
              {txType.charAt(0).toUpperCase() + txType.slice(1)} Bridge
            </span>
          </div>

          {/* TRANSFER BUTTON */}
          <div>
            <button type="button" className="transfer_button" onClick={handleShow}>
              <p>Transfer</p>
            </button>
          </div>
        </div>
        <Modal contentClassName={stylesModal.modalFather} show={show} onHide={() => setShow(false)}>
          <Modal.Header closeButton>
            <div className={styles.modalTitle}>Confirm transaction</div>
          </Modal.Header>
          <Modal.Body>
            <div className={stylesModal.modalBody}>
              <div className={stylesModal.tokenDetails}>
                {/* d-flex justify-content-center align-self-center mx-auto */}
                <div className={stylesModal.tokenDetails__img}>
                  {/* <img
                                  v-if="
                                  selectedToken.symbol &&
                                      !!tokenImage(selectedToken)
                                  "
                                  class="align-self-center"
                                  :src="tokenImage(selectedToken)"
                                  alt="Token Image"
                              > */}
                  <img src={polygonNightfall} alt="Token" />
                  {/* <span
                                  v-else-if="selectedToken.symbol"
                                  class="align-self-center font-heading-large ps-t-2 font-semibold"
                              >{{ selectedToken.symbol[0] }}</span> */}
                </div>
                {/* font-heading-large font-bold ps-t-16 ps-b-6 */}
                <div className={stylesModal.tokenDetails__val} id="Bridge_modal_tokenAmount">
                  {Number(transferValue).toFixed(4)}
                </div>
                {/* font-body-small */}
                <div className={stylesModal.tokenDetails__usd}>
                  {/* ${Number(token.currencyValue) * (Number(token.l2Balance) / 10 ** token.decimals)} */}
                </div>
              </div>

              {/* Buttons */}
              <div>
                <div className={stylesModal.networkButtons}>
                  <div className={stylesModal.networkButtons__button1}>
                    <span>
                      {txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}
                    </span>
                  </div>
                  <MdArrowForwardIos />
                  <div className={stylesModal.networkButtons__button2}>
                    <span>
                      {txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={stylesModal.divider} />
              <div className={stylesModal.transferModeModal}>
                <div className={stylesModal.transferModeModal__title}>
                  <div className={stylesModal.transferModeModal__title__main}>Transfer Mode</div>
                  <div className={stylesModal.transferModeModal__title__light}>
                    {txType === 'deposit' ? 'On-Chain' : 'Direct Transfer'}
                  </div>
                </div>
                <div className={stylesModal.transferModeModal__text}>
                  <span>Transfer security is provided by the Ethereum miners.</span>
                  {/* <span v-else>
                              Plasma provides advanced security with plasma exit
                              mechanism. </span>It will take approximately */}
                  <span>
                    {' '}
                    To minimise the risk of chain reorganisations, your transfer will wait for{' '}
                  </span>
                  <span className="text-primary"> 12 block confirmations</span> before being
                  finalized.
                </div>
              </div>
              <div className={stylesModal.divider} />
              <div className={stylesModal.estimationFee}>
                <div className={stylesModal.estimationFee__title}>
                  <div className={stylesModal.estimationFee__title__main}>
                    Estimation Transaction fee
                  </div>
                  <div className={stylesModal.estimationFee__title__light}>TBC</div>
                </div>
                <button
                  type="button"
                  className={stylesModal.continueTrasferButton}
                  onClick={async () => {
                    handleClose();
                    setShowModalConfirm(true);
                    setShowModalTransferInProgress(true);
                    setReadyTx(await triggerTx());
                  }}
                >
                  Create Transaction
                </button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

        {/* TRANSFER IN PROGRESS MODAL */}
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
      </div>
    </div>
  );
};

export default BridgeComponent;
