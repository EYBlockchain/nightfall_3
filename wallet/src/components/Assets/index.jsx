import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/assets.module.scss';
import ReceiveModal from '../Modals/Assets/ReceiveModal';

export default function Assets({ tokenList }) {

  const [showReceiveModal, setShowReceiveModal] = useState(false);

  console.log(tokenList);
  const total = tokenList.reduce(
    (acc, curr) => acc + Number(curr.maticChainUsdBalance) * Number(curr.maticChainBalance),
    0,
  );

  return (
    <div>
      {showReceiveModal && (
        <div className="modalWrapper">
          <ReceiveModal handleClose={setShowReceiveModal} />
        </div>
      )}
      <div className={styles.dashboardTopSection}>
        <div className={styles.container}>
          <div className="row">
            <div className="col-lg-6">
              <div className={styles.heading}>Nightfall</div>
              <div className={styles.amount}>&#36;{total.toFixed(2)}</div>
              <div className={styles.buttonsWrapper}>
                <button className="" icon-name="navbar/qr" onClick={() => setShowReceiveModal(true)}>
                  Receive
                </button>
                <button icon-name="navbar/send" onClick={() => {}}>
                  Send
                </button>
              </div>
            </div>

            <div className="col-lg-6">
              <div className={styles.depositWrapper}>
                <a
                  className={styles.linkButton}
                  href="USER_GUIDE_DOCS_LINK"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How it works?
                  {/* <svg-sprite-icon
                                      name="right-arrow-white"
                                      className="right-arrow-white"
                                  /> */}
                </a>

                <button className={styles.linkButton} onClick={() => {}}>
                  Move funds from
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* <receive-qr-code
              v-if="showReceiveModal"
              :uri="account.address"
              :close="toggleReceiveTokenModal"
              />
              <send-token-modal v-if="showSendModal" :cancel="toggleSendTokenModal" /> */}
      </div>
    </div>
  );
}

Assets.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
