import React, { Dispatch, SetStateAction, useContext } from 'react';
import "./styles.scss";
import Modal from 'react-bootstrap/Modal';
import QRCode from 'qrcode.react';
import { useUser } from '../../../../hooks/User';

// type ReceiveModalType = {
//   handleClose: Dispatch<SetStateAction<boolean>>;
// };

const ReceiveModal = ({ handleClose }) => {  

  const { userInstance } = useUser();
  
  return (
    <div>
      <Modal className="modal_wrapper" show={true} onHide={() => handleClose(false)}>
        <Modal.Header closeButton>
          <div className="tokens_itens_modal_header">          
            <p className="tokens_itens_modal_title">My QR Code</p>                    
          </div>
        </Modal.Header>
        <Modal.Body>        
          <p className="input_search_title">Choose token from <span>{userInstance.zkpKeys.compressedPkd}</span></p>                    
          <QRCode value={userInstance.zkpKeys.compressedPkd} />,
        </Modal.Body>
      </Modal>    
    </div>
  )
}

export default ReceiveModal;