import React, { Component } from 'react';
import {
  Button, Modal, Form, Icon, Checkbox,
} from 'semantic-ui-react';
import { connect } from 'react-redux';

import {
  DEFAULT_DEPOSIT_FEE, DEFAULT_INSTANT_WITHDRAW_FEE, TOKEN_TYPE, TX_TYPES,
} from '../../../../constants';

class TransactionsModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fee: DEFAULT_DEPOSIT_FEE,
      instantWithdrawFee: DEFAULT_INSTANT_WITHDRAW_FEE,
      instantWithdrawEnable: false,
      directTransactionEnable: false,
    };
  }

  getTokenInfo() {
    const tokenPool = this.props.token.tokenPool;
    const activeTokenRowId = this.props.token.activeTokenRowId;
    if (activeTokenRowId === '') {
      return null;
    }
    return tokenPool.filter((token) => token.id === activeTokenRowId)[0];
  }

  handleOnSubmit = () => {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo) {
      return;
    }
    const fee = this.inputFee.value === '' ? this.state.fee : this.inputFee.value;
    const tokenAmount = tokenInfo.tokenType === TOKEN_TYPE.ERC721 ? '0' :
      this.inputTokenAmount.value === '' ? '0' : this.inputTokenAmount.value;

    switch (this.props.txType) {
      case TX_TYPES.WITHDRAW: {
        const ethereumAddress = this.inputPkdX.value === '' ? this.props.wallet.ethereumAddress : this.inputPkdX.value;
        const txType = this.state.instantWithdrawEnable
          ? TX_TYPES.INSTANT_WITHDRAW
          : TX_TYPES.WITHDRAW;
        const instantWithdrawFee = txType === TX_TYPES.WITHDRAW ? 0 : this.inputInstantWithdrawFee.value === '' ? this.state.instantWithdrawFee : this.inputInstantWithdrawFee.value;
        this.props.handleOnTxSubmit({
          txType,
          ethereumAddress,
          tokenType: tokenInfo.tokenType,
          tokenAddress: tokenInfo.tokenAddress,
          tokenId: tokenInfo.tokenId,
          tokenAmount,
          fee,
          instantWithdrawFee,
        });
      }
        break;

      default:
        const pkd = this.inputPkdX.value === '' || this.inputPkdY.value === '' ? this.props.wallet.zkpKeys.pkd : [this.inputPkdX.value, this.inputPkdY.value];
        this.props.handleOnTxSubmit({
         txType:  this.props.txType,
         pkd,
         tokenType: tokenInfo.tokenType,
         tokenAddress: tokenInfo.tokenAddress,
         tokenId: tokenInfo.tokenId, 
         tokenAmount,
         fee});
    }

    this.toggleAll();
  }

  toggleInstantWithdraw = () => this.setState((prevState) => ({ instantWithdrawEnable: !prevState.instantWithdrawEnable }))
  toggleDirectTransaction = () => this.setState((prevState) => ({ directTransactionEnable: !prevState.directTransactionEnable }))

  toggleAll = () => {
     this.setState({instantWithdrawEnable: false});
     this.setState({directTransactionEnable: false});
     this.props.toggleModalTx();
  }

  render() {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo) {
      return null;
    }
    const keyLabel = this.props.txType === TX_TYPES.WITHDRAW ? 'Ethereum Address' : 'PK-X';
    const pkd = this.props.isWalletInitialized ? this.props.wallet.zkpKeys.pkd : '';

    return (
      <Modal open={this.props.modalTx}>
        <Modal.Header>{this.props.txType.toUpperCase()}</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Group widths='equal'>
            {
              this.props.txType === TX_TYPES.WITHDRAW ?
                <Form.Field>
                  <Checkbox
                    label='Instant Withdraw'
                    onChange={this.toggleInstantWithdraw}
                    checked={this.state.instantWithdrawEnable}
                  />
                </Form.Field> :
                null
            }
            {
              this.state.instantWithdrawEnable ?
                <Form.Field>
                  <label htmlFor="instante-withdrawfee">
                    Instant Withdraw Fee
                    <input type="text" placeholder={this.state.instantWithdrawFee} ref={value => (this.inputInstantWithdrawFee = value)} id="fee" />
                  </label>
                </Form.Field> :
                null
            }
            </Form.Group>
            {
              this.props.txType !== TX_TYPES.DEPOSIT ?
                <Form.Field>
                  <Checkbox
                    label='Direct Transaction'
                    onChange={this.toggleDirectTransaction}
                    checked={this.state.directTransactionEnable}
                  />
                </Form.Field> :
                null
            }
            <Form.Group widths='equal'>
              <Form.Field>
                <label htmlFor="pkd-x">
                  {keyLabel}
                  <input type="text" placeholder={this.props.txType === TX_TYPES.WITHDRAW ? this.props.wallet.ethereumAddress : pkd[0]} ref={value => (this.inputPkdX = value)} id="pkd-x" />
                </label>
              </Form.Field>
              {
                this.props.txType !== TX_TYPES.WITHDRAW ?
                  <Form.Field>
                    <label htmlFor="pk-y">
                      PK-Y
                      <input type="text" placeholder={pkd[1]} ref={value => (this.inputPkdY = value)} id="pk-y" />
                    </label>
                  </Form.Field> :
                  null
              }
            </Form.Group>
            <Form.Group widths='equal' >
              <Form.Field>
                <label> Token Type </label>
                <input type="text" value={tokenInfo.tokenType} id="token-type" readOnly />
              </Form.Field>
              <Form.Field>
                <label> Token </label>
                <input type="text" value={tokenInfo.tokenAddress} id="token-address" readOnly />
              </Form.Field>
            </Form.Group>
            {
              tokenInfo.tokenType !== TOKEN_TYPE.ERC20 ?
                <Form.Group>
                  <Form.Field width={6}>
                    <label htmlFor="token-id">
                      Token Id
                      <input type="text" value={tokenInfo.tokenId} id="token-id" align="right" readOnly />
                    </label>
                  </Form.Field>
                </Form.Group> :
                null
            }
            <Form.Group widths='equal'>
              {
                tokenInfo.tokenType === TOKEN_TYPE.ERC721 ?
                  null :
                  <Form.Field>
                    <label htmlFor="amount">
                      Amount
                      <input type="text" ref={value => (this.inputTokenAmount = value)} id="amount" />
                    </label>
                  </Form.Field>
              }
              <Form.Field>
                <label htmlFor="fee">
                  Fee
                  <input type="text" placeholder={this.state.fee} ref={value => (this.inputFee = value)} id="fee" />
                </label>
              </Form.Field>
            </Form.Group>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <div>
            <Button floated='left' color="red" onClick={this.toggleAll}>
              <Icon name="cancel" />
              Cancel
            </Button>
            <Button floated='right' color="blue" onClick={this.handleOnSubmit}>
              <Icon name="send" />
              Submit
            </Button>
          </div>
        </Modal.Actions>
      </Modal>
    );
  }
}

const mapStateToProps = (state) => ({
  token: state.token,
});

const mapDispatchToProps = (dispatch) => ({
});

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsModal);
