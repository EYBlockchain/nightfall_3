import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import metamaskIcon from '../../assets/svg/metamask.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import tokensList from '../Modals/Bridge/TokensList/tokensList';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';
import SendModal from '../Modals/sendModal';

import '../../styles/tokenItem.scss';

export default function TokenItem(props) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const [filteredTokens, setFilteredTokens] = useState(tokensList.tokens);

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
      <div className="maticTokensListItem">
        <div className="star">{/* <img src={starFilled} alt="" /> */}</div>
        <div className="maticTokensListItem">
          <img src={props.logoURI} alt="token icon" />
        </div>

        <div className="tokenDetails">
          <div className="tokenNameDetails">
            <div className="tokenNameUpperSection">
              {/* <div class="token-symbol header-h6"> */}
              <div className="headerH6" id={tokenNameId}>
                {props.symbol}
              </div>
              {/*"mobileView"See how to do it */}
              {/* <div className="plasmaTag"> plasma </div> */}
            </div>
            <div className="tokenNameLowerSection">
              <span className="seperatingDot"> • </span>
              {props.name}
            </div>
            <div className="plasmaTag">Nightfall</div>
          </div>
          <div className="balancesDetails">
            <div className="balancesWrapper">
              <div className="balancesDetailsUpperSection" id={tokenBalanceId}>
                {(Number(props.l2Balance) / 10 ** Number(props.decimals)).toFixed(4)}
              </div>
              <div className="balancesDetailsLowerSection">
                <span className="seperatingDot" id={tokenBalanceUsdId}>
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
          <div className="buttonsSection">
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenAddress: props.address,
                  initialTxType: 'deposit',
                },
              }}
              className="tokenListButton"
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
              className="tokenListButton"
              id={tokenWithdrawId}
            >
              Withdraw
            </Link>
            <button
              type="button"
              className="tokenListButton"
              id={tokenSendId}
              onClick={() => {
                setShowSendModal(true);
              }}
            >
              Send
            </button>
          </div>
        </div>
        <div className="addToMetamask">
          <img className="metamaskIcon" src={metamaskIcon} alt="" />
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
  address: PropTypes.string.isRequired,
  logoURI: PropTypes.string.isRequired,
  decimals: PropTypes.number.isRequired,
};
