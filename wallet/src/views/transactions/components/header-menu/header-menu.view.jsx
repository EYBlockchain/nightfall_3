import React from 'react';
import { Menu, Icon, Button } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { deleteWallet } from '../../../../store/login/login.actions';
import { clearError } from '../../../../store/error/error.actions';
import AccountSettingsModal from './account-settings.view.jsx';

function HeaderMenu({ onDeleteWallet, onClearError }) {
  const [accountSettingsEnable, setAccountSettingsEnable] = React.useState(false);

  const toggleAccountSettings = () => {
    setAccountSettingsEnable(!accountSettingsEnable);
  };

  const handleClickNFInfo = () => {};
  const onLogoutClick = () => {
    onDeleteWallet();
    onClearError();
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
  onClearError: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({});

const mapDispatchToProps = dispatch => ({
  onDeleteWallet: () => dispatch(deleteWallet()),
  onClearError: () => dispatch(clearError()),
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenu);
