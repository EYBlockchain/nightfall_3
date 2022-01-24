import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import styles from '../../styles/tokenItem.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import starFilled from '../../assets/svg/star-filled.svg';
// import starFilled from '../../assets/svg/star-filled.svg';
import matic from '../../assets/svg/matic.svg';
import usdt from '../../assets/svg/usdt.svg';
import link from '../../assets/svg/link.svg';
import aave from '../../assets/svg/aave.svg';
import metamaskIcon from '../../assets/svg/metamask.svg';
import ethereumImg from '../../assets/img/ethereum-chain.svg';
import maticImg from '../../assets/img/polygon-chain.svg';
import polyImg from '../../assets/img/polygon-chain.svg';
import { UserContext } from '../../hooks/User';
import transfer from '../../nightfall-browser/services/transfer';

// export default function TokenItem({ token }) {

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
  const [sendAddress, setSendAddress] = useState(state?.zkpKeys?.compressedPkd)
  const [valueToSend, setTransferValue] = useState(0)

  async function sendTx() {
    const { rawTransaction } = await transfer({
      offchain: true,
      ercAddress: tokenAddress,
      tokenId: 0,
      recipientData: {
        recipientCompressedPkds: [sendAddress],
        values: [valueToSend],
      },
      nsk: state.zkpKeys.nsk,
      ask: state.zkpKeys.ask,
      fee: 1,
    });
    return state.nf3.submitTransaction(rawTransaction, state.nf3.shieldContractAddress, 1);
  }
  return (
    <div>
      {/* <div class="matic-tokens-list-item" @click="onTokenClick"> */}
      <div className={styles.maticTokensListItem} onClick={() => {}}>
        <div className={styles.star}>{/* <img src={starFilled} alt="" /> */}</div>
        <div className={styles.maticTokensListItem}>
          <img src={symbols[symbol.toLowerCase()]} alt="token icon" />
        </div>

        <div className={styles.tokenDetails}>
          <div className={styles.tokenNameDetails}>
            <div className={styles.tokenNameUpperSection}>
              {/* <div class="token-symbol header-h6"> */}
              <div className={styles.headerH6}>{symbol}</div>
              {/* styles.mobileView See how to do it */}
              <div v-if="!token.isPoS" className={styles.plasmaTag}>
                plasma
              </div>
            </div>
            <div className={styles.tokenNameLowerSection}>
              <span className={styles.seperatingDot}> • </span>
              {name}
            </div>
            {true && <div className={styles.plasmaTag}>plasma</div>}
          </div>
          <div className={styles.balancesDetails}>
            <div className={styles.balancesWrapper}>
              <div className={styles.balancesDetailsUpperSection}>
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
              <div className={styles.balancesDetailsLowerSection}>
                {/* {{ token.maticChainUsdBalance | fixed(2) | dollarSymbol }} */}
                <span className={styles.seperatingDot}> • </span>$
                {(Number(maticChainUsdBalance) * Number(maticChainBalance)).toFixed(2)}
              </div>
            </div>
          </div>
          <div className={styles.buttonsSection}>
            {/* :to="{
                            name: 'bridge',
                            params: { type: TRANSACTION_TYPE.DEPOSIT, token },
                        }"
                        :event="isDepositDisabled(token) ? '' : 'click'" 
                        v-tooltip="isDepositDisabled(token) ? 'Not Supported' : null" */}
            <Link
              to={{
                pathname: '/bridge',
                tokenState: {
                  tokenAddress,
                  initialTxType: 'deposit',
                },
              }}
              className={styles.tokenListButton}
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
                tokenState: {
                  tokenAddress,
                  initialTxType: 'withdraw',
                },
              }}
              className={styles.tokenListButton}
            >
              Withdraw
            </Link>
            {/* onClick="handleSendToken" */}
            <button
              className={styles.tokenListButton}
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
        <div className={styles.addToMetamask} onClick={() => {}}>
          {/* <Icon name="login/metamask" class="metamask-icon" /> */}
          <img className={styles.metamaskIcon} src={metamaskIcon} alt="" />
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
                <input type="text" placeholder={state?.zkpKeys?.compressedPkd} onChange={e => setSendAddress(e.target.value)}/>
                <p>Enter a valid address existing on the Polygon Nightfall L2</p>
              </div>
              <div className={stylesModal.sendModalBalance}>
                <div className={stylesModal.letfItems}>
                  <input type="text" placeholder="0.00" onChange={e => setTransferValue(e.target.value)}/>
                  <div className={stylesModal.maxButton}>MAX</div>
                </div>
                <div className={stylesModal.rightItems}>
                  <img src={maticImg} />
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
                <img src={polyImg} />
                <p className={stylesModal.gasFee}>x.xxx {name} Gas Fee</p>
              </div>
            </div>
            <button className={stylesModal.continueTrasferButton} onClick={() => sendTx()}>Continue</button>
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
