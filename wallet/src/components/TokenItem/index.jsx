import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import styles from '../../styles/tokenItem.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import starFilled from '../../assets/svg/star-filled.svg';
import metamaskIcon from '../../assets/svg/metamask.svg';
import ethereumImg from '../../assets/img/ethereum-chain.svg';
import polyImg from '../../assets/img/polygon-chain.svg';

export default function TokenItem({ token }) {
  const [showSendModal, setShowSendModal] = useState(false);

  return (
    <div>
      {/* <div class="matic-tokens-list-item" @click="onTokenClick"> */}
      <div className={styles.maticTokensListItem} onClick={() => {}}>
        <div className={styles.star}>
          <img src={starFilled} alt="" />
        </div>
        {/* <img
                    v-if="isFavourite"
                    src="~/assets/svg/star-filled.svg"
                    alt="favourite"
                    class="star desktop-view cursor-pointer"
                    @click="handleMarkUnfavourite"
                />
                <img
                    v-else
                    src="~/assets/svg/star.svg"
                    alt="unfavourite"
                    class="star desktop-view on-hover-only cursor-pointer"
                    @click="handleMarkFavourite"
                /> */}

        {/* <div class="token-image">
                    <img
                        v-if="!!tokenImage(token)"
                        class="token-img"
                        :src="tokenImage(token)"
                        alt="token icon"
                    >
                    <div v-else-if="token.symbol" class="token-image-letter font-semibold">
                        {{ token.symbol[0] }}
                    </div>
                </div> */}

        <div className={styles.tokenDetails}>
          <div className={styles.tokenNameDetails}>
            <div className={styles.tokenNameUpperSection}>
              {/* <div class="token-symbol header-h6"> */}
              <div className={styles.headerH6}>{token.symbol}</div>
              {/* styles.mobileView See how to do it */}
              <div v-if="!token.isPoS" className={styles.plasmaTag}>
                plasma
              </div>
              {/* <img
                                v-if="isFavourite"
                                src="~/src/assets/svg/star-filled.svg"
                                alt=""
                                className={styles.star, styles.mobileView}
                            /> */}
            </div>
            <div className={styles.tokenNameLowerSection}>
              <span className={styles.seperatingDot}> • </span>
              {token.name}
            </div>
            {true && (
              // v-if="!token.isPoS"
              // styles.desktopView See how TODO it
              <div className={styles.plasmaTag}>plasma</div>
            )}
          </div>
          <div className={styles.balancesDetails}>
            <div className={styles.balancesWrapper}>
              <div className={styles.balancesDetailsUpperSection}>
                {/* {{ token.getMaticChainBalance | fixed(4) }} */}
                {token.maticChainBalance}
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
                <span className={styles.seperatingDot}> • </span>
                {token.maticChainUsdBalance}
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
            <a href="/bridge" className={styles.tokenListButton}>
              Deposit
            </a>
            {/* v-tooltip="isWithdrawDisabled(token) ? 'Not Supported' : null"
                        :to="{
                            name: 'bridge',
                            params: { type: TRANSACTION_TYPE.WITHDRAW, token },
                        }"
                        :event="isWithdrawDisabled(token) ? '' : 'click'" */}
            <a href="/bridge" className={styles.tokenListButton}>
              Withdraw
            </a>
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
                <input type="text" />
                <p>Enter valid address existing on the Polygon Network</p>
              </div>
              <div className={stylesModal.sendModalBalance}>
                <div className={stylesModal.letfItems}>
                  <input type="text" placeholder="0.00" />
                  <div className={stylesModal.maxButton}>MAX</div>
                </div>
                <div className={stylesModal.rightItems}>
                  <img src={ethereumImg} />
                  <div>Ether (PoS-WETH)</div>
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
                <p className={stylesModal.gasFee}>0.00000000 nameToken Gas Fee</p>
              </div>
            </div>
            <button className={stylesModal.continueTrasferButton}>Continue</button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

TokenItem.propTypes = {
  token: PropTypes.element.isRequired,
};
