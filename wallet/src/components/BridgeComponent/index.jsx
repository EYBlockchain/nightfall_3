import React, { useContext, useState, useCallback, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import styled, { keyframes } from 'styled-components';
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
import Input from '../Input/index.tsx';
import TokensList from '../Modals/Bridge/TokensList/index.tsx';
import { useAccount } from '../../hooks/Account/index.tsx';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';
import './toast.css';
import './styles.scss';
import TransferModal from '../Modals/Bridge/Transfer/index.jsx';

import ERC20 from '../../contract-abis/ERC20.json';
import tokensList from '../Modals/Bridge/TokensList/tokensList';
import { APPROVE_AMOUNT } from '../../constants';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import { decompressKey } from '../../nightfall-browser/services/keys';
import { saveTransaction } from '../../nightfall-browser/services/database';

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

const { proposerUrl } = global.config;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gen = require('general-number');

const { generalise } = gen;

const BridgeComponent = () => {
  const [state] = useContext(UserContext);
  const { setAccountInstance, accountInstance } = useAccount();
  const [l1Balance, setL1Balance] = useState(0);
  const [l2Balance, setL2Balance] = useState(0);
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
    if (document.getElementById('inputValue')) {
      document.getElementById('inputValue').value = 0;
    }
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
            value: (transferValue * 10 ** token.decimals).toString(),
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
            value: (transferValue * 10 ** token.decimals).toString(),
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
      (txType === 'deposit' && transferValue > l1Balance) ||
      (txType === 'withdraw' && transferValue > l2Balance)
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
        setL2Balance(l2bal[state.compressedPkd][token.address.toLowerCase()] ?? 0);
      else setL2Balance(0);
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
                    <p>{`${(l1Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                  )}
                  {token && txType === 'withdraw' && (
                    <p>{`${(l2Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
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
                  <p>{`${(l2Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                )}
                {token && txType === 'withdraw' && (
                  <p>{`${(l1Balance / 10 ** token.decimals).toFixed(4)} ${token.symbol}`}</p>
                )}
                {!token && (
                  <p>
                    {txType === 'withdraw'
                      ? `${(l2Balance / 10 ** token.decimals).toFixed(4)}`
                      : `${(l1Balance / 10 ** token.decimals).toFixed(4)}`}
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
        {show && (
          <TransferModal
            show={show}
            setShow={setShow}
            handleClose={setShow}
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
                  <h3>Transaction created sucessfully.</h3>
                  <ModalText>Your transfer is ready to send.</ModalText>
                  {/* <a className={styles.footerText}>View on etherscan</a> */}
                  <ContinueTransferButton
                    type="button"
                    id="Bridge_modal_continueTransferButton"
                    onClick={() => submitTx()}
                  >
                    Send Transaction
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
