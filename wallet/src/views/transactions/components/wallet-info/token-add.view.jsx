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
  const [tokenId, setTokenId] = React.useState({
    value: '',
    error: null,
  });

  const [tokenBalance, setTokenBalance] = React.useState('');
  const [addTokenIdEnable, setAddTokenIdEnable] = React.useState(false);
  const [tokenAddress, setTokenAddress] = React.useState({
    value: '',
    error: null,
  });
  const [tokenName, setTokenName] = React.useState({
    value: '',
    error: null,
  });

  function resetAll() {
    setTokenType('');
    setTokenAddress({ value: '', error: null });
    setTokenName({ value: '', error: null });
    setAddTokenIdEnable(false);
    toggleModalTokenAdd();
    setTokenId({ value: '', error: null });
  }

  function validateTokenName(value) {
    const errorDuplicate = {
      content: `Duplicated Token name`,
      pointing: 'above',
    };

    const errorDuplicateAddress = {
      content: `Duplicated Token address`,
      pointing: 'above',
    };

    const errorEmpty = {
      content: `Empty Token name`,
      pointing: 'above',
    };
    const errorTokenId = {
      content: `Invalid Token Id`,
      pointing: 'above',
    };
    if (value === '') {
      return setTokenName({ value, error: errorEmpty });
    }
    const tokenFound = token.tokenPool.find(
      el => el.tokenName.toLowerCase() === value.toLowerCase(),
    );
    if (tokenFound) {
      setTokenAddress({ value: tokenFound.tokenAddress, error: null });
      setTokenType(tokenFound.tokenType);
      if (tokenFound.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC1155) {
        setTokenAddress({ value: tokenFound.tokenAddress, error: errorDuplicateAddress });
        return setTokenName({ value, error: errorDuplicate });
      }
      setAddTokenIdEnable(true);
      setTokenId({ value: '', error: errorTokenId });
    } else {
      setAddTokenIdEnable(false);
    }
    return setTokenName({ value, error: null });
  }

  function validateTokenId(value) {
    const error = {
      content: `Invalid Token Id`,
      pointing: 'above',
    };

    const duplicatedError = {
      content: `Duplicated Token Id`,
      pointing: 'above',
    };

    if (!/^-?\d+$/.test(value) && !/^0x([A-Fa-f0-9]+)$/.test(value)) {
      return setTokenId({ value: '', error });
    }

    if (addTokenIdEnable) {
      if (value === '') {
        return setTokenId({ value: '', error });
      }
      const tokenFound = token.tokenPool.find(el => el.tokenName === tokenName.value);
      if (!tokenFound || tokenFound.tokenErc1155Details.filter(el => el.tokenId === value).length) {
        return setTokenId({ value: '', error: duplicatedError });
      }
    }

    return setTokenId({ value, error: null });
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
    const errorTokenId = {
      content: `Invalid Token Id`,
      pointing: 'above',
    };
    if (!/^0x([A-Fa-f0-9]{40})$/.test(value)) {
      setTokenType('');
      setAddTokenIdEnable(false);
      return setTokenAddress({ value, error });
    }
    Nf3.Tokens.getERCInfo(value, nf3.ethereumAddress, nf3.web3, {
      tokenId: 0,
    })
      .then(ercInfo => {
        setTokenAddress({ value, error: null });
        setTokenType(ercInfo.tokenType);
        setTokenBalance(ercInfo.balance);
        if (ercInfo.tokenType === Nf3.Constants.TOKEN_TYPE.ERC1155) {
          setAddTokenIdEnable(true);
        }
        const tokenFound = token.tokenPool.find(
          el => el.tokenAddress.toLowerCase() === value.toLowerCase(),
        );
        if (tokenFound) {
          setTokenName({ value: tokenFound.tokenName, error: null });
          if (ercInfo.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC1155) {
            setTokenAddress({ value, error: errorDuplicate });
            setTokenType('');
            setTokenName({ value: '', error: null });
            setAddTokenIdEnable(false);
          } else {
            setTokenId({ value: '', error: errorTokenId });
          }
        } else {
          setAddTokenIdEnable(false);
        }
      })
      .catch(() => {
        setTokenType('');
        setAddTokenIdEnable(false);
        setTokenName({ value: '', error: null });
        setTokenAddress({ value, error });
      });
    return null;
  }

  const newTokenSubmit = () => {
    let tokenErc1155Details = [];
    if (addTokenIdEnable) {
      const tokenFound = token.tokenPool.find(
        el => el.tokenAddress.toLowerCase() === tokenAddress.value.toLowerCase(),
      );
      tokenErc1155Details = tokenFound.tokenErc1155Details;
      tokenErc1155Details.push({
        tokenId: tokenId.value,
        l1Balance: '0',
        l2Balance: '0',
        pendingDeposit: '0',
        pendingSpent: '0',
      });
    }

    handleOnTokenAddSubmit(
      tokenName.value,
      tokenType,
      tokenAddress.value,
      tokenErc1155Details,
      tokenBalance,
    );
    resetAll();
    return null;
  };

  return (
    <Modal open={modalTokenAdd}>
      <Modal.Header> Add New Token</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleOnTokenAddSubmit}>
          <Form.Group widths="equal">
            <Form.Field
              control={Input}
              label="Token Name"
              value={tokenName.value}
              onChange={event => validateTokenName(event.target.value)}
              id="Token Name"
              error={tokenName.error}
            />
            <Form.Field
              control={Input}
              label="Token Type"
              id="Token Type"
              value={tokenType}
              readOnly
            />
            {addTokenIdEnable ? (
              <Form.Field
                control={Input}
                label="Token Id"
                onChange={event => validateTokenId(event.target.value)}
                id="Token Id"
                error={tokenId.error}
              />
            ) : null}
          </Form.Group>
          <Form.Field
            control={Input}
            label="ERC Token Address"
            value={tokenAddress.value}
            onChange={event => validateTokenAddress(event.target.value)}
            id="Token Address"
            error={tokenAddress.error}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div>
          <Button floated="left" color="red" onClick={resetAll}>
            <Icon name="cancel" />
            Cancel
          </Button>
          <Button
            floated="right"
            color="blue"
            disabled={
              tokenAddress.error !== null ||
              tokenAddress.value === '' ||
              tokenName.error !== null ||
              tokenId.error !== null
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
