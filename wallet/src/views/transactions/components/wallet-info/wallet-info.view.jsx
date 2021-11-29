import React from 'react';
import { connect } from 'react-redux';
import { Table, Button, Container, Icon } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import {
  addToken,
  selectToken,
  unselectToken,
  deleteToken,
} from '../../../../store/token/token.actions';
import { TokenAddModal } from './token-add.view.jsx';
import * as Constant from '../../../../constants';
import tokensLoad from '../../../../store/token/token.thunks';

function WalletInfo({
  login,
  token,
  onAddToken,
  onSelectToken,
  onUnselectToken,
  onDeleteToken,
  onLoadTokens,
}) {
  const [modalTokenAddEnable, setModalTokenAddEnable] = React.useState(false);
  const [removeTokenEnable, setRemoveTokenEnable] = React.useState(false);

  if (typeof login.nf3 === 'undefined') {
    return null;
  }

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
    onLoadTokens([]);
  };

  const toggleTokenSelected = () => {
    setRemoveTokenEnable(!removeTokenEnable);
  };

  function setActiveRow(id) {
    if (id !== token.activeTokenRowId) {
      onSelectToken(id);
      if (removeTokenEnable) {
        onDeleteToken(login.nf3.zkpKeys.compressedPkd, id);
        toggleTokenSelected();
      }
    } else {
      onUnselectToken();
    }
  }

  function renderRowTable() {
    const rows = token.tokenPool.map(item => {
      return (
        <Table.Row
          key={item.tokenAddress}
          active={item.tokenAddress === token.activeTokenRowId}
          onClick={() => {
            setActiveRow(item.tokenAddress);
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
    const retrieveBalance = setInterval(() => {
      reload();
    }, Constant.BALANCE_INTERVAL);
    return () => clearInterval(retrieveBalance);
  }, []);

  const handleOnTokenAddSubmit = (tokenName, tokenType, tokenAddress, tokenBalance) => {
    onAddToken(
      login.nf3.zkpKeys.compressedPkd,
      tokenAddress.toLowerCase(),
      tokenType,
      '0x0',
      tokenName,
      tokenBalance,
      '-',
    );
  };

  const toggleModalTokenAdd = () => {
    setModalTokenAddEnable(!modalTokenAddEnable);
  };

  const removeToken = () => {
    onUnselectToken();
    toggleTokenSelected();
  };

  return (
    <Container>
      <Table padded fixed selectable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell colSpan="4">
              <Table.Cell>Account Address:</Table.Cell>
              <Table.Cell id="wallet-info-cell-ethaddress"> {importedWallet()} </Table.Cell>
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="3">
              <Table.Cell />
              <Table.Cell />
              <Table.Cell>
                <Button
                  icon
                  labelPosition="left"
                  onClick={toggleModalTokenAdd}
                  id="wallet-info-cell-add-token"
                >
                  <Icon name="plus" />
                  Add Token
                </Button>
              </Table.Cell>
              <Table.Cell>
                <Button
                  icon
                  labelPosition="left"
                  id="wallet-info-cell-remove-token"
                  toggle
                  onClick={removeToken}
                  active={removeTokenEnable && token.tokenPool.length}
                  disabled={token.tokenPool.length === 0}
                >
                  <Icon name="minus" /> Remove Token
                </Button>
              </Table.Cell>
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
      <TokenAddModal
        modalTokenAdd={modalTokenAddEnable}
        toggleModalTokenAdd={toggleModalTokenAdd}
        handleOnTokenAddSubmit={handleOnTokenAddSubmit}
        nf3={login.nf3}
        token={token}
      />
    </Container>
  );
}

WalletInfo.propTypes = {
  login: PropTypes.object.isRequired,
  token: PropTypes.object.isRequired,
  onAddToken: PropTypes.func.isRequired,
  onSelectToken: PropTypes.func.isRequired,
  onUnselectToken: PropTypes.func.isRequired,
  onDeleteToken: PropTypes.func.isRequired,
  onLoadTokens: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  token: state.token,
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onSelectToken: tokenRowId => dispatch(selectToken(tokenRowId)),
  onUnselectToken: () => dispatch(unselectToken()),
  onAddToken: (compressedPkd, tokenAddress, tokenType, tokenId, tokenName, l1Balance, l2Balance) =>
    dispatch(
      addToken(compressedPkd, tokenAddress, tokenType, tokenId, tokenName, l1Balance, l2Balance),
    ),
  onDeleteToken: (compressedPkd, tokenRowId) => dispatch(deleteToken(compressedPkd, tokenRowId)),
  onLoadTokens: initTokens => dispatch(tokensLoad(initTokens)),
});

export default connect(mapStateToProps, mapDispatchToProps)(WalletInfo);
