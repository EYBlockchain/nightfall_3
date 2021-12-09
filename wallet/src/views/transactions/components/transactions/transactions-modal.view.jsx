import React from 'react';
import { Button, Modal, Form, Icon, Checkbox, Dropdown, Input } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as Nf3 from 'nf3';
import * as txThunks from '../../../../store/transactions/transactions.thunks';
import * as txActionTypes from '../../../../store/transactions/transactions.actions';
import * as Storage from '../../../../utils/lib/local-storage';

import { DEFAULT_DEPOSIT_FEE, DEFAULT_INSTANT_WITHDRAW_FEE } from '../../../../constants';

function TransactionsModal({ token, login, transactions, onSubmitTx, onCancelTx }) {
  const [fee, setFee] = React.useState(DEFAULT_DEPOSIT_FEE);
  const [tokenAmount, setTokenAmount] = React.useState(0);
  const [instantWithdrawFee, setInstantWithdrawFee] = React.useState(DEFAULT_INSTANT_WITHDRAW_FEE);
  const [instantWithdrawEnable, setInstantWithdrawEnable] = React.useState(false);
  const [directTransactionEnable, setDirectTransactionEnable] = React.useState(false);
  const [tokenId, setTokenId] = React.useState({
    value: 0,
    error: null,
  });
  const [destinationAddress, setDestinationAddress] = React.useState({
    value: '',
    error: null,
  });

  const toggleAll = () => {
    setInstantWithdrawEnable(false);
    setDirectTransactionEnable(false);
    setDestinationAddress({ value: '', error: null });
    setTokenId({ value: 0, error: null });
    onCancelTx();
  };

  function getTokenInfo() {
    try {
      const tokenPool = Storage.tokensGet(login.nf3.zkpKeys.compressedPkd);
      if (tokenPool === null) {
        return null;
      }
      return tokenPool.filter(tokenEl => tokenEl.tokenAddress === token.activeTokenRowId)[0];
    } catch {
      return null;
    }
  }

  function validateContractAddress(key, value) {
    const error = {
      content: `Please enter a valid ${key}`,
      pointing: 'above',
    };
    if (key === 'Compressed Pkd') {
      if (!/^0x([A-Fa-f0-9]{63,64})$/.test(value))
        return setDestinationAddress({ value: '', error });
      setDestinationAddress({ value, error: null });
    }
    if (transactions.txType === 'withdraw') {
      if (!/^0x([A-Fa-f0-9]{40})$/.test(value)) return setDestinationAddress({ value: '', error });
      setDestinationAddress({ value, error: null });
    }
    return null;
  }

  function validateTokenId(tokenInfo) {
    const error = {
      content: 'Please, enter a valid tokenId',
      pointing: 'above',
    };
    if (tokenInfo.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC20 && tokenId.value === 0) {
      setTokenId({ value: 0, error });
      return false;
    }
    return true;
  }

  const handleOnSubmit = () => {
    const tokenInfo = getTokenInfo();
    if (!tokenInfo) {
      return;
    }
    if (!validateTokenId(tokenInfo)) {
      return;
    }
    switch (transactions.txType) {
      // TODO : pending select correct tokenId index. For now, i select 0, but it could be different
      case Nf3.Constants.TX_TYPES.WITHDRAW:
        {
          const ethereumAddress =
            destinationAddress.value === '' ? login.nf3.ethereumAddress : destinationAddress.value;
          const withdrawType = instantWithdrawEnable
            ? Nf3.Constants.TX_TYPES.INSTANT_WITHDRAW
            : Nf3.Constants.TX_TYPES.WITHDRAW;
          onSubmitTx({
            txType: withdrawType,
            ethereumAddress,
            tokenType: tokenInfo.tokenType,
            tokenAddress: tokenInfo.tokenAddress,
            tokenId: tokenId.value,
            tokenAmount:
              tokenInfo.tokenType === Nf3.Constants.TOKEN_TYPE.ERC721 ? '0' : tokenAmount,
            fee,
            instantWithdrawFee,
          });
        }
        break;

      default: {
        const compressedPkd =
          destinationAddress.value === ''
            ? login.nf3.zkpKeys.compressedPkd
            : destinationAddress.value;
        const { txType } = transactions;
        onSubmitTx({
          txType,
          compressedPkd,
          tokenType: tokenInfo.tokenType,
          tokenAddress: tokenInfo.tokenAddress,
          tokenId: tokenId.value,
          tokenAmount: tokenInfo.tokenType === Nf3.Constants.TOKEN_TYPE.ERC721 ? '0' : tokenAmount,
          fee,
        });
      }
    }

    setInstantWithdrawEnable(false);
    setDirectTransactionEnable(false);
    setTokenId({ value: 0, error: null });
  };

  const tokenInfo = getTokenInfo();
  if (!tokenInfo) {
    return null;
  }
  const keyLabel =
    transactions.txType === Nf3.Constants.TX_TYPES.WITHDRAW ? 'Ethereum Address' : 'Compressed Pkd';
  if (transactions.txType === '') return null;
  const tokenIdPool =
    transactions.txType === Nf3.Constants.TX_TYPES.DEPOSIT
      ? tokenInfo.tokenId
      : tokenInfo.l2TokenId;
  return (
    <Modal open={transactions.modalTx}>
      <Modal.Header>{transactions.txType.toUpperCase()}</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Group widths="equal">
            {transactions.txType === Nf3.Constants.TX_TYPES.WITHDRAW &&
            tokenInfo.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC721 ? (
              <Form.Field>
                <Checkbox
                  label="Instant Withdraw"
                  onChange={() => setInstantWithdrawEnable(!instantWithdrawEnable)}
                  checked={instantWithdrawEnable}
                />
              </Form.Field>
            ) : null}
            {instantWithdrawEnable ? (
              <Form.Field>
                <label htmlFor="instante-withdrawfee">
                  Instant Withdraw Fee
                  <input
                    type="text"
                    placeholder={instantWithdrawFee}
                    onChange={event => setInstantWithdrawFee(event.target.value)}
                  />
                </label>
              </Form.Field>
            ) : null}
          </Form.Group>
          {transactions.txType !== Nf3.Constants.TX_TYPES.DEPOSIT ? (
            <Form.Field>
              <Checkbox
                label="Direct Transaction"
                onChange={() => setDirectTransactionEnable(!directTransactionEnable)}
                checked={directTransactionEnable}
              />
            </Form.Field>
          ) : null}
          {transactions.txType !== Nf3.Constants.TX_TYPES.DEPOSIT ? (
            <Form.Group widths="equal">
              <Form.Field
                control={Input}
                label={keyLabel}
                placeholder={
                  transactions.txType === Nf3.Constants.TX_TYPES.WITHDRAW
                    ? login.nf3.ethereumAddress
                    : login.nf3.zkpKeys.compressedPkd
                }
                onChange={event => validateContractAddress(keyLabel, event.target.value)}
                error={destinationAddress.error}
              />
            </Form.Group>
          ) : null}
          <Form.Group widths="equal">
            <Form.Field>
              <label> Token Type </label>
              <input type="text" value={tokenInfo.tokenType} id="token-type" readOnly />
            </Form.Field>
            <Form.Field>
              <label> Token </label>
              <input type="text" value={tokenInfo.tokenAddress} id="token-address" readOnly />
            </Form.Field>
          </Form.Group>
          {tokenInfo.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC20 ? (
            <Form.Group>
              <Form.Field width={6}>
                <label> Token Id </label>
                <Dropdown
                  control={Input}
                  selection
                  options={
                    tokenIdPool.length
                      ? tokenIdPool.map(function (id) {
                          return { key: id, text: id, value: id };
                        })
                      : []
                  }
                  onChange={(e, { value }) => setTokenId({ value, error: null })}
                  error={tokenId.error !== null}
                />
              </Form.Field>
            </Form.Group>
          ) : null}
          <Form.Group widths="equal">
            {tokenInfo.tokenType === Nf3.Constants.TOKEN_TYPE.ERC721 ? null : (
              <Form.Field>
                <label htmlFor="amount">
                  Amount (Ether)
                  <input
                    type="number"
                    min="0"
                    id="amount"
                    onChange={event => setTokenAmount(event.target.value)}
                  />
                </label>
              </Form.Field>
            )}
            <Form.Field>
              <label htmlFor="fee">
                Fee (Wei)
                <input
                  type="number"
                  min="0"
                  placeholder={fee}
                  onChange={event => setFee(event.target.value)}
                  id="fee"
                />
              </label>
            </Form.Field>
          </Form.Group>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div>
          <Button
            floated="left"
            disabled={transactions.txType === ''}
            color="red"
            onClick={toggleAll}
          >
            <Icon name="cancel" />
            Cancel
          </Button>
          <Button
            floated="right"
            disabled={transactions.txType === ''}
            primary
            onClick={handleOnSubmit}
          >
            <Icon name="send" />
            Submit
          </Button>
        </div>
      </Modal.Actions>
    </Modal>
  );
}

TransactionsModal.propTypes = {
  token: PropTypes.object.isRequired,
  login: PropTypes.object.isRequired,
  transactions: PropTypes.object.isRequired,
  onSubmitTx: PropTypes.func.isRequired,
  onCancelTx: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  token: state.token,
  login: state.login,
  transactions: state.transactions,
});

const mapDispatchToProps = dispatch => ({
  onSubmitTx: txParams => dispatch(txThunks.txSubmit(txParams)),
  onCancelTx: () => dispatch(txActionTypes.txCancel()),
});

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsModal);
