import React from 'react';
import { Button, Modal, Form, Icon, Header, Card, Grid, Message, Input } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as Nf3 from 'nf3';
import {
  txWithdrawUpdate,
  txInstantWithdrawSubmit,
} from '../../../../store/transactions/transactions.thunks';
import CountDownTimer from './countdowntimer.view.jsx';
import { DEFAULT_INSTANT_WITHDRAW_FEE } from '../../../../constants';

function AccountInfoModal({
  transactions,
  login,
  accountInfoEnable,
  toggleAccountInfo,
  onUpdateWithdraws,
  onInstantWithdraw,
}) {
  const [instantWithdrawFee, setInstantWithdrawFee] = React.useState(DEFAULT_INSTANT_WITHDRAW_FEE);

  const onClose = async () => {
    toggleAccountInfo();
    setInstantWithdrawFee(DEFAULT_INSTANT_WITHDRAW_FEE);
  };

  React.useEffect(() => {
    if (accountInfoEnable) {
      const updateWithdraw = setInterval(() => {
        onUpdateWithdraws();
      }, 3000);
      return () => clearInterval(updateWithdraw);
    }
    return null;
  });

  const onClaim = transactionHash => {
    login.nf3
      .finaliseWithdrawal(transactionHash)
      .then(info => console.log('OK', info))
      .catch(err => console.log('ERR', err));
  };
  const onInstantWithdrawClaim = transactionHash => {
    onInstantWithdraw(transactionHash, instantWithdrawFee);
  };

  const renderWithdraws = () => {
    const withdrawalRow = [];
    for (const pendingWithdraw of transactions.withdrawInfo) {
      const tokenIdLen = pendingWithdraw.tokenId.length;
      const tokenIdStr =
        tokenIdLen > 20
          ? `${pendingWithdraw.tokenId.substring(0, 10)}...${pendingWithdraw.tokenId.substring(
              tokenIdLen - 10,
              tokenIdLen,
            )}`
          : pendingWithdraw.tokenId;
      const pendingClaimWithdraw =
        Number(pendingWithdraw.withdrawalInfo.timestamp) - Math.floor(new Date().getTime() / 1000);
      const tokenIdId = `card id${pendingWithdraw.ercAddress}`;
      const tokenIdValue = `Token Id: ${tokenIdStr}`;
      const tokenNameId = `card name${pendingWithdraw.ercAddress}`;
      const tokenNameValue = `Token Name: ${pendingWithdraw.tokenName}`;
      const tokenAddressId = `card address${pendingWithdraw.ercAddress}`;
      const tokenAddressValue = `Token Address: ${pendingWithdraw.ercAddress}`;
      const tokenTypeId = `card type${pendingWithdraw.ercAddress}`;
      const tokenAmountId = `card amount${pendingWithdraw.ercAddress}`;
      const tokenAmountValue = `Requested Withdrawal Amount: ${pendingWithdraw.balanceEth}`;
      const tokenButtonWithdrawId = `button withdraw${pendingWithdraw.ercAddress}`;
      const tokenButtonInstantWithdrawId = `button instant${pendingWithdraw.ercAddress}`;
      if (pendingWithdraw.withdrawalInfo.valid) {
        withdrawalRow.push(
          <Card fluid raised>
            <Card.Content>
              <Grid column={12}>
                <Grid.Column width="4">
                  {pendingWithdraw.tokenName !== '' ? (
                    <Card.Description id={tokenNameId} content={tokenNameValue} />
                  ) : (
                    <Card.Description id={tokenAddressId} content={tokenAddressValue} />
                  )}
                </Grid.Column>
                <Grid.Column width="6" />
                <Grid.Column width="2">
                  <Card.Description id={tokenTypeId} content={pendingWithdraw.tokenType} />
                </Grid.Column>
              </Grid>
            </Card.Content>
            <Grid column={15}>
              <Grid.Column width="1" />
              <Grid.Column width="7">
                {pendingWithdraw.tokenType === Nf3.Constants.TOKEN_TYPE.ERC20 ? null : (
                  <Card.Content extra id={tokenIdId} content={tokenIdValue} />
                )}
              </Grid.Column>
              <Grid.Column width="5">
                {pendingWithdraw.tokenType === Nf3.Constants.TOKEN_TYPE.ERC721 ? null : (
                  <Card.Content extra id={tokenAmountId} content={tokenAmountValue} />
                )}
              </Grid.Column>
            </Grid>
            <Card.Content extra>
              <Button.Group widths="2">
                <Button
                  floated="left"
                  transactionHash={pendingWithdraw.transactionHash}
                  id={tokenButtonWithdrawId}
                  disabled={
                    pendingClaimWithdraw > 0 || pendingWithdraw.withdrawalInfo.valid === false
                  }
                  onClick={(e, { transactionHash }) => onClaim(transactionHash)}
                >
                  Claim Withdraw: {<CountDownTimer timestamp={pendingClaimWithdraw} />}
                </Button>
                {pendingWithdraw.tokenType === Nf3.Constants.TOKEN_TYPE.ERC20 ? (
                  <Button
                    floated="right"
                    transactionHash={pendingWithdraw.transactionHash}
                    id={tokenButtonInstantWithdrawId}
                    disabled={pendingWithdraw.withdrawalInfo.valid === false}
                    onClick={(e, { transactionHash }) => onInstantWithdrawClaim(transactionHash)}
                  >
                    Instant Withdraw
                  </Button>
                ) : null}
              </Button.Group>
            </Card.Content>
          </Card>,
        );
      }
    }
    return withdrawalRow;
  };

  let withdrawRows = [];
  if (accountInfoEnable) {
    withdrawRows = renderWithdraws();
  }

  return (
    <Modal open={accountInfoEnable}>
      <Modal.Header>Withdrawal Information</Modal.Header>
      <Modal.Content>
        <Form>
          <Header as="h4" textAlign="right">
            Pending Withdrawals
          </Header>
          <Form.Field>
            <Input
              type="number"
              min="0"
              placeholder={instantWithdrawFee}
              id="instant withdraw fee"
              onChange={event => setInstantWithdrawFee(event.target.value)}
              label="Instant Withdraw Fee"
            />
          </Form.Field>
          <Form.Field>
            {withdrawRows.length === 0 ? (
              <Message info>
                <Message.Header>No pending withdrawals</Message.Header>
              </Message>
            ) : (
              withdrawRows
            )}
          </Form.Field>
          <Modal.Actions>
            <Button floated="right" primary onClick={onClose}>
              <Icon name="close" />
              Close
            </Button>
          </Modal.Actions>
        </Form>
      </Modal.Content>
    </Modal>
  );
}

AccountInfoModal.propTypes = {
  transactions: PropTypes.object.isRequired,
  login: PropTypes.object.isRequired,
  accountInfoEnable: PropTypes.bool.isRequired,
  toggleAccountInfo: PropTypes.func.isRequired,
  onUpdateWithdraws: PropTypes.func.isRequired,
  onInstantWithdraw: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  transactions: state.transactions,
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onUpdateWithdraws: () => dispatch(txWithdrawUpdate()),
  onInstantWithdraw: (transactionHash, fee) =>
    dispatch(txInstantWithdrawSubmit(transactionHash, fee)),
});

export default connect(mapStateToProps, mapDispatchToProps)(AccountInfoModal);
