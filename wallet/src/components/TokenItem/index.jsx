import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import importTokens from '@TokenList/index';
import { getWalletBalance } from '@Nightfall/services/commitment-storage';
import metamaskIcon from '../../assets/svg/metamask.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import SendModal from '../Modals/sendModal';
import BigFloat from '../../common-files/classes/bigFloat';

import '../../styles/tokenItem.scss';

const supportedTokens = importTokens();

export default function TokenItem(props) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const [filteredTokens, setFilteredTokens] = useState(supportedTokens);

  useEffect(async () => {
    const l2bal = await getWalletBalance(state.compressedZkpPublicKey);
    console.log('Wallet Balance', l2bal);
    if (Object.keys(l2bal).length) {
      setFilteredTokens(
        filteredTokens.map(t => {
          const tokenIdFull = `0x${BigInt(t.tokenId ?? 0)
            .toString(16)
            .padStart(64, '0')}`;
          if (Object.hasOwnProperty.call(l2bal, t.address.toLowerCase())) {
            const tokenIdx = l2bal[t.address.toLowerCase()].findIndex(
              c => c.tokenId === tokenIdFull,
            );
            return {
              ...t,
              l2Balance: tokenIdx >= 0 ? l2bal[t.address.toLowerCase()][tokenIdx].balance : 0n,
            };
          }
          return {
            ...t,
            l2Balance: 0n,
          };
        }),
      );
    }
  }, [state]);
  const filteredTokenIdx = filteredTokens.findIndex(c => c.symbol === props.symbol);
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
              {/* "mobileView"See how to do it */}
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
                {props.decimals
                  ? new BigFloat(
                      BigInt(filteredTokens[filteredTokenIdx].l2Balance ?? props.l2Balance),
                      props.decimals,
                    ).toFixed(4)
                  : new BigFloat(
                      String(filteredTokens[filteredTokenIdx].l2Balance ?? 0),
                      props.decimals,
                    ).toFixed(4)}
              </div>
              <div className="balancesDetailsLowerSection">
                <span className="seperatingDot" id={tokenBalanceUsdId}>
                  {' '}
                  •{' '}
                </span>
                $
                {props.decimals
                  ? new BigFloat(BigInt(props.l2Balance), props.decimals)
                      .mul(props.currencyValue)
                      .toFixed(4)
                  : new BigFloat(
                      String(filteredTokens[filteredTokenIdx].l2Balance ?? 0),
                      props.decimals,
                    )
                      .mul(props.currencyValue)
                      .toFixed(4)}
              </div>
            </div>
          </div>
          <div className="buttonsSection">
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenSymbol: props.symbol,
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
                  tokenSymbol: props.symbol,
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
        tokenId={props.tokenId}
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
  tokenId: PropTypes.string.isRequired,
};
