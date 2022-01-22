import React from 'react';
import styles from '../../styles/bridge.module.scss';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import polygonChainImage from '../../assets/img/polygon-chain.svg';
import ethChainImage from '../../assets/img/ethereum-chain.svg';
import discloserBottomImage from '../../assets/img/discloser-bottom.svg';
import lightArrowImage from '../../assets/img/light-arrow.svg';
import { useState } from 'react';

export default function Bridge() {

  return (
    // containerFluid
    <div className={styles.blueBack}>
      {/* <WarningBanner className="warning-banner" /> */}

      <div className={styles.pagePartition}>
        <div className={styles.infoWrapper}>
          <div className={styles.innerWrapper}>
            <div className={styles.headerH2}>Nightfall Bridge</div>
            <div className={styles.description}>
              The safe, fast and most secure way to bring cross-chain assets to Ethereum.
            </div>
            <div className={styles.points}>
              {/* v-tooltip="{
                                content: fastWithdrawInfoMsg,
                                placement: 'top-center',
                            }"
                            :to="{ name: 'fast-withdraw' }" 
                            For link below */}
              <a className={styles.linkButton}>Fast Withdraw</a>
              {/* :to="{ name: 'on-ramp' }" 
                            For link below */}
              <a className={styles.linkButton}>On Ramp Transfers</a>
              <a
                id="youtube-video-tutorial"
                className={styles.linkButton}
                href="YOUTUBE_VIDEO_TUTORIAL"
                target="_blank"
                rel="noopener noreferrer"
              >
                How it works?
              </a>
              <a
                id="faq-docs"
                className={styles.linkButton}
                href="FAQ_DOCS_LINK"
                target="_blank"
                rel="noopener noreferrer"
              >
                FAQ
              </a>
              <a
                id="user-guide"
                className={styles.linkButton}
                href="USER_GUIDE_DOCS_LINK"
                target="_blank"
                rel="noopener noreferrer"
              >
                User guide
              </a>
            </div>
          </div>
          <div className={styles.bottomSection}>
            <img src={bridgeInfoImage} alt="" height="219" width="326" />
          </div>
        </div>
        <div className={styles.bridgeWrapper}>
          <div>
            {/* class="{
                            'bridge-tabs__withdraw-active':
                                transferType === TRANSACTION_TYPE.WITHDRAW,
                        }" for div below */}
            <div className={styles.bridgeTabs}>
              {/* onclick = "onSwitchTransferType" */}
              <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Deposit
              </div>
              {/* onclick = "onSwitchTransferType" */}
              <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Withdraw
              </div>
            </div>

            <div className={styles.bridgeBody}>
              <div className={styles.fromLabel}>From</div>
              <div className={styles.fromSection}>
                <div className={styles.chainAndBalanceDetails}>
                  <div className={styles.chainDetails}>
                    {/* The first is a mock after we need to figure out how to 
                                        make this conditional */}
                    <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
                    {/* <img
                                            v-if="transferType === TRANSACTION_TYPE.WITHDRAW"
                                            src="~/assets/img/polygon-chain.svg"
                                            alt="polygon chain logo"
                                            height="24"
                                            width="24"
                                        > */}
                    {/* <img
                                            v-else-if="transferType === TRANSACTION_TYPE.DEPOSIT"
                                            src="~/assets/img/ethereum-chain.svg"
                                            alt="ethereum chain logo"
                                            height="24"
                                            width="24"
                                        > */}
                    {/* {{
                                            transferType === TRANSACTION_TYPE.DEPOSIT
                                                ? parentNetwork.name
                                                : childNetwork.name
                                        }} For div below */}
                    <div className={styles.chainDetails__chainName}>Polygon mock chain</div>
                  </div>
                  {/* The first is mock. After we need to refactor for the scond div below */}
                  <div className={styles.balanceDetails}>
                    <span className={styles.balanceDetails__label}>Balance:</span>
                    <span
                      v-tooltip="formattedSenderFullBalance"
                      className={styles.balanceDetails__balance}
                    >
                      10 ETH
                    </span>
                  </div>
                  {/* <div The same of the above div but original from vue
                                        v-if="selectedToken"
                                        class="balance-details font-label-extra-small"
                                    >
                                        <span class="balance-details__label"> Balance: </span>
                                        <span
                                            v-tooltip="formattedSenderFullBalance"
                                            class="balance-details__balance"
                                        >{{ selectedToken.getBalance(senderNetworkId).dp(5) }}
                                            {{ selectedToken.symbol }}
                                        </span>
                                    </div> */}
                </div>

                {/* <div v-if="selectedToken" class="token-and-amount-details">  */}
                <div className={styles.tokenAndAmountDetails}>
                  {/* @click="onChooseTokenOpen" */}
                  <div className={styles.tokenDetails} onClick={() => {}}>
                    {/* <img
                                            v-if="!!tokenImage(selectedToken)"
                                            class="token-details__token-img"
                                            :src="tokenImage(selectedToken)"
                                            alt="token icon"
                                            height="24"
                                            width="24"
                                        > */}
                    {/* src={"tokenImage(selectedToken)"} */}
                    <img
                      className="token-details__token-img"
                      src={ethChainImage}
                      alt="token icon"
                      height="24"
                      width="24"
                    />

                    <div className={styles.tokenDetails__tokenName}>
                      {/* {{ isDepositEther ? isDepositEther : selectedToken.name }} */}
                      ETH
                    </div>
                    <img
                      className={styles.tokenDetails__arrow}
                      src={discloserBottomImage}
                      alt="discloser icon"
                      height="24"
                      width="24"
                    />
                  </div>
                  <div className={styles.amountDetails}>
                    <input
                      className={styles.amountDetails__textfield}
                      type="text"
                      placeholder="0.00"
                    />
                    {/* <input
                                            className={styles.amountDetails__textfield}
                                            type="text"
                                            value="toSendInToken"
                                            placeholder="0.00"
                                            input="setAmount"
                                        /> */}

                    <button
                      className={styles.amountDetails__maxButton}
                      onClick={() => {}}
                      variant="light"
                    >
                      MAX
                    </button>
                    {/* <Button
                                            v-if="showMax"
                                            class="amount-details__max-button"
                                            label="MAX"
                                            nature="link"
                                            size="small"
                                            @onClick="handleMaxClick"
                                        /> */}
                  </div>
                </div>
              </div>
              <div className={styles.downArrowSection}>
                <img src={lightArrowImage} alt="to arrow" />
              </div>
              <div className={styles.toLabel}>To</div>
              <div className={styles.toChainAndBalanceDetails}>
                                <div className={styles.chainDetails}>
                                    {/* <img
                                        v-if="transferType === TRANSACTION_TYPE.DEPOSIT"
                                        src="~/assets/img/polygon-chain.svg"
                                        alt="polygon chain logo"
                                        height="24"
                                        width="24"
                                    >
                                    <img
                                        v-else-if="transferType === TRANSACTION_TYPE.WITHDRAW"
                                        src="~/assets/img/ethereum-chain.svg"
                                        alt="ethereum chain logo"
                                        height="24"
                                        width="24"
                                    > */}

                                    {/* <div class="chain-details__chain-name font-label-small">
                                    {{
                                        transferType === TRANSACTION_TYPE.WITHDRAW
                                        ? parentNetwork.name
                                        : childNetwork.name
                                    }}
                                        chain
                                    </div> */}
                                    <div className={styles.chainDetails__chainName}>                            
                                        Polygon mock chain
                                    </div>
                                </div>
                                {/* <div
                                    v-if="selectedToken"
                                    class="balance-details font-label-extra-small"
                                >
                                    <span class="balance-details__label"> Balance: </span>
                                    <span
                                        v-tooltip="formattedReceiverFullBalance"
                                        class="balance-details__balance"
                                    >{{ selectedToken.getBalance(receiverNetworkId).dp(5) }}
                                        {{ selectedToken.symbol }}
                                    </span>
                                </div>  SAME OF BELOW */}                                 
                                <div                                    
                                    className={styles.balanceDetails}
                                >
                                    <span className={styles.balanceDetails__label}> Balance: </span>
                                    <span                                        
                                        className={styles.balanceDetails__balance}
                                    >
                                        10 MATIC
                                    </span>
                                </div>
                            </div>
            </div>
            <div className={styles.transferMode}>
                            {/* <span class="transfer-mode__label"> Transfer Mode: </span>
                            <span class="bridge-type">{{ selectedMode }} Bridge</span> */}
                            <span className={styles.transferMode__label}> Transfer Mode: </span>
                            <span className={styles.bridgeType}>Deposit Bridge</span>
                            {/* <span
                                v-if="
                                isPosPlasmaCommonToken &&
                                    (!plasmaDepositDisabledTokens ||
                                    transferType === TRANSACTION_TYPE.WITHDRAW)
                                "
                                id="switch-transfer-mode"
                                class="switch-bridge cursor-pointer cap-xs"
                                @click="onTransferModeOpen"
                            >
                                (Switch Bridge)
                            </span> */}
                        </div>
            <div>
              {/* <Button
                                id="transfer-token"
                                nature="primary"
                                size="large"
                                class="transfer-button w-100"
                                label="Transfer"
                                :disabled="disableTransferButton || isTokenDisabled"
                                @onClick="transferToken"
                            /> */}
                            <button                                                         
                                className={styles.transferButton}                                                                
                                onClick={() => {}}
                            >Transfer</button>

              {/* <div v-if="error" class="error-message text-danger font-caption">
                                {{ error }}
                            </div> */}
            </div>
          </div>
        </div>

        {/* Add 'onSelect' prop here */}
        {/* <choose-token
                :show="showChooseToken"
                :onSelect="onSelectToken"
                :cancel="onTokenClose"
                :transactionType="transferType"
            /> */}

        {/* POS or PLASMA */}
        {/* <transfer-mode-modal
                v-if="showTransferMode"
                :cancel="onTransferModeClose"
                :change="onTransferModeChange"
            /> */}

        {/* FAST or NORMAL */}
             

        {/* <deposit-modal
                    v-else-if="showDepositModal"
                    :show="showDepositModal"
                    :cancel="onDepositClose"
                    :transferMode="transferMode"
                    :toSendInToken="toSendInToken"
                    :selectedToken="currentSelectedToken"
                    :overviewCheck="false"
                    :allowanceCheck="allowance"
                /> */}

        {/* <fast-deposit-modal
                    v-else-if="showFastDepositModal"
                    :show="showFastDepositModal"
                    :cancel="onFastDepositClose"
                    :transferMode="transferMode"
                    :toSendInToken="toSendInToken"
                    :selectedToken="currentSelectedToken"
                    :overviewCheck="false"
                    :allowanceCheck="allowance"
                /> */}

        {/* <withdraw-modal
                    v-else-if="showWithdrawModal"
                    :show="showWithdrawModal"
                    :cancel="onWithdrawClose"
                    :transferMode="transferMode"
                    :toSendInToken="toSendInToken"
                    :selectedToken="currentSelectedToken"
                    :overviewCheck="false"
                /> */}
        {/* <fast-withdraw-modal
                    v-else-if="showFastWithdrawModal"
                    :show="showFastWithdrawModal"
                    :cancel="onFastWithdrawClose"
                    :transferMode="transferMode"
                    :toSendInToken="toSendInToken"
                    :selectedToken="currentSelectedToken"
                    :overviewCheck="false"
                /> */}
      </div>
    </div>
  );
}
