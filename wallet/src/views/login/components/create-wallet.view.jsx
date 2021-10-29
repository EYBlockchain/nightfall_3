import React from 'react';
import { Button, Modal, Form, Icon } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { DEFAULT_PRIVATE_KEY } from '../../../constants';

function CreateWalletModal({ login, modalPrivateKey, handleClickOnImport, toggleModalPrivateKey }) {
  const [privateKey, setPrivateKey] = React.useState('');

  const handleSubmit = () => {
    const myPrivateKey = privateKey === '' ? DEFAULT_PRIVATE_KEY : privateKey;
    handleClickOnImport(myPrivateKey);
    toggleModalPrivateKey();
  };

  return (
    <Modal open={modalPrivateKey}>
      <Modal.Header>Create Nightfall Wallet</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleSubmit}>
          <Form.Field>
            <label htmlFor="private-key">
              Private Key
              <input
                type="text"
                placeholder={
                  login.isWalletInitialized ? login.nf3.ethereumSigningKey : DEFAULT_PRIVATE_KEY
                }
                onChange={event => setPrivateKey(event.target.value)}
              />
            </label>
          </Form.Field>
          <Modal.Actions>
            <Button floated="left" color="red" onClick={toggleModalPrivateKey}>
              <Icon name="cancel" />
              Cancel
            </Button>
            <Button floated="right" color="blue" type="submit">
              <Icon name="send" />
              Submit
            </Button>
          </Modal.Actions>
        </Form>
      </Modal.Content>
    </Modal>
  );
}

CreateWalletModal.propTypes = {
  login: PropTypes.object.isRequired,
  modalPrivateKey: PropTypes.bool.isRequired,
  handleClickOnImport: PropTypes.func.isRequired,
  toggleModalPrivateKey: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(CreateWalletModal);
