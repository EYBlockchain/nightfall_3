import React from 'react';
import { Container, Header, Divider } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import PropTypes from 'prop-types';
import jsSha3 from 'js-sha3';
import * as Nf3 from 'nf3';
import * as Storage from '../../utils/lib/local-storage';
import tokens from '../../utils/tokens';

import CreateWalletModal from './components/create-wallet.view.jsx';
import { loadWallet, deleteWallet } from '../../store/login/login.actions';
import { ReactComponent as MetaMaskLogo } from '../../images/metamask.svg';
import { ReactComponent as PolygonLogo } from '../../images/polygon.svg';
import { DEFAULT_NF_ADDRESS_INDEX, METAMASK_MESSAGE } from '../../constants.js';
import tokensLoad from '../../store/token/token.thunks';

let nf3;

function Login({ login, onLoadWallet, onDeleteWallet, onLoadTokens }) {
  const [modalEnable, setModalEnable] = React.useState(false);

  const renderRedirect = () => {
    if (login.isWalletInitialized) {
      return <Redirect to="/transactions" />;
    }
    return <Redirect to="/login" />;
  };

  const chainIdCheck = async chainId => {
    try {
      // netId === configured netId
      const netId = await nf3.getNetworkId();
      // TODO display error message
      if (netId !== chainId) {
        throw new Error('Unexpected NET');
      }
    } catch (err) {
      // TODO display error message
      throw new Error('No Connection');
    }
  };

  const initNf3 = async ethereumSigningKey => {
    const nf3Env = Nf3.Environment.getCurrentEnvironment().currentEnvironment;
    nf3 = new Nf3.Nf3(nf3Env.web3WsUrl, ethereumSigningKey, nf3Env);
    // Start NF3
    try {
      await nf3.init();
      Nf3.Environment.setContractAddresses(nf3);
      // Run checks if Metamask selected
      if (ethereumSigningKey === '') {
        await chainIdCheck(nf3Env.chainId);
      }
    } catch (err) {
      // TODO display error message
      throw new Error('No Connection');
    }
  };

  const mnemonicPassphraseGet = async () => {
    let hashedSignature = null;
    try {
      const signature = await nf3.signMessage(METAMASK_MESSAGE, nf3.ethereumAddress);
      hashedSignature = jsSha3.keccak256(signature);
    } catch (err) {
      // TODO display error message
      throw new Error('Signature aborted');
    }
    return hashedSignature;
  };

  /**
   * Imports a nightfall wallet based on an Ethereum Private Key
   * @param {string} privateKey - Ethereum Private Key
   */
  const handleClickOnImport = async (mnemonic, requestBackup) => {
    try {
      if (requestBackup) {
        const passphrase = await mnemonicPassphraseGet(nf3);
        Storage.mnemonicSet(nf3.ethereumAddress, mnemonic, passphrase);
      }
      await nf3.setzkpKeysFromMnemonic(mnemonic, DEFAULT_NF_ADDRESS_INDEX);
      onLoadWallet(nf3);
      console.log("TTT", tokens)
      onLoadTokens(tokens);
    } catch (err) {
      console.log('Failed', err);
      setModalEnable(false);
      onDeleteWallet();
    }
  };

  const toggleModalEnable = async () => {
    setModalEnable(!modalEnable);
  };

  const createWallet = async () => {
    try {
      await initNf3('');
      if (!Storage.mnemonicGet(nf3.ethereumAddress)) {
        setModalEnable(!modalEnable);
      } else {
        const passphrase = await mnemonicPassphraseGet(nf3);
        const mnemonic = Storage.mnemonicGet(nf3.ethereumAddress, passphrase);
        handleClickOnImport(mnemonic, false);
      }
    } catch (err) {
      // TODO
      console.log('ERROR', err);
    }
  };

  return (
    <Container textAlign="center">
      <Header
        as="h1"
        style={{
          fontSize: '4em',
          fontWeight: 'normal',
          marginBottom: 0,
          marginTop: '3em',
        }}
      >
        <PolygonLogo width="250px" height="250px" />
        Nightfall Wallet
      </Header>
      <Divider />
      <h1> Connect with: </h1>
      <div onClick={createWallet}>
        <a href="#">
          <MetaMaskLogo width="60px" height="60px" />
        </a>
      </div>
      <Divider />
      <CreateWalletModal
        modalEnable={modalEnable}
        handleClickOnImport={handleClickOnImport}
        toggleModalEnable={toggleModalEnable}
      />
      {renderRedirect()}
    </Container>
  );
}

Login.propTypes = {
  login: PropTypes.object.isRequired,
  onLoadWallet: PropTypes.func.isRequired,
  onDeleteWallet: PropTypes.func.isRequired,
  onLoadTokens: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onLoadWallet: nf3Instance => dispatch(loadWallet(nf3Instance)),
  onDeleteWallet: () => dispatch(deleteWallet()),
  onLoadTokens: newTokens => dispatch(tokensLoad(newTokens)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Login);
