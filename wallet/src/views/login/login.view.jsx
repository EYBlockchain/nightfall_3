import React, { Component } from 'react';
import { Container, Header, Divider, Button, } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import Nf3 from 'nf3';

import CreateWalletModal from './components/create-wallet.view';
import { loadWallet, deleteWallet } from '../../store/login/login.actions';
import { createWalletFromEtherAccount } from '../../utils/lib/nightfall-wallet';
import { getCurrentEnvironment } from '../../utils/lib/environment';

const mapStateToProps = (state) => ({
  login: state.login,
});

const mapDispatchToProps = (dispatch) => ({
  loadWallet: (wallet, nf3) => dispatch(loadWallet(wallet, nf3)),
  deleteWallet: () => dispatch(deleteWallet())
})

class Login extends Component {

  constructor(props) {
    super(props);
    this.state = {
      modalPrivateKey: false,
    };

    this.handleClickOnImport = this.handleClickOnImport.bind(this);

  }

  /**
   * Imports a nightfall wallet based on an Ethereum Private Key
   * @param {sring} privateKey - Ethereum Private Key
   */
  async handleClickOnImport(privateKey) {
    // Check inputPrivateKey is correct
    let wallet;
    try {
      const nf3Env = getCurrentEnvironment().currentEnvironment;
      const nf3 = new Nf3(
        nf3Env.clientApiUrl,
        nf3Env.optimistApiUrl,
        nf3Env.optimistWsUrl,
        nf3Env.web3WsUrl,
        privateKey
      );
      await nf3.init();
      wallet = createWalletFromEtherAccount(privateKey, nf3.zkpKeys);

      // Set Wallet and Nf3 object
      this.props.loadWallet(wallet, nf3);

    } catch (error) {
      this.props.deleteWallet();
    }

  }

  toggleModalPrivateKey = () => {
    this.setState((prev) => ({
      modalPrivateKey: !prev.modalPrivateKey
    }));
  }


  renderRedirect = () => {
    if (this.props.login.isValidPrivateKey) {
      return <Redirect to="/transactions" />;
    } else {
      return <Redirect to="/login" />;
    }
  }

  render() {
    return (
      <Container textAlign="center">
        <Header
          as="h1"
          style={{
            fontSize: '4em',
            fontWeight: 'normal',
            marginBottom: 0,
            marginTop: '3em',
          }}>
          Nightfall Client
        </Header>
        <Divider />
        <Button.Group vertical>
          <Button
            content="Create Wallet"
            icon="plus"
            size="massive"
            color="blue"
            onClick={this.toggleModalPrivateKey} />
          <Divider />
        </Button.Group>
        <CreateWalletModal
          modalPrivateKey={this.state.modalPrivateKey}
          toggleModalPrivateKey={this.toggleModalPrivateKey}
          handleClickOnImport={this.handleClickOnImport}
          wallet={this.props.login.wallet} />
        {this.renderRedirect()}
      </Container>
    );
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(Login);

