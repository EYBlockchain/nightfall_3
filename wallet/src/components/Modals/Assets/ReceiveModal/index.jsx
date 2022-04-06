import React from 'react';
import './styles.scss';
import PropTypes from 'prop-types';

const ReceiveModal = ({ handleClose, show }) => {
  return (
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
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Nulla repellendus nisi, sunt
              consectetur ipsa velit repudiandae aperiam modi quisquam nihil nam asperiores
              doloremque mollitia dolor deleniti quibusdam nemo commodi ab.
            </p>
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
  show: PropTypes.bool.isRequired,
};
