import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import { Button, Modal } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Lottie from 'lottie-react';
import { RiQrCodeLine } from 'react-icons/ri';
import { FiSend } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from '../../styles/assets.module.scss';
import { UserContext } from '../../hooks/User';
import checkMarkYes from '../../assets/lottie/check-mark-yes.json';
import SendModal from '../Modals/sendModal';

function ReceiveModal(props) {
  const [state] = useContext(UserContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied)
      setTimeout(() => {
        setCopied(false);
      }, 1500);
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
  const [showSendModal, setShowSendModal] = useState(false);

  console.log(tokenList);
  const tokenDepositId = `TokenItem_tokenDeposit${tokenList[0].symbol}`;
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
            <div className={styles.heading}>Polygon Nightfall Testnet</div>
            <div className={styles.amount}>&#36;{total.toFixed(2)}</div>
            <div className={styles.buttonsWrapper}>
              <button className="" onClick={() => setModalShow(true)}>
                <RiQrCodeLine />
                Receive
              </button>
              <button icon-name="navbar/send" onClick={() => setShowSendModal(true)}>
                <FiSend />
                Send
              </button>
            </div>
          </div>

          <div className="col-lg-6">
            <div className={styles.depositWrapper}>
              <a
                className={styles.linkButton}
                href="https://docs.polygon.technology/docs/develop/wallets/polygon-web-wallet/web-wallet-v2-guide"
                target="_blank"
                rel="noopener noreferrer"
              >
                How it works?
              </a>

              <button className={styles.linkButton} onClick={() => {}}>
                <Link
                  to={{
                    pathname: '/bridge',
                    tokenState: {
                      tokenAddress: tokenList[0].address,
                      initialTxType: 'deposit',
                    },
                  }}
                  className={styles.tokenListButton}
                  id={tokenDepositId}
                >
                  Move funds from Goerli to Nightfall
                </Link>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ReceiveModal show={modalShow} onHide={() => setModalShow(false)} />
      <SendModal
        show={showSendModal}
        onHide={() => setShowSendModal(false)}
        currencyValue={tokenList[0].currencyValue}
        l2Balance={tokenList[0].l2Balance}
        name={tokenList[0].name}
        symbol={tokenList[0].symbol}
        address={tokenList[0].address}
        logoURI={tokenList[0].logoURI}
        decimals={tokenList[0].decimals}
      />
    </div>
  );
}

Assets.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
