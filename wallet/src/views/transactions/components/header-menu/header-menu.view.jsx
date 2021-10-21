import React, { Component } from 'react';
import { Menu, Icon, Button } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { deleteWallet } from '../../../../store/login/login.actions';

class HeaderMenu extends Component {
  handleClickLogout = () => {
    this.props.deleteWallet();
  }

  handleClickAccountInfo = () => {
  }

  handleClickNFInfo = () => {
  }

  render() {
    return (
      <Menu secondary>
        <Menu.Menu position="right">
          <Button
            name="logout"
            onClick={() => this.handleClickLogout()}
          >
            <Icon
              name="upload"
              size="large"
            />
            Logout
          </Button>
          <Button
            name="account-info"
            disabled
            onClick={() => this.handleClickAccountInfo()}
          >
            <Icon name="question circle" size="large" />
            Account Information
          </Button>
          <Button
            name="account-info"
            disabled
            onClick={() => this.handleClickNFInfo()}
          >
            <Icon name="question" size="large" />
            NightFall Information
          </Button>
        </Menu.Menu>
      </Menu>
    );
  }
}

const mapStateToProps = (state) => ({
  login: state.login,
});

const mapDispatchToProps = (dispatch) => ({
  deleteWallet: () => dispatch(deleteWallet()),
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenu);
