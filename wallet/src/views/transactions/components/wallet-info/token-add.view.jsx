import React from 'react';
import { connect } from 'react-redux';
import { Modal, Form, Button, Icon, Input } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import * as Nf3 from 'nf3';

// TODO - add props correctly
export function TokenAddModal({
  modalTokenAdd,
  toggleModalTokenAdd,
  handleOnTokenAddSubmit,
  nf3,
  token,
}) {
  const [tokenType, setTokenType] = React.useState('');
  const [tokenBalance, setTokenBalance] = React.useState('');
  const [tokenAddress, setTokenAddress] = React.useState({
    value: '',
    error: null,
  });
  const [tokenName, setTokenName] = React.useState({
    value: '',
    error: null,
  });

  const newTokenSubmit = () => {
    setTokenType('');
    setTokenAddress({ value: '', error: null });
    toggleModalTokenAdd();
    handleOnTokenAddSubmit(tokenName.value, tokenType, tokenAddress.value, tokenBalance);
  };

  const cancelTokenSubmit = () => {
    setTokenType('');
    setTokenAddress({ value: '', error: null });
    setTokenName({ value: '', error: null });
    toggleModalTokenAdd();
  };

  function validateTokenName(value) {
    const errorDuplicate = {
      content: `Duplicated Token name`,
      pointing: 'above',
    };
    const tokenFound = token.tokenPool.find(
      el => el.tokenName.toLowerCase() === value.toLowerCase(),
    );
    if (tokenFound && value !== '') {
      return setTokenName({ value: '', error: errorDuplicate });
    }
    return setTokenName({ value, error: null });
  }

  function validateTokenAddress(value) {
    const error = {
      content: `Please enter a valid ERC Address`,
      pointing: 'above',
    };
    const errorDuplicate = {
      content: `Duplicated ERC Address`,
      pointing: 'above',
    };
    if (!/^0x([A-Fa-f0-9]{40})$/.test(value)) {
      return setTokenAddress({ value: '', error });
    }
    const tokenFound = token.tokenPool.find(
      el => el.tokenAddress.toLowerCase() === value.toLowerCase(),
    );
    if (tokenFound) {
      return setTokenAddress({ value: '', error: errorDuplicate });
    }
    Nf3.Tokens.getERCInfo(value, nf3.ethereumAddress, nf3.web3, {
      tokenId: 0,
    })
      .then(ercInfo => {
        setTokenAddress({ value, error: null });
        setTokenType(ercInfo.tokenType);
        setTokenBalance(ercInfo.balance);
      })
      .catch(() => setTokenAddress({ value: '', error }));
    return null;
  }

  return (
    <Modal open={modalTokenAdd}>
      <Modal.Header> Add New Token</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleOnTokenAddSubmit}>
          <Form.Group widths="equal">
            <Form.Field
              control={Input}
              label="Token Name"
              onChange={event => validateTokenName(event.target.value)}
              id="Token Name"
              error={tokenName.error}
            />
            <Form.Field>
              <label htmlFor="token-type">
                Token Type
                <input type="text" value={tokenType} id="token-type" readOnly />
              </label>
            </Form.Field>
          </Form.Group>
          <Form.Field
            control={Input}
            label="ERC Token Address"
            onChange={event => validateTokenAddress(event.target.value)}
            id="Token Address"
            error={tokenAddress.error}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div>
          <Button floated="left" color="red" onClick={cancelTokenSubmit}>
            <Icon name="cancel" />
            Cancel
          </Button>
          <Button
            floated="right"
            color="blue"
            disabled={
              tokenAddress.error !== null || tokenAddress.value === '' || tokenName.error !== null
            }
            onClick={newTokenSubmit}
          >
            <Icon name="send" />
            Submit
          </Button>
        </div>
      </Modal.Actions>
    </Modal>
  );
}

TokenAddModal.propTypes = {
  nf3: PropTypes.object.isRequired,
  token: PropTypes.object.isRequired,
  modalTokenAdd: PropTypes.bool.isRequired,
  toggleModalTokenAdd: PropTypes.func.isRequired,
  handleOnTokenAddSubmit: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(TokenAddModal);
