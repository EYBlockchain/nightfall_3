import React, { Component } from 'react';
import {
  Button, Modal, Form, Icon, Checkbox,
} from 'semantic-ui-react';
import { connect } from 'react-redux';

import {
  DEFAULT_DEPOSIT_FEE, TOKEN_TYPE, TX_TYPES,
} from '../../../../constants';

class TransactionsModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fee: DEFAULT_DEPOSIT_FEE,
      pkd: this.props.wallet.zkpKeys.pkd,
      instantWithdrawEnable: false,
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
      case TX_TYPES.WITHDRAW:
        const ethereumAddress = this.inputPkdX.value === '' ? this.props.wallet.ethereumAddress : this.inputPkdX.value;
        const txType = this.state.instantWithdrawEnable
          ? TX_TYPES.INSTANT_WITHDRAW
          : TX_TYPES.WITHDRAW;
        this.props.handleOnTxSubmit(txType, ethereumAddress, tokenInfo.tokenType, tokenInfo.tokenAddress, tokenInfo.tokenId, tokenAmount, fee);
        break;

      default:
        const pkd = this.inputPkdX.value === '' || this.inputPkdY.value === '' ? this.props.wallet.zkpKeys.pkd : [this.inputPkdX.value, this.inputPkdY.value];
        this.props.handleOnTxSubmit(this.props.txType, pkd, tokenInfo.tokenType, tokenInfo.tokenAddress, tokenInfo.tokenId, tokenAmount, fee);
    }

    this.props.toggleModalTx();
  }

  toggleInstantWithdraw = () => this.setState((prevState) => ({ instantWithdrawEnable: !prevState.instantWithdrawEnable }))

  render() {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo) {
      return null;
    }
    const keyLabel = this.props.txType === TX_TYPES.WITHDRAW ? 'Ethereum Address' : 'PK-X';

    return (
      <Modal open={this.props.modalTx}>
        <Modal.Header>{this.props.txType.toUpperCase()}</Modal.Header>
        <Modal.Content>
          <Form onSubmit={this.handleSubmit}>
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
            <Form.Group widths='equal'>
              <Form.Field>
                <label htmlFor="pkd-x">
                  {keyLabel}
                  <input type="text" placeholder={this.props.txType === TX_TYPES.WITHDRAW ? this.props.wallet.ethereumAddress : this.state.pkd[0]} ref={value => (this.inputPkdX = value)} id="pkd-x" />
                </label>
              </Form.Field>
              {
                this.props.txType !== TX_TYPES.WITHDRAW ?
                  <Form.Field>
                    <label htmlFor="pk-y">
                      PK-Y
                      <input type="text" placeholder={this.state.pkd[1]} ref={value => (this.inputPkdY = value)} id="pk-y" />
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
          <Button color="blue" onClick={this.handleOnSubmit}>
            <Icon />
            Submit
          </Button>
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
