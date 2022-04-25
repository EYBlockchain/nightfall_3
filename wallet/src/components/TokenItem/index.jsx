import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import importTokens from '@TokenList/index';
import { getWalletBalance } from '@Nightfall/services/commitment-storage';
import styles from '../../styles/tokenItem.module.scss';
import metamaskIcon from '../../assets/svg/metamask.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import SendModal from '../Modals/sendModal';

const supportedTokens = importTokens();

export default function TokenItem(props) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const [filteredTokens, setFilteredTokens] = useState(supportedTokens);

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
              {/* <div className={styles.plasmaTag}> plasma </div> */}
            </div>
            <div className={styles.tokenNameLowerSection}>
              <span className={styles.seperatingDot}> • </span>
              {props.name}
            </div>
            <div className={styles.plasmaTag}>Nightfall</div>
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
              onClick={async () => {
                await changeChain('polygon', setShowSendModal);
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
      <SendModal
        show={showSendModal}
        onHide={() => setShowSendModal(false)}
        currencyValue={props.currencyValue}
        l2Balance={props.l2Balance}
        name={props.name}
        symbol={props.symbol}
        address={props.address}
        logoURI={props.logoURI}
        decimals={props.decimals}
      />
    </div>
  );
}

TokenItem.propTypes = {
  currencyValue: PropTypes.number.isRequired,
  l2Balance: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  symbol: PropTypes.string.isRequired,
  tokenAddress: PropTypes.string.isRequired,
  changeChain: PropTypes.func.isRequired,
  address: PropTypes.string.isRequired,
  logoURI: PropTypes.string.isRequired,
  decimals: PropTypes.number.isRequired,
};
