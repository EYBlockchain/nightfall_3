import React from 'react';
import { Button, Modal, Form, Icon, Input, Checkbox, Divider } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as Storage from '../../../../utils/lib/local-storage';

function AccountSettingsModal({ login, accountSettingsEnable, toggleAccountSettings }) {
  if (typeof login.nf3 === 'undefined' || Object.keys(login.nf3).length === 0) {
    return null;
  }
  const [addressIndex, setAddressIndex] = React.useState(login.nf3.mnemonic.addressIndex);
  const [clearLocalStorage, setClearLocalStorage] = React.useState(false);

  const handleSubmit = async () => {
    if (login.nf3.mnemonic.addressIndex !== addressIndex) {
      login.nf3.setzkpKeysFromMnemonic('', addressIndex);
    }

    if (clearLocalStorage) {
      Storage.clear();
    }

    setClearLocalStorage(false);
    toggleAccountSettings();
  };

  const toggleClearLocalStorage = () => {
    setClearLocalStorage(!clearLocalStorage);
  };

  return (
    <Modal open={accountSettingsEnable}>
      <Modal.Header>Account Settings</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Field>
            <Input
              type="number"
              min="0"
              label="Address Index"
              placeholder={login.nf3.mnemonic.addressIndex}
              onChange={event => setAddressIndex(event.target.value)}
            />
          </Form.Field>
          <Divider />
          <Form.Field>
            <Checkbox
              toggle
              label="Clear Local Storage"
              checked={clearLocalStorage}
              onChange={toggleClearLocalStorage}
            />
          </Form.Field>
          <Divider />
          <Modal.Actions>
            <Button floated="right" primary onClick={handleSubmit}>
              <Icon name="save" />
              Save
            </Button>
          </Modal.Actions>
        </Form>
      </Modal.Content>
    </Modal>
  );
}

AccountSettingsModal.propTypes = {
  login: PropTypes.object.isRequired,
  accountSettingsEnable: PropTypes.bool.isRequired,
  toggleAccountSettings: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(AccountSettingsModal);
