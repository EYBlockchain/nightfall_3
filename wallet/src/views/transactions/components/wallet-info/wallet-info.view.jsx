import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Table, Button, Container, Icon } from 'semantic-ui-react';
import Web3 from 'web3';
import * as tokenActions from '../../../../store/token/token.actions';
import { getL1Balance } from '../../../../utils/lib/providers';
import { TokenAddModal } from './token-add.view';


class WalletInfo extends Component {

  constructor(props){
    super(props);

    this.state = {
      isRemoveTokenSelected: false,
      modalTokenAdd: false,
    }
  }

  toggleModalTokenAdd = () => { this.setState((prev) => ({ modalTokenAdd: !prev.modalTokenAdd })); }

  handleOnTokenAddSubmit = (tokenName, tokenType, tokenAddress) => {
     this.props.onAddToken('0x' + tokenAddress.toLowerCase(), tokenType, '', '-', '-');
  }

  importedWallet = (wallet) => {
    if (wallet.ethereumAddress === '' || typeof wallet.ethereumAddress === 'undefined') {
      return (
        <div>
          <Icon name="close" color="red" />
          You must import a wallet!
        </div>
      );
    }
    return wallet.ethereumAddress;
  }

  // TODO : substitute reload button by periodic function
  reload = () => {
    this.props.nf3.getLayer2Balances()
      .then((l2Balance) => {
        const compressedPkd = this.props.wallet.zkpKeys.compressedPkd;
        const myL2Balance = typeof l2Balance[compressedPkd] === 'undefined' ? {} : l2Balance[compressedPkd];
        const l2TokenAddressArr = myL2Balance === {} ? []: Object.keys(myL2Balance);
        if (l2TokenAddressArr.length) {
          l2TokenAddressArr.forEach(l2TokenAddress => {
            this.props.nf3.getL1Balance(this.props.wallet.ethereumAddress).then((l1Balance) => {
              this.props.addToken('0x' + l2TokenAddress.toLowerCase(), 'ERC20', "0x00", l1Balance, Web3.utils.fromWei(myL2Balance[l2TokenAddress].toString(), 'nano'));
            })
          }
        });
      });
  }

  setActiveRow(id) {
    if (id !== this.props.token.activeTokenRowId) {
      this.props.onSelectToken(id);
      if (this.state.isRemoveTokenSelected){
         this.props.onDeleteToken(id);
         this.toggleTokenSelected();
      }
    } else {
      this.props.onUnselectToken();
    }
  }

  renderRowTable() {
    let rows = this.props.token.tokenPool.map(item => {
      return (
        <Table.Row
          key={item.id}
          active={item.id === this.props.token.activeTokenRowId}
          onClick={() => {
            this.setActiveRow(item.id);
          }}
        >
          <Table.Cell colSpan='4' title={item.tokenAddress}>{item.tokenAddress}</Table.Cell>
          <Table.Cell colSpan='1' title={item.tokenType}>{item.tokenType}</Table.Cell>
          <Table.Cell colSpan='1' title={item.tokenBalanceL1}>{item.tokenBalanceL1}</Table.Cell>
          <Table.Cell colSpan='1' title={item.tokenBalanceL2}>{item.tokenBalanceL2}</Table.Cell>
        </Table.Row>
      );
    });
    return rows;
  }

  componentDidMount() {
    this.reload();
  }

  toggleTokenSelected = () => 
     this.setState((prevState) => ({ isRemoveTokenSelected : !prevState.isRemoveTokenSelected}));

  removeToken = (() => {
    this.props.onUnselectToken();
    this.toggleTokenSelected();
  });

  render() {
    return (
      <Container>
        <Table padded>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan='4' textAlign="left">
                <Table.Cell> Account Address: </Table.Cell>
                <Table.Cell > {this.importedWallet(this.props.wallet)} </Table.Cell>
              </Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload} disabled={this.props.token.activeTokenRowId === ''}><Icon name="sync" /> Reload </Button>
              </Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.toggleModalTokenAdd}> <Icon name="plus" /> Add Token </Button>
              </Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button
                 toggle
                 onClick={this.removeToken}
                 active={this.state.isRemoveTokenSelected && this.props.token.tokenPool.length}
                 disabled={this.props.token.tokenPool.length === 0}
                > <Icon name="minus" /> Remove Token </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan='4' textAlign='left'> Token Address </Table.HeaderCell>
              <Table.HeaderCell colSpan='1' textAlign='left'> Token Type </Table.HeaderCell>
              <Table.HeaderCell colSpan='1' textAlign='left'> L1 Balance </Table.HeaderCell>
              <Table.HeaderCell colSpan='1' textAlign='left'> L2 Balance </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body> {this.renderRowTable()} </Table.Body>
        </Table>
        <br />
        <TokenAddModal
          modalTokenAdd={this.state.modalTokenAdd}
          toggleModalTokenAdd={this.toggleModalTokenAdd}
          handleOnTokenAddSubmit={this.handleOnTokenAddSubmit}
        />
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  token: state.token,
});

const mapDispatchToProps = (dispatch) => ({
  onSelectToken: (tokenRowId) => dispatch(tokenActions.selectToken(tokenRowId)),
  onUnselectToken: () => dispatch(tokenActions.unselectToken()),
  onAddToken: (tokenAddress, tokenType, tokenId, l1Balance, l2Balance) => dispatch(tokenActions.addToken(tokenAddress, tokenType, tokenId, l1Balance, l2Balance)),
  onDeleteToken: (tokenRowId) => dispatch(tokenActions.deleteToken(tokenRowId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(WalletInfo);
