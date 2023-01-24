import React, { useState, useEffect, useContext } from 'react';
import styled, { keyframes } from 'styled-components';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { FiSearch } from 'react-icons/fi';
import { BsArrowReturnLeft } from 'react-icons/bs';
import axios from 'axios';
import importTokens from '@TokenList/index';
import TokenType from '@TokenList/TokenType';
import transfer from '@Nightfall/services/transfer';
import { getWalletBalance } from '@Nightfall/services/commitment-storage';
import { saveTransaction } from '@Nightfall/services/database';
import Lottie from 'lottie-react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { generalise } from 'general-number';
import { ZkpKeys } from '@Nightfall/services/keys';
import { UserContext } from '../../hooks/User';
import maticImg from '../../assets/img/polygon-chain.svg';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import approveImg from '../../assets/img/modalImages/adeposit_approve1.png';
import depositConfirmed from '../../assets/img/modalImages/adeposit_confirmed.png';
import successHand from '../../assets/img/modalImages/success-hand.png';
import transferCompletedImg from '../../assets/img/modalImages/tranferCompleted.png';
import BigFloat from '../../common-files/classes/bigFloat';
import checkMarkYes from '../../assets/lottie/check-mark-yes.json';
import Transaction from '../../common-files/classes/transaction';
import checkMarkCross from '../../assets/lottie/check-mark-cross.json';
import { shieldAddressGet } from '../../utils/lib/local-storage';

const supportedTokens = importTokens();

type Transfer =
  | { type: 'offchain'; transaction: Transaction; rawTransaction: string }
  | { type: 'failed_transfer' };

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { proposerUrl } = global.config;

const HeaderTitle = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 10px;
  font-weight: bold;
`;

const MyBody = styled.div`
  flex-direction: column;
  text-align: center;
  padding: 10px;
`;

const SendModalStyle = styled.div`
  input {
    width: 100%;
    height: 50px;
    border-radius: 10px;
    padding: 15px;
  }

  p {
    text-align: start;
    font-size: small;
    color: #b0b4bb;
    margin-top: 10px;
  }
`;

const InputSearchTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  width: 100%;
  padding: 24px 12px;
  /* Header/H2 */

  font-style: normal;
  font-weight: 800;
  font-size: 26px;

  /* identical to box height, or 122% */

  letter-spacing: -0.01em;

  /* light/gray-900 */

  color: #0a0b0d;

  span {
    color: #7b3fe4;
  }

  svg {
    &:hover {
      cursor: pointer;
      color: 555;
    }
  }
`;

const InputWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding: 32px;

  input {
    border: 0px;
    margin-left: 10px;

    &:placeholder {
      font-family: Manrope;
      font-style: normal;
      font-weight: 500;
      font-size: 14px;
      line-height: 24px;
      /* identical to box height, or 171% */

      display: flex;
      align-items: flex-end;

      color: #000000;

      opacity: 0.5;
    }

    &:focus {
      outline: none;
    }
  }
`;

const TokensList = styled.ul`
  padding-right: 24px;
`;

const TokensLine = styled.li`
  width: 100%;

  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80px;
  border-bottom: 1px solid #f3f4f7;
  padding: 10px;

  &:hover {
    cursor: pointer;
    background: #ddd;
  }
`;

const TokensLineDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center !important;
`;

const TokensLineDivImg = styled.img`
  margin-right: 12px;

  width: 40px;
  height: 40px;
`;

const SendModalBalance = styled.div`
  margin-top: 50px;
  display: flex;
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
  border: solid 1px #b0b4bb;
  height: 60px;
  border-radius: 10px;
  padding: 5px;
  width: 100%;
`;

const SendModalBalanceLeft = styled.div`
  width: 40%;
  display: flex;
  align-items: center;
  justify-content: space-around;
  align-content: center;
`;

const InputBalance = styled.input`
  border: none;
  width: 50%;
  padding: 0 10px;

  ::placeholder {
    color: $light-gray-900;
  }

  &:focus {
    outline: none;
  }
`;

const InputAddress = styled.input`
  border: solid 1px #b0b4bb;
  height: 20px;
  padding: 20px;
  ::placeholder {
    color: $light-gray-900;
  }

  &:focus {
    outline: #b0b4bb;
  }
`;

const MaxButton = styled.div`
  color: #7b3fe4;
  font-weight: 600;
  font-size: small;
  padding: 5px;

  &:hover {
    cursor: pointer;
    background-color: $light-gray-200;
    border-radius: 5px;
  }
`;

const SendModalBalanceRight = styled.div`
  width: 40%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-content: flex-end;
  background-color: #eee;
  height: 50px;
  border-radius: 10px;
  padding: 10px;

  &:hover {
    cursor: pointer;
    background-color: #ddd;
  }
`;

const BalanceText = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const BalanceTextRight = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  p {
    &:first-child {
      margin-right: 5px;
    }
  }
`;

const SendModalFooter = styled.div`
  display: flex;
  flex-direction: row;

  img {
    width: 20px;
  }

  padding-top: 90px;

  p {
    margin-left: 5px;
    font-size: medium;
  }
`;

const ContinueTransferButton = styled.div`
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

const ProcessImages = styled.div`
  img {
    width: 340px;
  }
`;

const Divider = styled.div`
  margin-top: 30px;
  border-bottom: solid 1px #ddd;
`;

const SpinnerBox = styled.div`
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
  margin-top: 20px;
`;

const SpinnerBoard = styled.div`
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

const Spinner = styled.div`
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

type SendModalProps = {
  currencyValue: number;
  l2Balance: string;
  name: string;
  symbol: string;
  address: string;
  logoURI: string;
  decimals: number;
  tokenId: string;
  show: boolean;
  onHide: () => void;
};

const SendModal = (props: SendModalProps): JSX.Element => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const [state] = useContext(UserContext); // Why does typescript think this is an object?
  const [valueToSend, setTransferValue] = useState('0');
  const [sending, setSendingState] = useState(false);
  const [recipient, setRecipient] = useState('');
  const { onHide, show, ...initialSendToken } = props;
  const [sendToken, setSendToken] = useState(initialSendToken);
  const [filteredTokens, setFilteredTokens] = useState(
    supportedTokens.map(({ name, symbol, address, logoURI, decimals, tokenId }) => {
      return {
        name,
        symbol,
        address,
        logoURI,
        decimals,
        currencyValue: 0,
        l2Balance: '0',
        tokenId,
      };
    }),
  );
  const [l2Balance, setL2Balance] = useState(0n);
  const [showTokensListModal, setShowTokensListModal] = useState(false);

  const filterTxs = (criteria: string): any[] =>
    supportedTokens
      .filter((t: TokenType) => t.name.toLowerCase().includes(criteria))
      .map(({ name, symbol, address, logoURI, decimals, tokenId }) => {
        return {
          name,
          symbol,
          address,
          logoURI,
          decimals,
          currencyValue: 0,
          l2Balance: '0',
          tokenId,
        };
      });

  useEffect(() => {
    const getBalance = async () => {
      // const l2bal: Record<string, Record<string, bigint>> = await getWalletBalance(
      const l2bal: Record<
        string,
        Array<{ balance: bigint; tokenId: string }>
      > = await getWalletBalance(state?.compressedZkpPublicKey);
      if (!Object.hasOwnProperty.call(l2bal, sendToken.address.toLowerCase())) {
        setL2Balance(0n);
      } else {
        const tokenIdFull = `0x${BigInt(sendToken.tokenId ?? 0)
          .toString(16)
          .padStart(64, '0')}`;

        const tokenIdx = l2bal[sendToken.address.toLowerCase()].findIndex(
          c => c.tokenId === tokenIdFull,
        );

        if (tokenIdx >= 0) {
          setL2Balance(l2bal[sendToken.address.toLowerCase()][tokenIdx].balance);
        } else setL2Balance(0n);
      }
    };
    getBalance();
  }, [sendToken, state]);

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
  // const [showTransferModal, setShowTransferModal] = useState(false);

  const [readyTx, setReadyTx] = useState({ type: '', rawTransaction: '', transaction: {} });
  const [shieldContractAddress, setShieldAddress] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [isValidBalance, setIsValidBalance] = useState(false);

  function timeout(ms: number) {
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
  // const handleClose = () => setShowTransferModal(false);

  async function submitTx() {
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
    setShieldAddress(shieldAddressGet());
  }, []);

  useEffect(() => {
    try {
      ZkpKeys.decompressZkpPublicKey(generalise(recipient));
      setIsValidAddress(true);
    } catch {
      setIsValidAddress(false);
    }
  }, [recipient]);

  useEffect(() => {
    if (
      (new BigFloat(valueToSend.toString(), sendToken.decimals).toFixed(4) >
        new BigFloat(l2Balance, sendToken.decimals).toFixed(4) &&
        sendToken.decimals) ||
      (!sendToken.decimals && valueToSend > l2Balance.toString())
    ) {
      setIsValidBalance(false);
      return;
    }

    if (
      new BigFloat(valueToSend.toString(), sendToken.decimals).toFixed(4) ===
      new BigFloat('0', sendToken.decimals).toFixed(4)
    ) {
      setIsValidBalance(false);
      return;
    }
    setIsValidBalance(true);
  }, [valueToSend]);

  async function sendTx(): Promise<Transfer> {
    if (shieldContractAddress === '') setShieldAddress(shieldAddressGet());
    setShowModalConfirm(true);
    setShowModalTransferInProgress(true);
    const { nullifierKey, rootKey } = await retrieveAndDecrypt(state.compressedZkpPublicKey);
    await timeout(2000);
    setShowModalTransferInProgress(false);
    setShowModalTransferEnRoute(true);
    const { transaction, rawTransaction } = await transfer(
      {
        offchain: true,
        ercAddress: sendToken.address,
        tokenId: sendToken.tokenId,
        recipientData: {
          recipientCompressedZkpPublicKeys: [recipient],
          values: [new BigFloat(valueToSend, sendToken.decimals).toBigInt().toString()],
        },
        nullifierKey,
        rootKey,
        compressedZkpPublicKey: state.compressedZkpPublicKey,
        fee: 0,
      },
      shieldContractAddress,
    ).catch(() => {
      setShowModalTransferEnRoute(false);
      setShowModalTransferFailed(true);
      return { transaction: null, rawTransaction: '' };
    });
    if (transaction === null) return { type: 'failed_transfer' };
    setShowModalTransferEnRoute(false);
    setShowModalTransferConfirmed(true);
    return {
      type: 'offchain',
      transaction,
      rawTransaction,
    };
  }

  const updateMaxBalance = () => {
    const inputElement = document?.getElementById(
      'TokenItem_modalSend_tokenAmount',
    ) as HTMLInputElement;
    if (inputElement !== undefined && inputElement !== null) {
      inputElement.value = new BigFloat(l2Balance, sendToken.decimals).toFixed(4).toString();
      setTransferValue(new BigFloat(l2Balance, sendToken.decimals).toFixed(4).toString());
    }
  };

  return (
    <>
      <Modal contentClassName="modalFather" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <HeaderTitle>Send</HeaderTitle>
        </Modal.Header>
        <Modal.Body>
          {showTokensListModal ? (
            <MyBody>
              <SendModalStyle>
                <InputSearchTitle>
                  <BsArrowReturnLeft title="Back" onClick={() => setShowTokensListModal(false)} />
                  <div>
                    Choose token from <span>Ethereum</span>
                  </div>
                </InputSearchTitle>
                <InputWrapper>
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="Search here"
                    onChange={e => setFilteredTokens(filterTxs(e.target.value.toLowerCase()))}
                  />
                </InputWrapper>
                <TokensList>
                  {filteredTokens.map((token, index) => (
                    <TokensLine
                      key={index}
                      onClick={() => {
                        setSendToken(token);
                        setShowTokensListModal(false);
                      }}
                    >
                      <TokensLineDiv>
                        <TokensLineDivImg src={token.logoURI} alt="token image" />
                        <p>{token.name}</p>
                      </TokensLineDiv>
                      <p>Balance</p>
                    </TokensLine>
                  ))}
                </TokensList>
              </SendModalStyle>
            </MyBody>
          ) : (
            <MyBody>
              <SendModalStyle>
                <div>
                  <InputAddress
                    type="text"
                    placeholder="Enter a Nightfall Address"
                    onChange={e => setRecipient(e.target.value)}
                    id="TokenItem_modalSend_compressedZkpPublicKey"
                  />
                  {!isValidAddress && (
                    <p style={{ color: 'red' }}>Enter a valid address existing on Nightfall L2</p>
                  )}
                </div>
                <SendModalBalance>
                  <SendModalBalanceLeft>
                    <InputBalance
                      type="text"
                      placeholder="0.00"
                      onKeyDown={e => {
                        if (
                          (valueToSend.toString().split('.')[1]?.length ?? 0) > 3 &&
                          /^[0-9]$/i.test(e.key)
                        ) {
                          e.preventDefault(); // If exceed input count then stop updates.
                        }
                      }}
                      onChange={e => setTransferValue(e.target.value)}
                      id="TokenItem_modalSend_tokenAmount"
                    />
                  </SendModalBalanceLeft>
                  <MaxButton onClick={() => updateMaxBalance()}>MAX</MaxButton>
                  <SendModalBalanceRight
                    onClick={() => setShowTokensListModal(true)}
                    id="TokenItem_modalSend_tokenName"
                  >
                    <img src={sendToken.logoURI} alt="matic" />
                    <div>{sendToken.symbol}</div>
                    <AiOutlineDown />
                  </SendModalBalanceRight>
                </SendModalBalance>
                <BalanceText>
                  <p>
                    ${' '}
                    {sendToken.decimals
                      ? new BigFloat(l2Balance, sendToken.decimals)
                          .mul(sendToken.currencyValue)
                          .toFixed(4)
                      : new BigFloat(String(l2Balance).concat('.0000'), 4)
                          .mul(sendToken.currencyValue)
                          .toFixed(4)}
                  </p>
                  <BalanceTextRight>
                    <p>Available Balance:</p>
                    <p>
                      {sendToken.decimals
                        ? new BigFloat(l2Balance, sendToken.decimals).toFixed(4)
                        : BigInt(l2Balance).toString()}{' '}
                      {sendToken.symbol}
                    </p>
                  </BalanceTextRight>
                </BalanceText>

                <SendModalFooter>
                  <img src={maticImg} alt="matic icon" />
                  <p className="gasFee"> 0.00 Matic Transfer Fee</p>
                </SendModalFooter>
                {((new BigFloat(valueToSend.toString(), sendToken.decimals).toBigInt() >
                  new BigFloat(l2Balance, sendToken.decimals).toBigInt() &&
                  sendToken.decimals) ||
                  (!sendToken.decimals && BigInt(valueToSend) > BigInt(l2Balance))) && (
                  <p style={{ color: 'red' }}>The amount is greater than your balance.</p>
                )}
                {new BigFloat(valueToSend.toString(), sendToken.decimals).toFixed(4) ===
                  new BigFloat('0', sendToken.decimals).toFixed(4) && (
                  <p style={{ color: 'red' }}>Insert an amount greater than zero.</p>
                )}
              </SendModalStyle>
              {isValidAddress && isValidBalance && (
                <ContinueTransferButton
                  onClick={async () => {
                    props.onHide();
                    setShowModalConfirm(true);
                    setShowModalTransferInProgress(true);
                    setIsValidAddress(false);
                    const pendingTx = await sendTx();
                    if (pendingTx.type !== 'failed_transfer') setReadyTx(pendingTx);
                  }}
                >
                  Continue
                </ContinueTransferButton>
              )}
            </MyBody>
          )}
        </Modal.Body>
      </Modal>
      <Modal
        contentClassName="modalFather"
        show={showModalConfirm}
        onHide={handleCloseConfirmModal}
      >
        <Modal.Header closeButton>
          <HeaderTitle>Transfer in progress</HeaderTitle>
        </Modal.Header>
        {showModalTransferInProgress && (
          <Modal.Body>
            <MyBody>
              <ProcessImages>
                <img src={approveImg} alt="approve" />
              </ProcessImages>
              <Divider />
              <SpinnerBox>
                <SpinnerBoard>
                  <Spinner />
                </SpinnerBoard>
              </SpinnerBox>
              <div className="transferModeModal">
                <h3>Creating Transaction</h3>
                <div className="modalText">
                  Retrieving your commitments and generating transaction inputs.
                </div>
                {/* <a className="footerText">View on etherscan</a> */}
              </div>
            </MyBody>
          </Modal.Body>
        )}

        {showModalTransferEnRoute && (
          <Modal.Body>
            <MyBody>
              <ProcessImages>
                <img src={depositConfirmed} alt="deposit confirmed" />
              </ProcessImages>
              <Divider />
              <SpinnerBox>
                <SpinnerBoard>
                  <Spinner />
                </SpinnerBoard>
              </SpinnerBox>
              <div className="transferModeModal">
                <h3>Generating Zk Proof</h3>
                <div className="modalText">
                  Proof generation may take up to 2 mins to complete. Do not navigate away.
                </div>
                {/* <a className="footerText">View on etherscan</a> */}
              </div>
            </MyBody>
          </Modal.Body>
        )}

        {showModalTransferConfirmed && (
          <Modal.Body>
            <MyBody>
              <ProcessImages>
                <img src={transferCompletedImg} alt="transfer completed" />
              </ProcessImages>
              <Divider />
              <SpinnerBox>
                <img src={successHand} alt="success hand" />
              </SpinnerBox>
              <div className="transferModeModal" id="Bridge_modal_success">
                <h3>Transaction created successfully.</h3>
                <div className="modalText">Your transfer is ready to send.</div>
                <ContinueTransferButton
                  id="Bridge_modal_continueTransferButton"
                  onClick={() => submitTx()}
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
                {/* <a className="footerText">View on etherscan</a> */}
              </div>
            </MyBody>
          </Modal.Body>
        )}

        {showModalTransferFailed && (
          <Modal.Body>
            <MyBody>
              <ProcessImages>
                <img src={transferCompletedImg} alt="transfer failed" />
              </ProcessImages>
              <Divider />
              <SpinnerBox>
                <Lottie animationData={checkMarkCross} />
              </SpinnerBox>
              <div className="transferModeModal" id="Bridge_modal_success">
                <h3>Failed To Create Transaction.</h3>
                {/* <div className="modalText">Please Try Again</div> */}
                <ContinueTransferButton id="Bridge_modal_continueTransferButton">
                  <div onClick={() => handleCloseConfirmModal()}>Close</div>
                </ContinueTransferButton>
                {/* <a className="footerText">View on etherscan</a> */}
              </div>
            </MyBody>
          </Modal.Body>
        )}
      </Modal>
    </>
  );
};

export default SendModal;
