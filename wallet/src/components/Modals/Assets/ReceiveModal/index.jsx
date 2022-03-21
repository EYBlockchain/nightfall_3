import React, { Dispatch, SetStateAction, useContext } from 'react';
import "./styles.scss";
import Modal from 'react-bootstrap/Modal';
import QRCode from 'qrcode.react';
import { UserContext } from '../../../../hooks/User';


// type ReceiveModalType = {
//   handleClose: Dispatch<SetStateAction<boolean>>;
// };

const ReceiveModal = ({ handleClose }) => {  

  const [state] = useContext(UserContext);
  
  return (
    <div>
      <Modal className="modal_wrapper" show={true} onHide={() => handleClose(false)}>
        <Modal.Header closeButton>
          <div className="tokens_itens_modal_header">          
            <p className="tokens_itens_modal_title">My QR Code</p>                    
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className='qrcode'>
            <QRCode value={state.zkpKeys.compressedPkd} />
          </div>
          <p>
            Wallet Address
          </p>
          <p>
            {state.zkpKeys.compressedPkd}
          </p>
        </Modal.Body>
      </Modal>    
    </div>
  )
}

export default ReceiveModal;