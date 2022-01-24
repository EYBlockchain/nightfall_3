import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import { MdArrowForwardIos } from 'react-icons/md';
import * as Nf3 from 'nf3';
import { Link, useLocation } from 'react-router-dom';
import Button from 'react-bootstrap/esm/Button';
import ToggleButton from 'react-bootstrap/ToggleButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import styles from '../../styles/bridge.module.scss';
import stylesModal from '../../styles/modal.module.scss';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import polygonChainImage from '../../assets/img/polygon-chain.svg';
import ethChainImage from '../../assets/img/ethereum-chain.svg';
import discloserBottomImage from '../../assets/img/discloser-bottom.svg';
import lightArrowImage from '../../assets/img/light-arrow.svg';
import testImage from '../../assets/img/fast-withdraw/evodefi.png';
import { UserContext } from '../../hooks/User';
import deposit from '../../nightfall-browser/services/deposit';
import withdraw from '../../nightfall-browser/services/withdraw';

export default function Bridge() {
  const [state] = React.useContext(UserContext);
  const [transferMethod, setMethod] = React.useState('On-Chain');
  const location = useLocation();

  const initialTx = location.tokenState?.initialTxType || 'deposit';

  const [txType, setTxType] = useState(initialTx);
  const [tokenAmountWei, setTransferValue] = useState(0);
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  console.log('Location', location);
  console.log('Bridge State', state);
  async function triggerTx() {
    console.log('Tx Triggered');
    switch (txType) {
      case 'deposit': {
        await Nf3.Tokens.approve(
          location.tokenState.tokenAddress,
          state.nf3.ethereumAddress,
          state.nf3.shieldContractAddress,
          'ERC20',
          tokenAmountWei,
          state.nf3.web3,
        );
        const { rawTransaction } = await deposit({
          ercAddress: location.tokenState.tokenAddress,
          tokenId: 0,
          value: tokenAmountWei,
          pkd: state.zkpKeys.pkd,
          nsk: state.zkpKeys.nsk,
          fee: 1,
          tokenType: 'ERC20',
        });
        return state.nf3.submitTransaction(rawTransaction, state.nf3.shieldContractAddress, 1);
      }

      case 'withdraw': {
        await withdraw({
          ercAddress: location.tokenState.tokenAddress,
          tokenId: 0,
          value: tokenAmountWei,
          recipientAddress: state.nf3.ethereumAddress,
          nsk: state.zkpKeys.nsk,
          ask: state.zkpKeys.ask,
          tokenType: 'ERC20',
          fees: 1,
        });
        const { rawTransaction } = await deposit({
          ercAddress: location.tokenState.tokenAddress,
          tokenId: 0,
          value: tokenAmountWei,
          pkd: state.zkpKeys.pkd,
          nsk: state.zkpKeys.nsk,
          fee: 1,
          tokenType: 'ERC20',
        });
        console.log('rawTransaction', rawTransaction);
        console.log('props', location);
        return state.nf3.submitTransaction(rawTransaction, state.nf3.shieldContractAddress, 1);
      }

      default:
        break;
    }
    return true;
  }

  return (
    // containerFluid
    <div className={styles.blueBack}>
      {/* <WarningBanner className="warning-banner" /> */}

      <div className={styles.pagePartition}>
        <div className={styles.infoWrapper}>
          <div className={styles.innerWrapper}>
            <div className={styles.headerH2}>Nightfall Bridge</div>
            <div className={styles.description}>
              Safe, fast and private token transfers on Ethereum.
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
            <div>
              <ButtonGroup className={styles.bridgeTabs__tab}>
                <ToggleButton
                  type="radio"
                  variant="outline-secondary"
                  value={'deposit'}
                  checked={txType === 'deposit'}
                  onClick={() => setTxType('deposit')}
                  // onChange={e => setRadioValue(e.currentTarget.value)}
                >
                  Deposit
                </ToggleButton>
                <ToggleButton
                  type="radio"
                  variant="outline-secondary"
                  value="withdraw"
                  checked={txType === 'withdraw'}
                  onClick={() => setTxType('withdraw')}
                  // onChange={e => setRadioValue(e.currentTarget.value)}
                >
                  Withdraw
                </ToggleButton>
              </ButtonGroup>
              {/* <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Deposit"outline-secondary"              </div>
              <div className={styles.bridgeTabs__tab} onClick={() => {}}>
                Withdraw
              </div> */}
            </div>

            <div className={styles.bridgeBody}>
              <div className={styles.fromLabel}>From</div>
              <div className={styles.fromSection}>
                <div className={styles.chainAndBalanceDetails}>
                  <div className={styles.chainDetails}>
                    {/* The first is a mock after we need to figure out how to 
                                        make this conditional */}
                    {txType === 'deposit' ? (
                      <img src={ethChainImage} alt="ethereum chain logo" height="24" width="24" />
                    ) : (
                      <img
                        src={polygonChainImage}
                        alt="polygon chain logo"
                        height="24"
                        width="24"
                      />
                    )}
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
                    <div className={styles.chainDetails__chainName}>
                      {txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}
                    </div>
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
                    <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />

                    <div className={styles.tokenDetails__tokenName}>
                      {/* {{ isDepositEther ? isDepositEther : selectedToken.name }} */}
                      MATIC
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
                      value={tokenAmountWei}
                      onChange={e => setTransferValue(e.target.value)}
                    />
                    <button
                      className={styles.amountDetails__maxButton}
                      onClick={() => {}}
                      variant="light"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>
              <div className={styles.downArrowSection}>
                <img src={lightArrowImage} alt="to arrow" />
              </div>
              <div className={styles.toLabel}>To</div>
              <div className={styles.toChainAndBalanceDetails}>
                <div className={styles.chainDetails}>
                  {txType === 'withdraw' ? (
                    <img src={ethChainImage} alt="ethereum chain logo" height="24" width="24" />
                  ) : (
                    <img src={polygonChainImage} alt="polygon chain logo" height="24" width="24" />
                  )}
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
                    {txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}
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
                <div className={styles.balanceDetails}>
                  <span className={styles.balanceDetails__label}> Balance: </span>
                  <span className={styles.balanceDetails__balance}>10 MATIC</span>
                </div>
              </div>
            </div>
            <div className={styles.transferMode}>
              {/* <span class="transfer-mode__label"> Transfer Mode: </span>
                            <span class="bridge-type">{{ selectedMode }} Bridge</span> */}
              <span className={styles.transferMode__label}> Transfer Mode: </span>
              <span className={styles.bridgeType}>
                {txType.charAt(0).toUpperCase() + txType.slice(1)} Bridge
              </span>
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
              <button className={styles.transferButton} onClick={handleShow}>
                Transfer
                {/* <button
                className={styles.transferButton}
                onClick={() => {
                  triggerTx();
                }}
              >
                Transfer */}
              </button>

              {/* <div v-if="error" class="error-message text-danger font-caption">
                                {{ error }}
                            </div> */}
            </div>
            <div>
              <Link to="/wallet">
                <Button variant="outline-secondary">Return to Wallet</Button>{' '}
              </Link>
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
        <Modal contentClassName={stylesModal.modalFather} show={show} onHide={() => setShow(false)}>
          <Modal.Header closeButton>
            <div className={styles.modalTitle}>Confirm transaction</div>
          </Modal.Header>
          <Modal.Body>
            <div className={stylesModal.modalBody}>
              <div className={stylesModal.tokenDetails}>
                {/* d-flex justify-content-center align-self-center mx-auto */}
                <div className={stylesModal.tokenDetails__img}>
                  {/* <img
                                      v-if="
                                      selectedToken.symbol &&
                                          !!tokenImage(selectedToken)
                                      "
                                      class="align-self-center"
                                      :src="tokenImage(selectedToken)"
                                      alt="Token Image"
                                  > */}
                  <img src={testImage} alt="Token Image" />
                  {/* <span
                                      v-else-if="selectedToken.symbol"
                                      class="align-self-center font-heading-large ps-t-2 font-semibold"
                                  >{{ selectedToken.symbol[0] }}</span> */}
                </div>
                {/* font-heading-large font-bold ps-t-16 ps-b-6 */}
                <div className={stylesModal.tokenDetails__val}>{tokenAmountWei}</div>
                {/* font-body-small */}
                <div className={stylesModal.tokenDetails__usd}>$xx.xx</div>
              </div>

              {/* Buttons */}
              <div>
                <div className={stylesModal.networkButtons}>
                  <div className={stylesModal.networkButtons__button1}>
                    <span>
                      {txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}
                    </span>
                  </div>
                  <MdArrowForwardIos />
                  <div className={stylesModal.networkButtons__button2}>
                    <span>
                      {txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={stylesModal.divider}></div>
              <div className={stylesModal.transferModeModal}>
                <div className={stylesModal.transferModeModal__title}>
                  <div className={stylesModal.transferModeModal__title__main}>Transfer Mode</div>
                  <div className={stylesModal.transferModeModal__title__light}>
                    <DropdownButton variant="light" title={transferMethod}>
                      <Dropdown.Item onClick={() => setMethod('On-Chain')}>On-Chain</Dropdown.Item>
                      <Dropdown.Item onClick={() => setMethod('Direct Transfer')}>
                        Direct Transfer
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => setMethod('Instant Withdrawal')}>
                        Instant Withdrawal
                      </Dropdown.Item>
                    </DropdownButton>
                  </div>
                </div>
                <div className={stylesModal.transferModeModal__text}>
                  <span>PoS security is provided by the PoS validators.</span>
                  {/* <span v-else>
                                  Plasma provides advanced security with plasma exit
                                  mechanism. </span>It will take approximately */}
                  <span> It will take approximately </span>
                  <span className="text-primary"> 3 hours</span> when you have to transfer your
                  funds back to Ethereum.
                </div>
              </div>
              <div className={stylesModal.divider}></div>
              <div className={stylesModal.estimationFee}>
                <div className={stylesModal.estimationFee__title}>
                  <div className={stylesModal.estimationFee__title__main}>
                    Estimation Transaction fee
                  </div>
                  <div className={stylesModal.estimationFee__title__light}>~ $113,59</div>
                </div>
                <button className={stylesModal.continueTrasferButton} onClick={() => triggerTx()}>
                  Continue
                </button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

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
