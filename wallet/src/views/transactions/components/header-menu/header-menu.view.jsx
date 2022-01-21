import React from 'react';
import { Menu, Icon, Button } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { deleteWallet } from '../../../../store/login/login.actions';
import { clearMsg } from '../../../../store/message/message.actions';
import AccountSettingsModal from './account-settings.view.jsx';
import WithdrawInfoModal from './withdraw-info.view.jsx';

function HeaderMenu({ onDeleteWallet, onClearMsg }) {
  const [accountSettingsEnable, setAccountSettingsEnable] = React.useState(false);
  const [accountInfoEnable, setAccountInfoEnable] = React.useState(false);

  const toggleAccountSettings = () => {
    setAccountSettingsEnable(!accountSettingsEnable);
  };

  const toggleAccountInfo = () => {
    setAccountInfoEnable(!accountInfoEnable);
  };
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
        <Button name="account-info" primary onClick={() => toggleAccountInfo()}>
          <Icon name="question" size="large" />
          Withdrawal Information
        </Button>
      </Menu.Menu>
      <AccountSettingsModal
        accountSettingsEnable={accountSettingsEnable}
        toggleAccountSettings={toggleAccountSettings}
      />
      <WithdrawInfoModal
        accountInfoEnable={accountInfoEnable}
        toggleAccountInfo={toggleAccountInfo}
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
