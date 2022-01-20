import React from 'react';
import { Container, Header, Divider, Message } from 'semantic-ui-react';
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
import {
  DEFAULT_NF_ADDRESS_INDEX,
  METAMASK_MESSAGE,
  ERROR_AUTO_HIDE_PERIOD,
} from '../../constants.js';
import tokensLoad from '../../store/token/token.thunks';
import * as messageActions from '../../store/message/message.actions';

let nf3;

function Login({
  login,
  message,
  onLoadWallet,
  onDeleteWallet,
  onLoadTokens,
  onNewError,
  onClearMsg,
}) {
  const [modalEnable, setModalEnable] = React.useState(false);

  const renderRedirect = () => {
    if (login.isWalletInitialized) {
      return <Redirect to="/wallet" />;
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
      // Run checks if Metamask selected
      if (ethereumSigningKey === '') {
        await chainIdCheck(nf3Env.chainId);
      }
    } catch (err) {
      // TODO display error message
      throw new Error(`Cannot access Network. Expecting to connect to ${nf3Env.web3WsUrl}`);
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

  const preloadTokens = async () => {
    const erc20Address = await nf3.getContractAddress('ERC20Mock');
    const erc721Address = await nf3.getContractAddress('ERC721Mock');
    const erc1155Address = await nf3.getContractAddress('ERC1155Mock');
    const tokenPreload = tokens.map(el => {
      const obj = { ...el };
      if (el.tokenType === Nf3.Constants.TOKEN_TYPE.ERC20)
        obj.tokenAddress = erc20Address.toLowerCase();
      else if (el.tokenType === Nf3.Constants.TOKEN_TYPE.ERC721)
        obj.tokenAddress = erc721Address.toLowerCase();
      else if (el.tokenType === Nf3.Constants.TOKEN_TYPE.ERC1155)
        obj.tokenAddress = erc1155Address.toLowerCase();
      return obj;
    });
    return tokenPreload;
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
      const tokenPool = Storage.tokensGet(nf3.zkpKeys.compressedPkd);
      // TODO Remove at some point (we dont need prloaded tokens)
      const tokenPreload = await preloadTokens();
      onLoadTokens(tokenPool || tokenPreload);
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
      onNewError(err.message);
      setTimeout(() => {
        onClearMsg();
      }, ERROR_AUTO_HIDE_PERIOD);
      console.log('ERROR', err);
    }
  };
  return (
    <Container textAlign="center">
      <Header
        as="h1"
        style={{
          fontSize: '2.5em',
          fontFamily: 'verdana',
          fontWeight: 'bold',
          marginBottom: 0,
          marginTop: '3em',
        }}
      >
        <PolygonLogo width="250px" height="100px" />
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
      {message.nf3Msg !== '' ? (
        <Message info={message.nf3MsgType === 'info'} error={message.nf3MsgType === 'error'}>
          <Message.Header>{message.nf3Msg}</Message.Header>
        </Message>
      ) : null}
      {renderRedirect()}
    </Container>
  );
}

Login.propTypes = {
  login: PropTypes.object.isRequired,
  message: PropTypes.object.isRequired,
  onLoadWallet: PropTypes.func.isRequired,
  onDeleteWallet: PropTypes.func.isRequired,
  onLoadTokens: PropTypes.func.isRequired,
  onNewError: PropTypes.func.isRequired,
  onClearMsg: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
  message: state.message,
});

const mapDispatchToProps = dispatch => ({
  onLoadWallet: nf3Instance => dispatch(loadWallet(nf3Instance)),
  onDeleteWallet: () => dispatch(deleteWallet()),
  onLoadTokens: newTokens => dispatch(tokensLoad(newTokens)),
  onNewError: errorMsg => dispatch(messageActions.newError(errorMsg)),
  onClearMsg: () => dispatch(messageActions.clearMsg()),
});

export default connect(mapStateToProps, mapDispatchToProps)(Login);
