import React, { useContext, useEffect } from 'react';
import './styles.scss';
import Modal from 'react-bootstrap/Modal';
import QRCode from 'qrcode.react';
import PropTypes from 'prop-types';
import { UserContext } from '../../../../hooks/User/index.jsx';

// type ReceiveModalType = {
//   handleClose: Dispatch<SetStateAction<boolean>>;
// };

const ReceiveModal = ({ handleClose, show }) => {
  const [state] = useContext(UserContext);
  
  return (
    // <div>
    //   <Modal className="modal_wrapper" show={show} onHide={() => handleClose(false)}>
    //     <Modal.Header closeButton>
    //       <div className="tokens_itens_modal_header">
    //         <p className="tokens_itens_modal_title">My QR Code</p>
    //       </div>
    //     </Modal.Header>
    //     <Modal.Body>
    //       <div className="qrcode">
    //         <QRCode value={state.zkpKeys.compressedPkd} />
    //       </div>
    //       <p>Wallet Address</p>
    //       <p>{state.zkpKeys.compressedPkd}</p>
    //     </Modal.Body>
    //   </Modal>
    // </div>
    show && (
      <div id="my-modal" className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <span className="close">&times;</span>
            <h2>Modal Header</h2>
            <button onClick={() => handleClose(false)}>exit</button>
          </div>
          <div className="modal-body">
            <p>This is my modal</p>
            <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Nulla repellendus nisi, sunt consectetur ipsa velit
              repudiandae aperiam modi quisquam nihil nam asperiores doloremque mollitia dolor deleniti quibusdam nemo
              commodi ab.</p>
          </div>
          <div className="modal-footer">
            <h3>Modal Footer</h3>
          </div>
        </div>
      </div>                  
    )
  );
};

export default ReceiveModal;

ReceiveModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired
};
