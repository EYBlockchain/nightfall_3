import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';

import HeaderMenu from './components/header-menu/header-menu.view';
import FooterMenu from './components/footer-menu/footer-menu.view';
import TransactionsMenu from './components/transactions-menu/transactions-menu.view';
import WalletInfo from './components/wallet-info/wallet-info.view';
import TransactionsModal from './components/transactions/transactions-modal.view';
import { TX_TYPES } from '../../constants';
import { toBaseUnit } from '../../utils/lib/utils';


class Transactions extends Component {

  constructor(props) {
    super(props);
    this.state = {
      modalTx: false,
      txType: '',
    };

  }

  handleItemClick = (e, { name }) => {
    e.preventDefault();
    this.setState({ txType: name });
    this.setState({ modalTx: true });
  }

  toggleModalTx = () => { this.setState((prev) => ({ modalTx: !prev.modalTx })); }

  handleClickGetTokens = () => {
    this.props.handleGetTokens(this.props.config.nodeEth, this.props.config.tokensAddress,
      this.props.wallet, this.props.password);
    this.getInfoAccount();
  }

  handleClickApprove = async (addressTokens, amountToken) => {
    const res = await this.props.handleApprove(addressTokens, this.props.abiTokens, this.props.wallet,
      amountToken, this.props.config.address, this.props.password, this.props.config.nodeEth, this.props.gasMultiplier);
  }

  renderRedirect = () => {
    if (this.props.login.isValidPrivateKey) {
      return <Redirect to="/transactions" />;
    } else {
      return <Redirect to="/login" />;
    }
  }

  handleOnTxSubmit = (txType, pkd, tokenType, tokenAddress, tokenId, tokenAmount, fee) => {
    const tokenAmountBN = toBaseUnit(tokenAmount).toString();
    switch (txType) {
      case TX_TYPES.DEPOSIT:
          // TODO: dispatch error
          this.props.login.nf3.deposit(tokenAddress, tokenType, tokenAmountBN, tokenId, fee)
          .then(console.log)
          .catch(console.log)
        break

      case TX_TYPES.TRANSFER:
          // TODO: dispatch error
          this.props.login.nf3.transfer(tokenAddress, tokenType, tokenAmountBN, tokenId, pkd, fee)
          .then(console.log)
          .catch(console.log)
        break

      case TX_TYPES.WITHDRAW:
          // TODO: dispatch error
          this.props.login.nf3.withdraw(tokenAddress, tokenType, tokenAmountBN, tokenId, pkd, fee)
          .then(console.log)
          .catch(console.log);
        break;

      default:
        throw ("Unknown transaction")
    }

  }

  render() {
    return (
      <Container textAlign="center">
        <HeaderMenu />
        <Header
          as="h1"
          style={{
            fontSize: '4em',
            fontWeight: 'normal',
            marginBottom: 0,
            marginTop: '1em',
          }}>
          Nightfall Client
        </Header>
        <Divider />
        <TransactionsMenu
          handleItemClick={this.handleItemClick} />
        <WalletInfo
          wallet={this.props.login.wallet}
          nf3={this.props.login.nf3} />
        <TransactionsModal
          modalTx={this.state.modalTx && this.props.token.activeTokenRowId}
          txType={this.state.txType}
          wallet={this.props.login.wallet}
          toggleModalTx={this.toggleModalTx}
          handleOnTxSubmit={this.handleOnTxSubmit}
        />
        <FooterMenu />
        {this.renderRedirect()}
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  login: state.login,
  token: state.token,
});

const mapDispatchToProps = () => ({
});

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
