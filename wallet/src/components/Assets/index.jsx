import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import { Button, Modal } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Lottie from 'lottie-react';
import { RiQrCodeLine } from 'react-icons/ri';
import { FiSend } from 'react-icons/fi';
import styles from '../../styles/assets.module.scss';
import { UserContext } from '../../hooks/User';
import checkMarkYes from '../../assets/lottie/check-mark-yes.json';

function ReceiveModal(props) {
  const [state] = useContext(UserContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied)
      setTimeout(() => {
        setCopied(false);
      }, 20000);
  }, [copied]);

  return (
    <div>
      <Modal
        size="lg"
        dialogClassName="modal-90w"
        centered
        className="modal_wrapper"
        show={true}
        {...props}
      >
        <Modal.Header closeButton>
          <div className={styles.tokens_items_modal_header}>
            <p className={styles.tokens_items_modal_title}>My QR Code</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className={styles.qrcode}>
            <QRCode value={state.compressedPkd} />
          </div>
          <p>Wallet Address</p>
          <p>{state.compressedPkd}</p>
        </Modal.Body>
        {copied ? (
          <Modal.Footer className={styles.copyFooter} style={{ background: 'white' }}>
            <div className="col-lg-12" style={{ background: 'white' }}>
              <Lottie
                style={{ height: '32px', width: '32px', margin: '0 auto' }}
                animationData={checkMarkYes}
                loop={true}
              />
            </div>
          </Modal.Footer>
        ) : (
          <CopyToClipboard text={state.compressedPkd} onCopy={() => setCopied(true)}>
            <Modal.Footer className={styles.copyFooter}>
              <div className="col-lg-12">
                <Button bsPrefix={styles.copyButton}>Copy Address</Button>
              </div>
            </Modal.Footer>
          </CopyToClipboard>
        )}
      </Modal>
    </div>
  );
}
export default function Assets({ tokenList }) {
  const [modalShow, setModalShow] = useState(false);
  console.log(tokenList);
  const total = tokenList.reduce(
    (acc, curr) =>
      acc + (Number(curr.currencyValue) * Number(curr.l2Balance)) / 10 ** Number(curr.decimals),
    0,
  );
  return (
    <div className={styles.dashboardTopSection}>
      <div className={styles.container}>
        <div className="row">
          <div className="col-lg-6">
            <div className={styles.heading}>Nightfall</div>
            <div className={styles.amount}>&#36;{total.toFixed(2)}</div>
            <div className={styles.buttonsWrapper}>
              <button className="" onClick={() => setModalShow(true)}>
                <RiQrCodeLine />
                Receive
              </button>
              <button icon-name="navbar/send" onClick={() => {}}>
                <FiSend />
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
      <ReceiveModal show={modalShow} onHide={() => setModalShow(false)} />
      {/* <receive-qr-code
            v-if="showReceiveModal"
            :uri="account.address"
            :close="toggleReceiveTokenModal"
            />
            <send-token-modal v-if="showSendModal" :cancel="toggleSendTokenModal" /> */}
    </div>
  );
}

Assets.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
