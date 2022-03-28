import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import matic from '../../assets/svg/matic.svg';
import usdt from '../../assets/svg/usdt.svg';
import link from '../../assets/svg/link.svg';
import aave from '../../assets/svg/aave.svg';
import metamaskIcon from '../../assets/svg/metamask.svg';
import maticImg from '../../assets/img/polygon-chain.svg';
import { UserContext } from '../../hooks/User/index.jsx';
import transfer from '../../nightfall-browser/services/transfer';
import { getContractAddress } from '../../common-files/utils/contract';
import '../../styles/tokenItem.scss';
import '../../styles/modal.scss';

const symbols = {
  matic,
  usdt,
  link,
  aave,
};

export default function TokenItem({
  maticChainUsdBalance,
  maticChainBalance,
  name,
  symbol,
  tokenAddress,
}) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [state] = React.useContext(UserContext);
  const defaultSend = state?.zkpKeys?.compressedPkd;
  const [valueToSend, setTransferValue] = useState(0);

  async function sendTx() {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    await transfer(
      {
        offchain: true,
        ercAddress: tokenAddress,
        tokenId: 0,
        recipientData: {
          recipientCompressedPkds: [defaultSend],
          values: [valueToSend],
        },
        nsk: state.zkpKeys.nsk,
        ask: state.zkpKeys.ask,
        fee: 1,
      },
      shieldContractAddress,
    );
    console.log('Transfer Complete');
    setShowSendModal(false);
  }
  const tokenNameId = `TokenItem_tokenName${symbol}`;
  const tokenBalanceId = `TokenItem_tokenBalance${symbol}`;
  const tokenBalanceUsdId = `TokenItem_tokenBalanceUsd${symbol}`;
  const tokenDepositId = `TokenItem_tokenDeposit${symbol}`;
  const tokenWithdrawId = `TokenItem_tokenWithdraw${symbol}`;
  const tokenSendId = `TokenItem_tokenSend${symbol}`;
  return (
    <div>
      {/* <div class="matic-tokens-list-item" @click="onTokenClick"> */}
      <div className="maticTokensListItem">
        <div className="star">{/* <img src={starFilled} alt="" /> */}</div>
        <div className="maticTokensListItem">
          <img src={symbols[symbol.toLowerCase()]} alt="token icon" />
        </div>

        <div className="tokenDetails">
          <div className="tokenNameDetails">
            <div className="tokenNameUpperSection">
              {/* <div class="token-symbol header-h6"> */}
              <div className="headerH6" id={tokenNameId}>
                {symbol}
              </div>
              {/*"mobileView"See how to do it */}
              <div v-if="!token.isPoS" className="plasmaTag">
                plasma
              </div>
            </div>
            <div className="tokenNameLowerSection">
              <span className="seperatingDot"> • </span>
              {name}
            </div>
            {true && <div className="plasmaTag">plasma</div>}
          </div>
          <div className="balancesDetails">
            <div className="balancesWrapper">
              <div className="balancesDetailsUpperSection" id={tokenBalanceId}>
                {/* {{ token.getMaticChainBalance | fixed(4) }} */}
                {Number(maticChainBalance).toFixed(4)}
              </div>
              {/* <v-popover
                                trigger="hover"
                                placement="top"
                                :disabled="isMobileScreen"
                                class="hide-in-mobile"
                            >
                                <span class="seperating-dot light-gray-600"> • </span>
                                <template slot="popover">
                                <span>{{ token.getMaticChainBalance }} {{ token.symbol }}</span><br>
                                <span class="gray-color">${{ token.maticChainUsdBalance }}</span>
                                </template>
                            </v-popover> */}
              <div className="balancesDetailsLowerSection">
                {/* {{ token.maticChainUsdBalance | fixed(2) | dollarSymbol }} */}
                <span className="seperatingDot" id={tokenBalanceUsdId}>
                  {' '}
                  •{' '}
                </span>
                ${(Number(maticChainUsdBalance) * Number(maticChainBalance)).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="buttonsSection">
            {/* :to="{
                            name: 'bridge',
                            params: { type: TRANSACTION_TYPE.DEPOSIT, token },
                        }"
                        :event="isDepositDisabled(token) ? '' : 'click'" 
                        v-tooltip="isDepositDisabled(token) ? 'Not Supported' : null" */}
            <Link
              to={{
                pathname: '/bridge',
                state: {
                  tokenAddress,
                  initialTxType: 'deposit',
                },
              }}
              className="tokenListButton"
              id={tokenDepositId}
            >
              Deposit
            </Link>
            {/* v-tooltip="isWithdrawDisabled(token) ? 'Not Supported' : null"
                        :to="{
                            name: 'bridge',
                            params: { type: TRANSACTION_TYPE.WITHDRAW, token },
                        }"
                        :event="isWithdrawDisabled(token) ? '' : 'click'" */}
            <Link
              to={{
                pathname: '/bridge',
                state: {
                  tokenAddress,
                  initialTxType: 'withdraw',
                },
              }}
              className="tokenListButton"
              id={tokenWithdrawId}
            >
              Withdraw
            </Link>
            {/* onClick="handleSendToken" */}
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
        {/* cursor-pointer below */}
        {/* class="{ 'hide-it': !isLoginStrategyMetaMask }" */}
        {/* @click="handleAddTokenToMetamask" */}
        <div className="addToMetamask">
          {/* <Icon name="login/metamask" class="metamask-icon" /> */}
          <img className="metamaskIcon" src={metamaskIcon} alt="" />
        </div>
        {/* <div class="">
                {{ token }}
                </div> */}
      </div>
      {/* <div v-if="isMobileScreen">
                <div>Hellp {{ isMobileScreen }} {{ screenInnerWidth }}</div>
            </div> */}

      {/* SEND BUTTON */}
      <Modal
        contentClassName="modalFather"
        show={showSendModal}
        onHide={() => setShowSendModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Send</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="modalBody">
            <div className="sendModal">
              <div>
                <input
                  type="text"
                  placeholder={state?.zkpKeys?.compressedPkd}
                  id="TokenItem_modalSend_compressedPkd"
                />
                <p>Enter a valid address existing on the Polygon Nightfall L2</p>
              </div>
              <div className="sendModalBalance">
                <div className="letfItems">
                  <input
                    type="text"
                    placeholder="0.00"
                    onChange={e => setTransferValue(e.target.value)}
                    id="TokenItem_modalSend_tokenAmount"
                  />
                  <div className="maxButton">MAX</div>
                </div>
                <div className="rightItems" id="TokenItem_modalSend_tokenName">
                  <img src={maticImg} alt="matic" />
                  <div>Matic (L2)</div>
                  <AiOutlineDown />
                </div>
              </div>
              <div className="balanceText">
                <p>$ 0 </p>
                <div className="right">
                  <p>Available Balance:</p>
                  <p>0.0105 ETH</p>
                </div>
              </div>

              <div className="sendModalfooter">
                <img src={maticImg} alt="matic icon" />
                <p className="gasFee">x.xxx {name} Gas Fee</p>
              </div>
            </div>
            <button
              type="button"
              className="continueTrasferButton"
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
  maticChainUsdBalance: PropTypes.string.isRequired,
  maticChainBalance: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  symbol: PropTypes.string.isRequired,
  tokenAddress: PropTypes.string.isRequired,
};
