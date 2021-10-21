import React from 'react';
import { Container, Header, Divider, Button, } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import Nf3 from 'nf3';

import CreateWalletModal from './components/create-wallet.view';
import { loadWallet, deleteWallet } from '../../store/login/login.actions';
import createWalletFromEtherAccount from '../../utils/lib/nightfall-wallet';
import { getCurrentEnvironment, setContractAddresses } from '../../utils/lib/environment';
import { ReactComponent as MetaMaskLogo } from '../../images/metamask.svg';
import { METAMASK_MESSAGE } from '../../constants';


function Login({
  login,
  onLoadWallet,
  onDeleteWallet,
}) {

  const [ modalPrivateKey, setModalPrivateKey] = React.useState(false);

  const toggleModalPrivateKey = () => {
    setModalPrivateKey(!modalPrivateKey);
  };


  const renderRedirect = () => {
    if (login.isWalletInitialized) {
      return <Redirect to="/transactions" />;
    } else {
      return <Redirect to="/login" />;
    }
  }

  /**
    * Imports a nightfall wallet based on an Ethereum Private Key
    * @param {string} privateKey - Ethereum Private Key
  */
  const handleClickOnImport = async (privateKey) => {
    let wallet;
    const ethereumSigningKey = typeof privateKey === 'string' ? privateKey : '';
    const nf3Env = getCurrentEnvironment().currentEnvironment;
    const nf3 = new Nf3(
      nf3Env.clientApiUrl,
      nf3Env.optimistApiUrl,
      nf3Env.optimistWsUrl,
      nf3Env.web3WsUrl,
      ethereumSigningKey,
    );
    // Start NF3
    try {
      await nf3.init();
    } catch (err) {
        // TODO display error message
        console.log("NO connection", err);
    }

    const ethereumAddress = await nf3.getAccounts();
    // Run checks if Metamask selected
    if (typeof privateKey !== 'string'){
      try {
        // netId === configured netId
        const netId = await nf3.getNetworkId();
        // TODO display error message
        if (netId !== nf3Env.chainId){
          console.log("unexpected NET", netId, nf3Env.chainId)
          return;
        }
      } catch (err) {
        // TODO display error message
        console.log("NO connection", err)
      }
      /*
      try{
        await nf3.signMessage(METAMASK_MESSAGE, ethereumAddress);
      } catch(err) {
        //TODO display error message
        console.log("Metamask not found", err)
        return
      }
      */
      privateKey = '';
    } 

    try {
      // TODO - wallet not needed anymore. All info is in nf3
      wallet = await createWalletFromEtherAccount(privateKey, ethereumAddress, nf3.zkpKeys);

      setContractAddresses(nf3);

      // Set Wallet and Nf3 object
      onLoadWallet(wallet, nf3);

    } catch (err) {
      console.log("Failed", err)
      onDeleteWallet();
    }
  }

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
        <div>
          <Button
            content="Create Wallet"
            icon="plus"
            size="massive"
            color="blue"
            onClick={toggleModalPrivateKey}
          />
        </div>
      <Divider />
      <h1> Connect with: </h1>
        <div onClick={handleClickOnImport}>
          <a href="#">
            <MetaMaskLogo width="60px" height="60px"/>
          </a>
        </div>
      <Divider />
      <CreateWalletModal
        modalPrivateKey={modalPrivateKey}
        toggleModalPrivateKey={toggleModalPrivateKey}
        handleClickOnImport={handleClickOnImport}
        wallet={login.wallet} />
      {renderRedirect()}
    </Container>
  );
}

const mapStateToProps = (state) => ({
  login: state.login,
});

const mapDispatchToProps = (dispatch) => ({
  onLoadWallet: (wallet, nf3) => dispatch(loadWallet(wallet, nf3)),
  onDeleteWallet: () => dispatch(deleteWallet()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Login);

