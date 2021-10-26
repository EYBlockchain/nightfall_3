import React from 'react';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';
import PropTypes from 'prop-types';

import HeaderMenu from './components/header-menu/header-menu.view.jsx';
import FooterMenu from './components/footer-menu/footer-menu.view.jsx';
import TransactionsMenu from './components/transactions-menu/transactions-menu.view.jsx';
import WalletInfo from './components/wallet-info/wallet-info.view.jsx';
import TransactionsModal from './components/transactions/transactions-modal.view.jsx';

function Transactions({ login }) {
  const renderRedirect = () => {
    if (login.isWalletInitialized) {
      return <Redirect to="/transactions" />;
    }
    return <Redirect to="/login" />;
  };

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
        }}
      >
        Nightfall Client
      </Header>
      <Divider />
      <TransactionsMenu />
      <WalletInfo />
      <TransactionsModal />
      <FooterMenu />
      {renderRedirect()}
    </Container>
  );
}

Transactions.propTypes = {
  login: PropTypes.object.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
