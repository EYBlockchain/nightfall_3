import React, { useContext, useState, useCallback, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import { MdArrowForwardIos } from 'react-icons/md';
import { toast } from 'react-toastify';
import styles from '../../styles/bridge.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import polygonChainImage from '../../assets/img/polygon-chain.svg';
import ethChainImage from '../../assets/img/ethereum-chain.svg';
import discloserBottomImage from '../../assets/img/discloser-bottom.svg';
import lightArrowImage from '../../assets/img/light-arrow.svg';
import matic from '../../assets/svg/matic.svg';
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

const BridgeComponent = () => {
  const [state] = useContext(UserContext);
  const { setAccountInstance, accountInstance } = useAccount();
  const [token, setToken] = useState(null);
  const [l1Balance, setL1Balance] = useState(0);
  const [l2Balance, setL2Balance] = useState(0);

  const initialTx = 'deposit';

  const [txType, setTxType] = useState(initialTx);
  const [transferMethod, setMethod] = useState('On-Chain');
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

  const openTokensListModal = () => {
    setShowTokensListModal(true);
  };

  const [showModalConfirm, setShowModalConfirm] = useState(false);
  const [showModalTransferInProgress, setShowModalTransferInProgress] = useState(true);
  const [showModalTransferEnRoute, setShowModalTransferEnRoute] = useState(false);
  const [showModalTransferConfirmed, setShowModalTransferConfirmed] = useState(false);

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

  const handleShowModalConfirm = async () => {
    setShowModalConfirm(true);
    setShowModalTransferInProgress(true);
    await timeout(3000);
    setShowModalTransferInProgress(false);
    setShowModalTransferEnRoute(true);

    await timeout(3000);
    setShowModalTransferEnRoute(false);
    setShowModalTransferConfirmed(true);
  };

  const handleClose = () => setShow(false);

  async function triggerTx() {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { address: defaultTokenAddress } = (await getContractAddress('ERC20Mock')).data; // TODO Only for testing now
    const ercAddress = defaultTokenAddress; // TODO Location to be removed later
    switch (txType) {
      case 'deposit': {
        await approve(ercAddress, shieldContractAddress, 'ERC20', transferValue.toString());
        const { rawTransaction } = await deposit(
          {
            ercAddress,
            tokenId: 0,
            value: transferValue,
            pkd: state.zkpKeys.pkd,
            nsk: state.zkpKeys.nsk,
            fee: 1,
            tokenType: 'ERC20',
          },
          shieldContractAddress,
        );
        return submitTransaction(rawTransaction, shieldContractAddress, 1);
      }

      case 'withdraw': {
        if (transferMethod === 'Direct Transfer') {
          await withdraw(
            {
              offchain: true,
              ercAddress,
              tokenId: 0,
              value: transferValue,
              recipientAddress: await Web3.getAccount(),
              nsk: state.zkpKeys.nsk,
              ask: state.zkpKeys.ask,
              tokenType: 'ERC20',
              fees: 1,
            },
            shieldContractAddress,
          );
        } else {
          const { rawTransaction } = await withdraw(
            {
              ercAddress,
              tokenId: 0,
              value: transferValue,
              recipientAddress: await Web3.getAccount(),
              nsk: state.zkpKeys.nsk,
              ask: state.zkpKeys.ask,
              tokenType: 'ERC20',
              fees: 1,
            },
            shieldContractAddress,
          );
          return submitTransaction(rawTransaction, shieldContractAddress, 1);
        }
        break;
      }

      default:
        break;
    }
    handleClose();
    return true;
  }

  const handleChange = useCallback(
    e => {
      setTransferValue(e.target.value);
    },
    [transferValue],
  );

  const handleShow = () => {
    if (
      (txType === 'deposit' && transferValue > l1Balance) ||
      (txType === 'withdraw' && transferValue > l2Balance)
    )
      toast.error("Input value can't be greater than balance!");
    else if (!transferValue) toast.warn('Input a value for transfer, please.');
    else if (transferValue === 0) toast.warn("Input a value can't be zero.");
    setShow(true);
  };

  async function updateL1Balance() {
    if (token && token?.address) {
      const { address: defaultTokenAddress } = (await getContractAddress('ERC20Mock')).data; // TODO REMOVE THIS WHEN OFFICIAL ADDRESSES
      const contract = new window.web3.eth.Contract(ERC20, defaultTokenAddress);
      const result = await contract.methods.balanceOf(accountInstance.address).call(); // 29803630997051883414242659
      const format = window.web3.utils.fromWei(result, 'Gwei'); // 29803630.997051883414242659
      setL1Balance(format);
    } else {
      setL1Balance(0);
    }
  }

  async function updateL2Balance() {
    if (token && token.address) {
      const { address } = (await getContractAddress('ERC20Mock')).data; // TODO REMOVE THIS WHEN OFFICIAL ADDRESSES
      const l2bal = await getWalletBalance(state.zkpKeys.compressedPkd);
      console.log(state);
      if (Object.hasOwnProperty.call(l2bal, state.zkpKeys.compressedPkd)) {
        console.log('l2Bal', l2bal[state.zkpKeys.compressedPkd][address.toLowerCase()]); // TODO REMOVE ADDRESS WHEN OFFICIAL CONTRACT ADDRESSES AVAILABLE
        setL2Balance(l2bal[state.zkpKeys.compressedPkd][address.toLowerCase()] ?? 0);
      } else setL2Balance(0);
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
                    <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
                  )}
                  <p>{txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}</p>
                </div>
                <div className="balance_details">
                  <p>Balance: </p>
                  {token && txType === 'deposit' && (
                    <p>
                      {`${l1Balance.toString().match(/^-?\d+(?:\.\d{0,4})?/)[0]} ${token.symbol}`}
                    </p>
                  )}
                  {token && txType === 'withdraw' && <p>{`${l2Balance} MATIC`}</p>}
                  {!token && <p>{txType === 'deposit' ? `${l1Balance}` : `${l2Balance}`}</p>}
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
                  <div className="token_details_wapper" onClick={() => openTokensListModal()}>
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
                  <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
                )}
                <p>{txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}</p>
              </div>
              <div className="balance_details">
                <p>Balance: </p>
                {token && txType === 'deposit' && <p>{`${l2Balance} MATIC`}</p>}
                {token && txType === 'withdraw' && (
                  <p>
                    {`${
                      l1Balance
                        .toString()
                        .toString()
                        .match(/^-?\d+(?:\.\d{0,4})?/)[0]
                    } ${token.symbol}`}
                  </p>
                )}
                {!token && <p>{txType === 'withdraw' ? `${l2Balance}` : `${l1Balance}`}</p>}
              </div>
            </div>
          </div>

          {/* WARN WRAPPER */}
          {/* <div className="warn_wrapper">
            <div className="warn_line1">
              <div className="warn_line1_text">
                {!checkBox ? (
                  <div
                    className="warn_line1_text__div_unchecked"
                    type="checkbox"
                    onClick={() => setCheckBox(!checkBox)}
                  />
                ) : (
                  <div
                    className="warn_line1_text__div_checked"
                    type="checkbox"
                    onClick={() => setCheckBox(!checkBox)}
                  >
                    <BsCheck />
                  </div>
                )}
                <p>Swap some MATIC token?</p>
              </div>
              <div className="warn_info">
                <AiOutlineInfo />
              </div>
            </div>
            <div className="warn_line2">
              <p>MATIC is required to perform transaction on polygon chain.</p>
            </div>
          </div> */}
          {/* TRANSFER MODE */}
          <div className="transfer_mode">
            {/* <span class="transfer-mode__label"> Transfer Mode: </span>
                        <span class="bridge-type">{{ selectedMode }} Bridge</span> */}
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
                  <img src={matic} alt="Token" />
                  {/* <span
                                  v-else-if="selectedToken.symbol"
                                  class="align-self-center font-heading-large ps-t-2 font-semibold"
                              >{{ selectedToken.symbol[0] }}</span> */}
                </div>
                {/* font-heading-large font-bold ps-t-16 ps-b-6 */}
                <div className={stylesModal.tokenDetails__val} id="Bridge_modal_tokenAmount">
                  {
                    Number(transferValue)
                      .toString()
                      .match(/^-?\d+(?:\.\d{0,4})?/)[0]
                  }
                </div>
                {/* font-body-small */}
                <div className={stylesModal.tokenDetails__usd}>$xx.xx</div>
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
                    <DropdownButton
                      variant="light"
                      title={transferMethod}
                      id="Bridge_modal_transferMode"
                    >
                      <Dropdown.Item onClick={() => setMethod('On-Chain')}>On-Chain</Dropdown.Item>
                      <Dropdown.Item onClick={() => setMethod('Direct Transfer')}>
                        Direct Transfer
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => setMethod('Instant Withdrawal')}>
                        Instant Withdrawal
                      </Dropdown.Item>
                    </DropdownButton>
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
                  <div className={stylesModal.estimationFee__title__light}>~ $x.xx</div>
                </div>
                <button
                  type="button"
                  className={stylesModal.continueTrasferButton}
                  // onClick={() => triggerTx()}
                  onClick={() => {
                    handleClose();
                    handleShowModalConfirm();
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
                    // onClick={() => triggerTx()}
                    onClick={() => triggerTx()}
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
