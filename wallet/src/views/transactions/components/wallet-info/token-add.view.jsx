import React from 'react';
import { connect } from 'react-redux';
import { Modal, Form, Button, Icon, Input } from 'semantic-ui-react';
import PropTypes from 'prop-types';

// TODO - add props correctly
export function TokenAddModal({ modalTokenAdd, toggleModalTokenAdd, handleOnTokenAddSubmit, nf3 }) {
  const [tokenType, setTokenType] = React.useState('');
  const [tokenName, setTokenName] = React.useState('');
  const [tokenAddress, setTokenAddress] = React.useState('');

  const newTokenSubmit = () => {
    toggleModalTokenAdd();
    handleOnTokenAddSubmit(tokenName, tokenType, tokenAddress);
  };

  return (
    <Modal open={modalTokenAdd}>
      <Modal.Header> Add New Token</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleOnTokenAddSubmit}>
          <Form.Group widths="equal">
            <Form.Field>
              <label htmlFor="token-name">
                Token Name
                <input
                  type="text"
                  onChange={event => setTokenName(event.target.value)}
                  id="Token Name"
                />
              </label>
            </Form.Field>
            <span>
              Token Type{' '}
              <Dropdown
                placeholder={tokenType}
                defaultValue={tokenType}
                selection
                options={tokenTypes}
                onChange={(e, { value }) => setTokenType(value)}
              />
            </span>
          </Form.Group>
          <Form.Field>
            <label htmlFor="token-address">
              Token Address
              <input
                type="text"
                onChange={event => setTokenAddress(event.target.value)}
                id="Token Address"
              />
            </label>
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div>
          <Button floated="left" color="red" onClick={toggleModalTokenAdd}>
            <Icon name="cancel" />
            Cancel
          </Button>
          <Button floated="right" color="blue" onClick={newTokenSubmit}>
            <Icon name="send" />
            Submit
          </Button>
        </div>
      </Modal.Actions>
    </Modal>
  );
}

TokenAddModal.propTypes = {
  modalTokenAdd: PropTypes.bool.isRequired,
  toggleModalTokenAdd: PropTypes.func.isRequired,
  handleOnTokenAddSubmit: PropTypes.func.isRequired,
};

export default TokenAddModal;
