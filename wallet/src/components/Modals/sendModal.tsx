import React, { useState, useEffect, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { FiSearch } from 'react-icons/fi';
import { BsArrowReturnLeft } from 'react-icons/bs';
import axios from 'axios';
import tokensList from './Bridge/TokensList/tokensList';

import { UserContext } from '../../hooks/User';
import maticImg from '../../assets/img/polygon-chain.svg';
import transfer from '../../nightfall-browser/services/transfer';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import { getContractAddress } from '../../common-files/utils/contract';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';
import approveImg from '../../assets/img/modalImages/adeposit_approve1.png';
import depositConfirmed from '../../assets/img/modalImages/adeposit_confirmed.png';
import successHand from '../../assets/img/modalImages/success-hand.png';
import transferCompletedImg from '../../assets/img/modalImages/tranferCompleted.png';
import { saveTransaction } from '../../nightfall-browser/services/database';

import '../../styles/bridge.module.scss';
import '../../styles/modal.scss';
import { BalanceText, BalanceTextRight, ContinueTransferButton, Divider, HeaderTitle, InputAddress, InputBalance, InputSearchTitle, InputWrapper, MaxButton, MyBody, ProcessImages, SendModalBalance, SendModalBalanceLeft, SendModalBalanceRight, SendModalFooter, SendModalStyle, Spinner, SpineerBox, SpinnerBoard, TokensLine, TokensLineDiv, TokensLineDivImg, TokensList } from './sendModalStyles';

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
  const [l2Balance, setL2Balance] = useState(0);
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
      const l2bal: Record<string, Record<string, number>> = await getWalletBalance(
        state?.compressedPkd,
      );
      if (Object.hasOwnProperty.call(l2bal, state?.compressedPkd))
        setL2Balance(l2bal[state.compressedPkd][sendToken.address.toLowerCase()] ?? 0);
      else setL2Balance(0);
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
          values: [(Number(valueToSend) * 10 ** sendToken.decimals).toString()],
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
      <Modal contentClassName="modalFather" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <HeaderTitle>Send</HeaderTitle>
        </Modal.Header>
        <Modal.Body>
          {showTokensListModal ? (
            <MyBody>
              <SendModalStyle>
                <InputSearchTitle>
                  <BsArrowReturnLeft title='Back' onClick={() => setShowTokensListModal(false)}/>
                  <div>Choose token from <span>Ethereum</span></div>                  
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
                    id="TokenItem_modalSend_compressedPkd"
                  />
                  <p>Enter a valid address existing on the Polygon Nightfall L2</p>
                </div>
                <SendModalBalance>
                  <SendModalBalanceLeft>
                    <InputBalance
                      type="text"
                      placeholder="0.00"
                      onChange={e => setTransferValue(Number(e.target.value))}
                      id="TokenItem_modalSend_tokenAmount"
                    />
                    
                  </SendModalBalanceLeft>
                  <MaxButton>MAX</MaxButton>
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
                    {((l2Balance / 10 ** sendToken.decimals) * sendToken.currencyValue).toFixed(4)}
                  </p>
                  <BalanceTextRight>
                    <p>Available Balance:</p>
                    <p>
                      {(l2Balance / 10 ** sendToken.decimals).toFixed(4)} {sendToken.symbol}
                    </p>
                  </BalanceTextRight>
                </BalanceText>

                <SendModalFooter>
                  <img src={maticImg} alt="matic icon" />
                  <p className="gasFee"> 0.00 Matic Transfer Fee</p>
                </SendModalFooter>
              </SendModalStyle>
              <ContinueTransferButton
                onClick={async () => {
                  props.onHide();
                  setShowModalConfirm(true);
                  setShowModalTransferInProgress(true);
                  setReadyTx(await sendTx());
                }}
              >
                Continue
              </ContinueTransferButton>
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
              <Divider/>
              <SpineerBox>
                <SpinnerBoard>
                  <Spinner />
                </SpinnerBoard>
              </SpineerBox>
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
              <Divider/>
              <SpineerBox>
                <SpinnerBoard>
                  <Spinner />
                </SpinnerBoard>
              </SpineerBox>
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
              <Divider/>
              <SpineerBox>
                <img src={successHand} alt="success hand" />
              </SpineerBox>
              <div className="transferModeModal" id="Bridge_modal_success">
                <h3>Transaction created sucessfully.</h3>
                <div className="modalText">Your transfer is ready to send.</div>
                <button
                  type="button"
                  className="continueTrasferButton"
                  id="Bridge_modal_continueTransferButton"
                  onClick={() => submitTx()}
                >
                  Send Transaction
                </button>
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
