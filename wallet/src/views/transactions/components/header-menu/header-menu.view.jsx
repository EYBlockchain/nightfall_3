import React from 'react';
import { Menu, Icon, Button } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { deleteWallet } from '../../../../store/login/login.actions';
import { clearMsg } from '../../../../store/message/message.actions';
import AccountSettingsModal from './account-settings.view.jsx';

function HeaderMenu({ onDeleteWallet, onClearMsg }) {
  const [accountSettingsEnable, setAccountSettingsEnable] = React.useState(false);

  const toggleAccountSettings = () => {
    setAccountSettingsEnable(!accountSettingsEnable);
  };

  const handleClickNFInfo = () => {};
  const onLogoutClick = () => {
    onDeleteWallet();
    onClearMsg();
  };

  return (
    <Menu secondary>
      <Menu.Menu position="right">
        <Button name="logout" primary onClick={onLogoutClick}>
          <Icon name="upload" size="large" />
          Logout
        </Button>
        <Button name="account-settings" primary onClick={() => toggleAccountSettings()}>
          <Icon name="settings" size="large" />
          Account Settings
        </Button>
        <Button name="deposit">
          <Icon name="settings" size="large" />
          <Link to="/deposit">Deposit</Link>
        </Button>
        <Button name="Withdraw">
          <Icon name="settings" size="large" />
          <Link to="/withdraw">withdraw</Link>
        </Button>
        <Button name="Single Transfer">
          <Icon name="settings" size="large" />
          <Link to="/singletransfer">Single Transfer</Link>
        </Button>
        <Button name="Double Transfer">
          <Icon name="settings" size="large" />
          <Link to="/doubletransfer">Double Transfer</Link>
        </Button>
        <Button name="account-info" primary disabled onClick={() => handleClickNFInfo()}>
          <Icon name="question" size="large" />
          NightFall Information
        </Button>
      </Menu.Menu>
      <AccountSettingsModal
        accountSettingsEnable={accountSettingsEnable}
        toggleAccountSettings={toggleAccountSettings}
      />
    </Menu>
  );
}

HeaderMenu.propTypes = {
  onDeleteWallet: PropTypes.func.isRequired,
  onClearMsg: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({});

const mapDispatchToProps = dispatch => ({
  onDeleteWallet: () => dispatch(deleteWallet()),
  onClearMsg: () => dispatch(clearMsg()),
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenu);
