import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';

import HeaderMenu from './components/header-menu/header-menu.view';
import FooterMenu from './components/footer-menu/footer-menu.view';
import TransactionsMenu from './components/transactions-menu/transactions-menu.view';
import WalletInfo from './components/wallet-info/wallet-info.view';
import TransactionsModal from './components/transactions/transactions-modal.view';
import * as txActions from '../../store/transactions/transactions.actions';
import * as txThunks from '../../store/transactions/transactions.thunks';


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

  renderRedirect = () => {
    if (this.props.login.isWalletInitialized) {
      return <Redirect to="/transactions" />;
    } else {
      return <Redirect to="/login" />;
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
          isWalletInitialized={this.props.login.isWalletInitialized}
          toggleModalTx={this.toggleModalTx}
          handleOnTxSubmit={this.props.onSubmitTx}
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
  transactions: state.transactions,
});

const mapDispatchToProps = (dispatch) => ({
  onFailedTx: () => dispatch(txActions.txFailed()),
  onSuccessTx: (txReceipt) => dispatch(txActions.txSuccess(txReceipt)),
  onSubmitTx: (txParams) => dispatch(txThunks.txSubmit(txParams)),
  onSubmitInstantWithdrawTx: (withdrawTransactionHash, fee) => dispatch(txThunks.txInstantWithdrawSubmit(withdrawTransactionHash, fee)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
