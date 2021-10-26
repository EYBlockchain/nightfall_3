import React from 'react';
import { Menu, Icon, Button } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { deleteWallet } from '../../../../store/login/login.actions';

function HeaderMenu({ onDeleteWallet }) {
  const handleClickAccountInfo = () => {};

  const handleClickNFInfo = () => {};

  return (
    <Menu secondary>
      <Menu.Menu position="right">
        <Button name="logout" onClick={onDeleteWallet}>
          <Icon name="upload" size="large" />
          Logout
        </Button>
        <Button name="account-info" disabled onClick={() => handleClickAccountInfo()}>
          <Icon name="question circle" size="large" />
          Account Information
        </Button>
        <Button name="account-info" disabled onClick={() => handleClickNFInfo()}>
          <Icon name="question" size="large" />
          NightFall Information
        </Button>
      </Menu.Menu>
    </Menu>
  );
}

HeaderMenu.propTypes = {
  onDeleteWallet: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onDeleteWallet: () => dispatch(deleteWallet()),
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenu);
