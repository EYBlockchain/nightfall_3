import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Table, Button, Container, Icon, Popup, } from 'semantic-ui-react';
import { addToken, selectToken, unselectToken } from '../../../../store/token/token.actions';
import { getL1Balance } from '../../../../utils/lib/providers';


class WalletInfo extends Component {

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
        // TODO: Only works for a single token
        const tokenAddress = Object.keys(l2Balance)[0];
        getL1Balance(this.props.wallet.ethereumAddress).then((l1Balance) => {
          this.props.addToken('0x' + tokenAddress.toLowerCase(), 'ERC20', "0x00", l1Balance, l2Balance[tokenAddress]);
        })
      });
  }

  setActiveRow(id) {
    if (id !== this.props.token.activeTokenRowId) {
      this.props.selectToken(id);
    } else {
      this.props.unselectToken();
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
    this.props.nf3.getLayer2Balances()
      .then((l2Balance) => {
        // TODO: Only works for a single token
        const tokenAddress = Object.keys(l2Balance)[0];
        getL1Balance(this.props.wallet.ethereumAddress).then((l1Balance) => {
          this.props.addToken('0x' + tokenAddress.toLowerCase(), 'ERC20', "0x00", l1Balance, l2Balance[tokenAddress]);
        })
      });
  }

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
                <Button onClick={this.reload}> <Icon name="sync" /> Reload </Button>
              </Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload} disabled> <Icon name="plus" /> Add Token </Button>
              </Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload} disabled> <Icon name="minus" /> Remove Token </Button>
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
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  token: state.token,
});

const mapDispatchToProps = (dispatch) => ({
  selectToken: (tokenRowId) => dispatch(selectToken(tokenRowId)),
  unselectToken: () => dispatch(unselectToken()),
  addToken: (tokenAddress, tokenType, tokenId, l1Balance, l2Balance) => dispatch(addToken(tokenAddress, tokenType, tokenId, l1Balance, l2Balance)),
});

export default connect(mapStateToProps, mapDispatchToProps)(WalletInfo);
