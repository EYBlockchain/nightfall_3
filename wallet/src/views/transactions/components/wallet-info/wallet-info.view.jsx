import React from 'react';
import { connect } from 'react-redux';
import { Table, Button, Container, Icon } from 'semantic-ui-react';
import Web3 from 'web3';
import PropTypes from 'prop-types';
import { addToken, selectToken, unselectToken } from '../../../../store/token/token.actions';

function WalletInfo({ login, token, onAddToken, onSelectToken, onUnselectToken }) {
  const importedWallet = () => {
    if (login.nf3.ethereumAddress === '' || typeof login.nf3.ethereumAddress === 'undefined') {
      return (
        <div>
          <Icon name="close" color="red" />
          You must import a wallet!
        </div>
      );
    }
    return login.nf3.ethereumAddress;
  };

  // TODO : substitute reload button by periodic function
  const reload = () => {
    login.nf3.getLayer2Balances().then(l2Balance => {
      const { compressedPkd } = login.nf3.zkpKeys;
      const myL2Balance =
        typeof l2Balance[compressedPkd] === 'undefined' ? {} : l2Balance[compressedPkd];
      const l2TokenAddressArr = myL2Balance === {} ? [] : Object.keys(myL2Balance);
      if (l2TokenAddressArr.length) {
        l2TokenAddressArr.forEach(l2TokenAddress => {
          login.nf3.getL1Balance(login.nf3.ethereumAddress).then(l1Balance => {
            onAddToken(
              `0x${l2TokenAddress.toLowerCase()}`,
              'ERC20',
              '0x00',
              l1Balance,
              Web3.utils.fromWei(myL2Balance[l2TokenAddress].toString(), 'nano'),
            );
          });
        });
      }
    });
  };

  function setActiveRow(id) {
    if (id !== token.activeTokenRowId) {
      onSelectToken(id);
    } else {
      onUnselectToken();
    }
  }

  function renderRowTable() {
    const rows = token.tokenPool.map(item => {
      return (
        <Table.Row
          key={item.id}
          active={item.id === token.activeTokenRowId}
          onClick={() => {
            setActiveRow(item.id);
          }}
        >
          <Table.Cell colSpan="4" title={item.tokenAddress}>
            {item.tokenAddress}
          </Table.Cell>
          <Table.Cell colSpan="1" title={item.tokenType}>
            {item.tokenType}
          </Table.Cell>
          <Table.Cell colSpan="1" title={item.tokenBalanceL1}>
            {item.tokenBalanceL1}
          </Table.Cell>
          <Table.Cell colSpan="1" title={item.tokenBalanceL2}>
            {item.tokenBalanceL2}
          </Table.Cell>
        </Table.Row>
      );
    });
    return rows;
  }

  React.useEffect(() => {
    reload();
  }, []);

  return (
    <Container>
      <Table padded>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell colSpan="4" textAlign="left">
              <Table.Cell>Account Address:</Table.Cell>
              <Table.Cell> {importedWallet()} </Table.Cell>
            </Table.HeaderCell>
            <Table.HeaderCell textAlign="right">
              <Button onClick={reload} disabled={token.activeTokenRowId === ''}>
                <Icon name="sync" />
                Reload
              </Button>
            </Table.HeaderCell>
            <Table.HeaderCell textAlign="right">
              <Button onClick={reload} disabled>
                <Icon name="plus" />
                Add Token
              </Button>
            </Table.HeaderCell>
            <Table.HeaderCell textAlign="right">
              <Button onClick={reload} disabled>
                <Icon name="minus" />
                Remove Token
              </Button>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell colSpan="4" textAlign="left">
              Token Address
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="1" textAlign="left">
              Token Type
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="1" textAlign="left">
              L1 Balance
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="1" textAlign="left">
              L2 Balance
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body> {renderRowTable()} </Table.Body>
      </Table>
      <br />
    </Container>
  );
}

WalletInfo.propTypes = {
  login: PropTypes.object.isRequired,
  token: PropTypes.object.isRequired,
  onAddToken: PropTypes.func.isRequired,
  onSelectToken: PropTypes.func.isRequired,
  onUnselectToken: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  token: state.token,
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onSelectToken: tokenRowId => dispatch(selectToken(tokenRowId)),
  onUnselectToken: () => dispatch(unselectToken()),
  onAddToken: (tokenAddress, tokenType, tokenId, l1Balance, l2Balance) =>
    dispatch(addToken(tokenAddress, tokenType, tokenId, l1Balance, l2Balance)),
});

export default connect(mapStateToProps, mapDispatchToProps)(WalletInfo);
