import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { FiSearch } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from '../../styles/tokenItem.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import metamaskIcon from '../../assets/svg/metamask.svg';
import maticImg from '../../assets/img/polygon-chain.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import transfer from '../../nightfall-browser/services/transfer';
import { getContractAddress } from '../../common-files/utils/contract';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import tokensList from '../Modals/Bridge/TokensList/tokensList';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';

export default function TokenItem(props) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const [valueToSend, setTransferValue] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [sendToken, setSendToken] = useState(props);
  const [filteredTokens, setFilteredTokens] = useState(tokensList.tokens);
  const [l2Balance, setL2Balance] = useState(0);

  const [showTokensListModal, setShowTokensListModal] = useState(false);

  useEffect(async () => {
    const l2bal = await getWalletBalance(state.compressedPkd);
    if (Object.hasOwnProperty.call(l2bal, state.compressedPkd))
      setFilteredTokens(
        filteredTokens.map(t => {
          return {
            ...t,
            l2Balance: l2bal[state.compressedPkd][t.address.toLowerCase()] ?? 0,
          };
        }),
      );
  }, []);

  useEffect(async () => {
    const l2bal = await getWalletBalance(state.compressedPkd);
    if (Object.hasOwnProperty.call(l2bal, state.compressedPkd))
      setL2Balance(l2bal[state.compressedPkd][sendToken.address.toLowerCase()] ?? 0);
    else setL2Balance(0);
  }, [sendToken]);

  async function sendTx() {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { nsk, ask } = await retrieveAndDecrypt(state.compressedPkd);
    await transfer(
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
    console.log('Transfer Complete');
    setShowSendModal(false);
  }
  const tokenNameId = `TokenItem_tokenName${sendToken.symbol}`;
  const tokenBalanceId = `TokenItem_tokenBalance${sendToken.symbol}`;
  const tokenBalanceUsdId = `TokenItem_tokenBalanceUsd${sendToken.symbol}`;
  const tokenDepositId = `TokenItem_tokenDeposit${sendToken.symbol}`;
  const tokenWithdrawId = `TokenItem_tokenWithdraw${sendToken.symbol}`;
  const tokenSendId = `TokenItem_tokenSend${sendToken.symbol}`;
  return (
    <div>
      {/* <div class="matic-tokens-list-item" @click="onTokenClick"> */}
      <div className={styles.maticTokensListItem}>
        <div className={styles.star}>{/* <img src={starFilled} alt="" /> */}</div>
        <div className={styles.maticTokensListItem}>
          <img src={props.logoURI} alt="token icon" />
        </div>

        <div className={styles.tokenDetails}>
          <div className={styles.tokenNameDetails}>
            <div className={styles.tokenNameUpperSection}>
              {/* <div class="token-symbol header-h6"> */}
              <div className={styles.headerH6} id={tokenNameId}>
                {props.symbol}
              </div>
              {/* styles.mobileView See how to do it */}
              <div v-if="!token.isPoS" className={styles.plasmaTag}>
                plasma
              </div>
            </div>
            <div className={styles.tokenNameLowerSection}>
              <span className={styles.seperatingDot}> • </span>
              {props.name}
            </div>
            {true && <div className={styles.plasmaTag}>plasma</div>}
          </div>
          <div className={styles.balancesDetails}>
            <div className={styles.balancesWrapper}>
              <div className={styles.balancesDetailsUpperSection} id={tokenBalanceId}>
                {(Number(props.l2Balance) / 10 ** Number(props.decimals)).toFixed(4)}
              </div>
              <div className={styles.balancesDetailsLowerSection}>
                <span className={styles.seperatingDot} id={tokenBalanceUsdId}>
                  {' '}
                  •{' '}
                </span>
                $
                {(
                  Number(props.currencyValue) *
                  (Number(props.l2Balance) / 10 ** props.decimals)
                ).toFixed(4)}
              </div>
            </div>
          </div>
          <div className={styles.buttonsSection}>
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenAddress: props.address,
                  initialTxType: 'deposit',
                },
              }}
              className={styles.tokenListButton}
              id={tokenDepositId}
            >
              Deposit
            </Link>
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenAddress: props.address,
                  initialTxType: 'withdraw',
                },
              }}
              className={styles.tokenListButton}
              id={tokenWithdrawId}
            >
              Withdraw
            </Link>
            <button
              type="button"
              className={styles.tokenListButton}
              id={tokenSendId}
              onClick={() => {
                setShowSendModal(true);
              }}
            >
              Send
            </button>
          </div>
        </div>
        <div className={styles.addToMetamask}>
          <img className={styles.metamaskIcon} src={metamaskIcon} alt="" />
        </div>
      </div>
      {/* SEND BUTTON */}
      <Modal
        contentClassName={stylesModal.modalFather}
        show={showSendModal}
        onHide={() => {
          setShowTokensListModal(false);
          setShowSendModal(false);
        }}
      >
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
                    onChange={e =>
                      setFilteredTokens(
                        tokensList.tokens.filter(t =>
                          t.name.toLowerCase().includes(e.target.value.toLowerCase()),
                        ),
                      )
                    }
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
                      onChange={e => setTransferValue(e.target.value)}
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
                  <p>$ 0 </p>
                  <div className={stylesModal.right}>
                    <p>Available Balance:</p>
                    <p>
                      {l2Balance} {sendToken.symbol}
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
                onClick={() => sendTx()}
              >
                Continue
              </button>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

TokenItem.propTypes = {
  currencyValue: PropTypes.number.isRequired,
  l2Balance: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  symbol: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired,
  logoURI: PropTypes.string.isRequired,
  decimals: PropTypes.number.isRequired,
};
