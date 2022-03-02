import React, { useContext, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import { MdArrowForwardIos } from 'react-icons/md';
import ToggleButton from 'react-bootstrap/ToggleButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
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
import { UserContext } from '../../hooks/User';

const BridgeComponent = (props) => {
  // const [state] = useState(() => props[Object.keys(props)[1].toString()].value);
  const [state] = useContext(UserContext);

  const [transferMethod, setMethod] = useState('On-Chain');

  // const initialTx = location.state?.initialTxType || 'deposit';
  // const initialTx = location.state ? location.state.initialTxType : 'deposit';
  const initialTx = 'deposit';

  const [txType, setTxType] = useState(initialTx);
  const [tokenAmountWei, setTransferValue] = useState(0);
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => {
    setShow(true);
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

  async function triggerTx() {
    console.log('Tx Triggered', txType);
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { address: defaultTokenAddress } = (await getContractAddress('ERC20Mock')).data; // TODO Only for testing now
    const ercAddress = defaultTokenAddress; // TODO Location to be removed later
    console.log('TokenAddress', ercAddress);
    switch (txType) {
      case 'deposit': {
        await approve(ercAddress, shieldContractAddress, 'ERC20', tokenAmountWei.toString());
        const { rawTransaction } = await deposit(
          {
            ercAddress,
            tokenId: 0,
            value: tokenAmountWei,
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
              value: tokenAmountWei,
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
              value: tokenAmountWei,
              recipientAddress: await Web3.getAccount(),
              nsk: state.zkpKeys.nsk,
              ask: state.zkpKeys.ask,
              tokenType: 'ERC20',
              fees: 1,
            },
            shieldContractAddress,
          );
          console.log('rawTransaction', rawTransaction);
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

  return (
    <div className={styles.bridgeWrapper}>
      <div>
        <div>
          <ButtonGroup className={styles.bridgeTabs__tab}>
            <ToggleButton
              type="radio"
              variant="outline-secondary"
              value="deposit"
              checked={txType === 'deposit'}
              onClick={() => setTxType('deposit')}
              // onChange={e => setRadioValue(e.currentTarget.value)}
            >
              Deposit
            </ToggleButton>
            <ToggleButton
              type="radio"
              variant="outline-secondary"
              value="withdraw"
              checked={txType === 'withdraw'}
              onClick={() => setTxType('withdraw')}
              // onChange={e => setRadioValue(e.currentTarget.value)}
            >
              Withdraw
            </ToggleButton>
          </ButtonGroup>
          {/* <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Deposit"outline-secondary"              </div>
              <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Withdraw
              </div> */}
        </div>

        <div className={styles.bridgeBody}>
          <div className={styles.fromLabel}>From</div>
          <div className={styles.fromSection}>
            <div className={styles.chainAndBalanceDetails}>
              <div className={styles.chainDetails}>
                {txType === 'deposit' ? (
                  <img src={ethChainImage} alt="ethereum chain logo" height="24" width="24" />
                ) : (
                  <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
                )}
                <div className={styles.chainDetails__chainName}>
                  {txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}
                </div>
              </div>
            </div>
            <div className={styles.tokenAndAmountDetails}>
              <div className={styles.tokenDetails}>
                <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />

                <div className={styles.tokenDetails__tokenName} id="Bridge_tokenDetails_tokenName">
                  {/* {{ isDepositEther ? isDepositEther : selectedToken.name }} */}
                  MATIC
                </div>
                <img
                  className={styles.tokenDetails__arrow}
                  src={discloserBottomImage}
                  alt="discloser icon"
                  height="24"
                  width="24"
                />
              </div>
              <div className={styles.amountDetails}>
                <input
                  className={styles.amountDetails__textfield}
                  id="Bridge_amountDetails_tokenAmount"
                  type="text"
                  placeholder="0.00"
                  value={tokenAmountWei}
                  onChange={e => setTransferValue(parseFloat(e.target.value))}
                />
                <button type="button" className={styles.amountDetails__maxButton}>
                  MAX
                </button>
              </div>
            </div>
          </div>
          <div className={styles.downArrowSection}>
            <img src={lightArrowImage} alt="to arrow" />
          </div>
          <div className={styles.toLabel}>To</div>
          <div className={styles.toChainAndBalanceDetails}>
            <div className={styles.chainDetails}>
              {txType === 'withdraw' ? (
                <img src={ethChainImage} alt="ethereum chain logo" height="24" width="24" />
              ) : (
                <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
              )}
              <div className={styles.chainDetails__chainName}>
                {txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}
              </div>
            </div>
            <div className={styles.balanceDetails}>
              <span className={styles.balanceDetails__label}> Balance: </span>
              <span className={styles.balanceDetails__balance}>xx MATIC</span>
            </div>
          </div>
          <div className={styles.transferMode}>
            {/* <span class="transfer-mode__label"> Transfer Mode: </span>
                      <span class="bridge-type">{{ selectedMode }} Bridge</span> */}
            <span className={styles.transferMode__label}> Transfer Mode: </span>
            <span className={styles.bridgeType}>
              {txType.charAt(0).toUpperCase() + txType.slice(1)} Bridge
            </span>
          </div>
          <div>
            <button type="button" className={styles.transferButton} onClick={handleShow}>
              Transfer
            </button>
          </div>
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
                {Number(tokenAmountWei).toFixed(2)}
              </div>
              {/* font-body-small */}
              <div className={stylesModal.tokenDetails__usd}>$xx.xx</div>
            </div>

            {/* Buttons */}
            <div>
              <div className={stylesModal.networkButtons}>
                <div className={stylesModal.networkButtons__button1}>
                  <span>{txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}</span>
                </div>
                <MdArrowForwardIos />
                <div className={stylesModal.networkButtons__button2}>
                  <span>{txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}</span>
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
  );
};

export default BridgeComponent;
