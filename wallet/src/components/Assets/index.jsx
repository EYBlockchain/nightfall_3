import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../../styles/assets.scss';
import ReceiveModal from '../Modals/Assets/ReceiveModal/index.jsx';

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
          <ReceiveModal show={showReceiveModal} handleClose={setShowReceiveModal} />
        </div>
      )}
      <div className="dashboardTopSection">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <div className="heading">Nightfall</div>
              <div className="amount">&#36;{total.toFixed(2)}</div>
              <div className="buttonsWrapper">
                <button
                  className=""
                  icon-name="navbar/qr"
                  onClick={() => setShowReceiveModal(true)}
                >
                  Receive
                </button>
                <button icon-name="navbar/send" onClick={() => {}}>
                  Send
                </button>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="depositWrapper">
                <a
                  className="linkButton"
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

                <button className="linkButton" onClick={() => {}}>
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
