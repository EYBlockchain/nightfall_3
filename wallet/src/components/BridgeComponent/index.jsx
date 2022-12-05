import React, { useContext, useState, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import { toast } from 'react-toastify';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import styled, { keyframes } from 'styled-components';
import importTokens from '@TokenList/index';
import deposit from '@Nightfall/services/deposit';
import withdraw from '@Nightfall/services/withdraw';
import { getWalletBalance } from '@Nightfall/services/commitment-storage';
import { saveTransaction } from '@Nightfall/services/database';
import Lottie from 'lottie-react';
import ethChainImage from '../../assets/img/ethereum-chain.svg';
import polygonNightfall from '../../assets/svg/polygon-nightfall.svg';
import discloserBottomImage from '../../assets/img/discloser-bottom.svg';
import lightArrowImage from '../../assets/img/light-arrow.svg';
import { approve, submitTransaction } from '../../common-files/utils/contract';
import Web3 from '../../common-files/utils/web3';
import approveImg from '../../assets/img/modalImages/adeposit_approve1.png';
import depositConfirmed from '../../assets/img/modalImages/adeposit_confirmed.png';
import successHand from '../../assets/img/modalImages/success-hand.png';
import transferCompletedImg from '../../assets/img/modalImages/tranferCompleted.png';
import { UserContext } from '../../hooks/User/index.jsx';
import Input from '../Input/index.tsx';
import TokensList from '../Modals/Bridge/index.tsx';
import { useAccount } from '../../hooks/Account/index.tsx';
import './toast.css';
import './styles.scss';
import TransferModal from '../Modals/Bridge/Transfer/index.jsx';
import checkMarkYes from '../../assets/lottie/check-mark-yes.json';
import checkMarkCross from '../../assets/lottie/check-mark-cross.json';

import ERC20 from '../../contract-abis/ERC20.json';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import BigFloat from '../../common-files/classes/bigFloat';
import { shieldAddressGet } from '../../utils/lib/local-storage';

const ModalTitle = styled.div`
  width: 50%;
`;

const MyModalBody = styled.div`
  flex-direction: column;
  text-align: center;
  padding: 10px;
`;

const ProcessImage = styled.div`
  img {
    width: 340px;
  }
`;

export const SpinnerBox = styled.div`
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
  margin-top: 20px;
`;

export const SpinnerBoard = styled.div`
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
  --size: 150px;
  --border: 2px;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;

  border: var(--border) solid #eee;
`;
const spin = keyframes`
  100% {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled.div`
  --size: 100px;
  --border: 4px;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  position: relative;
  border: var(--border) solid #7b3fe4;
  border-right: var(--border) solid #eae0fb;
  animation: ${spin} 1s linear infinite;
`;

const TransferMode = styled.div`
  margin-top: 24px;
`;

const ModalText = styled.div`
  text-align: center;
`;

const Divider = styled.div`
  margin-top: 30px;
  border-bottom: solid 1px #ddd;
`;

const ContinueTransferButton = styled.button`
  margin-top: 12px;
  border-radius: 12px;
  align-self: flex-end;
  width: 100%;
  background-color: #7b3fe4;
  color: #fff;
  padding: 15px;
  margin-bottom: 12px;

  &:hover {
    cursor: pointer;
  }
`;
const supportedTokens = importTokens();

const { proposerUrl } = global.config;

const BridgeComponent = () => {
  const [state] = useContext(UserContext);
  const { accountInstance } = useAccount();
  const [l1Balance, setL1Balance] = useState(0n);
  const [l2Balance, setL2Balance] = useState(0n);
  const [sending, setSendingState] = useState(false);
  const [shieldContractAddress, setShieldAddress] = useState(shieldAddressGet());
  const history = useHistory();
  const initialTx = history?.location?.tokenState?.initialTxType ?? 'deposit';
  const initialToken =
    supportedTokens.find(
      t => t.address.toLowerCase() === history?.location?.tokenState?.tokenAddress.toLowerCase(),
    ) ?? supportedTokens[0];
  const [token, setToken] = useState(initialToken);
  const [txType, setTxType] = useState(initialTx);
  const [transferValue, setTransferValue] = useState('0');
  const [show, setShow] = useState(false);

  const [showTokensListModal, setShowTokensListModal] = useState(false);

  useEffect(() => {
    if (document.getElementById('inputValue')) {
      document.getElementById('inputValue').value = 0;
    }
  }, [txType]);

  useEffect(() => {
    setShieldAddress(shieldAddressGet());
  }, []);

  useEffect(() => {
    if (sending)
      setTimeout(() => {
        setSendingState(false);
      }, 8000);
  }, [sending]);

  const [showModalConfirm, setShowModalConfirm] = useState(false);
  const [showModalTransferInProgress, setShowModalTransferInProgress] = useState(true);
  const [showModalTransferEnRoute, setShowModalTransferEnRoute] = useState(false);
  const [showModalTransferFailed, setShowModalTransferFailed] = useState(false);
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
    setShowModalTransferFailed(false);
    setShowModalTransferConfirmed(false);
  };

  const handleClose = () => setShow(false);

  async function submitTx() {
    try {
      switch (readyTx.type) {
        case 'onchain': {
          const txL1Hash = await submitTransaction(
            readyTx.rawTransaction,
            shieldContractAddress,
            150000,
            0,
          ); // 150k is enough gasLimit for a deposit
          readyTx.transaction.l1Hash = txL1Hash;
          break;
        }
        case 'offchain': {
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
        }
        default: {
          console.log('Error when sending');
        }
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
    if (shieldContractAddress === '') setShieldAddress(shieldAddressGet());
    const ercAddress = token.address;
    const zkpKeys = await retrieveAndDecrypt(state.compressedZkpPublicKey);
    switch (txType) {
      case 'deposit': {
        await approve(
          ercAddress,
          shieldContractAddress,
          'ERC20',
          new BigFloat(transferValue, token.decimals).toBigInt().toString(),
        );
        setShowModalConfirm(true);
        setShowModalTransferInProgress(true);
        await timeout(2000);
        setShowModalTransferInProgress(false);
        setShowModalTransferEnRoute(true);
        const { rawTransaction, transaction } = await deposit(
          {
            ercAddress,
            tokenId: 0,
            value: new BigFloat(transferValue, token.decimals).toBigInt().toString(),
            rootKey: zkpKeys.rootKey,
            fee: 0,
            tokenType: 'ERC20',
          },
          shieldContractAddress,
        ).catch(e => {
          console.log('Error in transfer', e);
          setShowModalTransferEnRoute(false);
          setShowModalTransferFailed(true);
          return { transaction: null };
        });
        if (transaction === null) return { type: 'failed_transfer' };
        setShowModalTransferEnRoute(false);
        setShowModalTransferConfirmed(true);
        console.log('Proof Done');
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
            value: new BigFloat(transferValue, token.decimals).toBigInt().toString(),
            recipientAddress: await Web3.getAccount(),
            rootKey: zkpKeys.rootKey,
            tokenType: 'ERC20',
            fees: 1,
          },
          shieldContractAddress,
        ).catch(e => {
          console.log('Error in transfer', e);
          setShowModalTransferEnRoute(false);
          setShowModalTransferFailed(true);
          return { transaction: null };
        });
        if (transaction === null) return { type: 'failed_transfer' };
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

  const handleShow = () => {
    if (
      (txType === 'deposit' &&
        new BigFloat(transferValue, token.decimals).toBigInt() > l1Balance) ||
      (txType === 'withdraw' && new BigFloat(transferValue, token.decimals).toBigInt() > l2Balance)
    ) {
      toast.error("Input value can't be greater than balance!");
      return;
    }

    if (
      txType === 'deposit' &&
      new BigFloat(transferValue, token.decimals).toBigInt() >
        parseInt(token.restrictions[txType], 10)
    ) {
      toast.error(
        `Input value can't be greater than ${
          parseInt(token.restrictions[txType], 10) /
          parseInt(new BigFloat('1', token.decimals).toBigInt().toString(), 10)
        }`,
      );
      return;
    }

    if (!transferValue) {
      toast.warn('Input a value for transfer, please.');
      return;
    }

    if (transferValue === '0') {
      toast.warn("Input a value can't be zero.");
      return;
    }

    setShow(true);
  };

  async function updateL1Balance() {
    if (token && token?.address) {
      const contract = new window.web3.eth.Contract(ERC20, token.address);
      const result = await contract.methods.balanceOf(accountInstance.address).call(); // 29803630997051883414242659
      setL1Balance(BigInt(result));
    } else {
      setL1Balance(0n);
    }
  }

  async function updateL2Balance() {
    if (token && token.address) {
      const l2bal = await getWalletBalance(state.compressedZkpPublicKey);
      if (Object.hasOwnProperty.call(l2bal, state.compressedZkpPublicKey))
        setL2Balance(l2bal[state.compressedZkpPublicKey][token.address.toLowerCase()] ?? 0n);
      else setL2Balance(0n);
    }
  }

  useEffect(() => {
    updateL1Balance();
    updateL2Balance();
  }, [token, txType, accountInstance]);

  const updateInputValue = () => {
    const inputElement = document
      .querySelector('nightfall-app')
      .shadowRoot.getElementById('inputValue');
    if (txType === 'deposit') {
      inputElement.value = new BigFloat(l1Balance, token.decimals).toFixed(4);
      setTransferValue(new BigFloat(l1Balance, token.decimals).toFixed(4).toString());
      return;
    }
    inputElement.value = new BigFloat(l2Balance, token.decimals).toFixed(4);
    setTransferValue(new BigFloat(l2Balance, token.decimals).toFixed(4).toString());
  };

  const continueTransfer = async () => {
    if (await submitTx()) {
      history.push('/transactionPage');
    }
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
                  <p>Balance:</p>
                  {token && txType === 'deposit' && (
                    <p>{`${new BigFloat(l1Balance, token.decimals).toFixed(4)} ${token.symbol}`}</p>
                  )}
                  {token && txType === 'withdraw' && (
                    <p>{`${new BigFloat(l2Balance, token.decimals).toFixed(4)} ${token.symbol}`}</p>
                  )}
                  {!token && <p>0</p>}
                </div>
              </div>
              <div className="from_section_line" />
              <div className="token_amount_details">
                <div className="amount_details">
                  <div className="amount_value_wrapper">
                    <Input
                      id="inputValue"
                      name="price"
                      placeholder="0.00"
                      onKeyDown={e => {
                        if (
                          (transferValue.toString().split('.')[1]?.length ?? 0) > 3 &&
                          /^[0-9]$/i.test(e.key)
                        ) {
                          e.preventDefault(); // If exceed input count then stop updates.
                        }
                      }}
                      onChange={e => {
                        if (/^\d+\.\d+$/.test(e.target.value) || /^\d+$/.test(e.target.value)) {
                          if (typeof e.target.value.split('.')[1] === 'undefined')
                            setTransferValue(e.target.value);
                          else if (e.target.value.split('.')[1]?.length < 5)
                            setTransferValue(e.target.value);
                          else
                            setTransferValue(
                              `${e.target.value.split('.')[0]}.${e.target.value
                                .split('.')[1]
                                .slice(0, 4)}`,
                            );
                        } else setTransferValue('0');
                      }}
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
                        <div />
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

            {new BigFloat(transferValue, token.decimals).toBigInt() >
            BigInt(token.restrictions[txType]) ? (
              <div className="warning">
                <Lottie
                  style={{ height: '16px', width: '16px', display: 'flex', marginRight: '10px' }}
                  animationData={checkMarkCross}
                />
                <p>
                  {token.symbol} {txType}s are restricted to less than
                  {` ${(parseFloat(token.restrictions[txType]) / 10 ** token.decimals).toFixed(2)}`}
                </p>
              </div>
            ) : (
              <div className="arrow_icon_wrapper">
                <img src={lightArrowImage} alt="to arrow" />
              </div>
            )}

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
                  <p>{`${new BigFloat(l2Balance, token.decimals).toFixed(4)} ${token.symbol}`}</p>
                )}
                {token && txType === 'withdraw' && (
                  <p>{`${new BigFloat(l1Balance, token.decimals).toFixed(4)} ${token.symbol}`}</p>
                )}
                {!token && (
                  <p>
                    {txType === 'withdraw'
                      ? `${new BigFloat(l2Balance, token.decimals).toFixed(4)} ${token.symbol}`
                      : `${new BigFloat(l1Balance, token.decimals).toFixed(4)} ${token.symbol}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* TRANSFER MODE */}
          <div className="transfer_mode">
            <span className="transfer_mode_text">Transfer Mode:</span>
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
        {show && (
          <TransferModal
            show={show}
            setShow={handleShow}
            handleClose={handleClose}
            transferValue={transferValue}
            txType={txType}
            triggerTx={triggerTx}
            setReadyTx={setReadyTx}
          />
        )}

        {/* TRANSFER IN PROGRESS MODAL */}
        <Modal
          contentClassName="modalFather"
          show={showModalConfirm}
          onHide={handleCloseConfirmModal}
        >
          <Modal.Header closeButton>
            <ModalTitle>Transfer in progress</ModalTitle>
          </Modal.Header>
          {showModalTransferInProgress && (
            <Modal.Body>
              <MyModalBody>
                <ProcessImage>
                  <img src={approveImg} alt="approve" />
                </ProcessImage>
                <Divider />
                <SpinnerBox>
                  <SpinnerBoard>
                    <Spinner />
                  </SpinnerBoard>
                </SpinnerBox>

                <TransferMode>
                  <h3>Creating Transaction</h3>
                  <ModalText>
                    Retrieving your commitments and generating transaction inputs.
                  </ModalText>
                  {/* <a className={styles.footerText}>View on etherscan</a> */}
                </TransferMode>
              </MyModalBody>
            </Modal.Body>
          )}

          {showModalTransferEnRoute && (
            <Modal.Body>
              <MyModalBody>
                <ProcessImage>
                  <img src={depositConfirmed} alt="deposit confirmed" />
                </ProcessImage>
                <Divider />
                <SpinnerBox>
                  <SpinnerBoard>
                    <Spinner />
                  </SpinnerBoard>
                </SpinnerBox>

                <TransferMode>
                  <h3>Generating Zk Proof</h3>
                  <ModalText>
                    Proof generation may take up to 2 mins to complete. Do not navigate away.
                  </ModalText>
                  {/* <a className={styles.footerText}>View on etherscan</a> */}
                </TransferMode>
              </MyModalBody>
            </Modal.Body>
          )}

          {showModalTransferConfirmed && (
            <Modal.Body>
              <MyModalBody>
                <ProcessImage>
                  <img src={transferCompletedImg} alt="transfer completed" />
                </ProcessImage>
                <Divider />
                <SpinnerBox>
                  <img src={successHand} alt="success hand" />
                </SpinnerBox>

                <TransferMode>
                  <h3>Transaction created successfully.</h3>
                  <ModalText>Your transfer is ready to send.</ModalText>
                  {/* <a className={styles.footerText}>View on etherscan</a> */}
                  <ContinueTransferButton
                    type="button"
                    id="Bridge_modal_continueTransferButton"
                    onClick={async () => {
                      setSendingState(true);
                      continueTransfer();
                    }}
                  >
                    {sending ? (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Lottie
                          style={{ height: '32px', width: '32px' }}
                          animationData={checkMarkYes}
                          loop
                        />
                      </div>
                    ) : (
                      <div>Send Transaction</div>
                    )}
                  </ContinueTransferButton>
                </TransferMode>
              </MyModalBody>
            </Modal.Body>
          )}

          {showModalTransferFailed && (
            <Modal.Body>
              <MyModalBody>
                <ProcessImage>
                  <img src={transferCompletedImg} alt="transfer failed" />
                </ProcessImage>
                <Divider />
                <SpinnerBox>
                  <Lottie animationData={checkMarkCross} />
                </SpinnerBox>

                <TransferMode>
                  <h3>Failed To Create Transaction.</h3>
                  {/* <ModalText>Please Try Again</ModalText> */}
                  {/* <a className={styles.footerText}>View on etherscan</a> */}
                  <ContinueTransferButton type="button" id="Bridge_modal_continueTransferButton">
                    <div onClick={() => handleCloseConfirmModal()}>Close</div>
                  </ContinueTransferButton>
                </TransferMode>
              </MyModalBody>
            </Modal.Body>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default BridgeComponent;
