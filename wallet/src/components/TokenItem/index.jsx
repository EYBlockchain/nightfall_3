import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import styles from '../../styles/tokenItem.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import metamaskIcon from '../../assets/svg/metamask.svg';
import maticImg from '../../assets/img/polygon-chain.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import transfer from '../../nightfall-browser/services/transfer';
import { getContractAddress } from '../../common-files/utils/contract';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';

export default function TokenItem(props) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const [valueToSend, setTransferValue] = useState(0);
  const [recipient, setRecipient] = useState('');

  async function sendTx() {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { nsk, ask } = await retrieveAndDecrypt(state.compressedPkd);
    await transfer(
      {
        offchain: true,
        ercAddress: props.address,
        tokenId: 0,
        recipientData: {
          recipientCompressedPkds: [recipient],
          values: [(Number(valueToSend) * 10 ** props.decimals).toString()],
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
  const tokenNameId = `TokenItem_tokenName${props.symbol}`;
  const tokenBalanceId = `TokenItem_tokenBalance${props.symbol}`;
  const tokenBalanceUsdId = `TokenItem_tokenBalanceUsd${props.symbol}`;
  const tokenDepositId = `TokenItem_tokenDeposit${props.symbol}`;
  const tokenWithdrawId = `TokenItem_tokenWithdraw${props.symbol}`;
  const tokenSendId = `TokenItem_tokenSend${props.symbol}`;
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
        onHide={() => setShowSendModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Send</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className={stylesModal.modalBody}>
            <div className={stylesModal.sendModal}>
              <div>
                <input
                  type="text"
                  placeholder={state?.compressedPkd}
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
                <div className={stylesModal.rightItems} id="TokenItem_modalSend_tokenName">
                  <img src={maticImg} alt="matic" />
                  <div>Matic (L2)</div>
                  <AiOutlineDown />
                </div>
              </div>
              <div className={stylesModal.balanceText}>
                <p>$ 0 </p>
                <div className={stylesModal.right}>
                  <p>Available Balance:</p>
                  <p>0.0105 ETH</p>
                </div>
              </div>

              <div className={stylesModal.sendModalfooter}>
                <img src={maticImg} alt="matic icon" />
                <p className={stylesModal.gasFee}>x.xxx {props.name} Gas Fee</p>
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
