import React from 'react';
import { connect } from 'react-redux';
import { Table, Button, Container, Icon, Accordion } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import * as Nf3 from 'nf3';
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

  function setActiveRow(id, tokenId) {
    // set active row if token Ids are different, token Address are different,
    // or if tokenId is equal to active, but address is different
    //  (different ERC1155 token with same token Id)
    if (
      tokenId !== token.activeTokenId ||
      id !== token.activeTokenRowId ||
      (id !== token.activeTokenRowId && tokenId === token.activeTokenId)
    ) {
      onSelectToken(id, tokenId);
      if (removeTokenEnable) {
        onDeleteToken(login.nf3.zkpKeys.compressedPkd, id, tokenId);
        toggleTokenSelected();
      }
    } else {
      onUnselectToken(true);
    }
    reload();
  }

  function renderItemCaret(tokenAddress) {
    if (token.detailedErc1155.includes(tokenAddress)) {
      return <Icon name="caret down" />;
    }
    return <Icon name="caret right" />;
  }

  function renderRowTable() {
    const rows = token.tokenPool.map(item => {
      const tokenTypeId = `token type${item.tokenAddress}`;
      const l1BalanceId = `l1 balance${item.tokenAddress}`;
      const l2BalanceId = `l2 balance${item.tokenAddress}`;
      const pendingDepositId = `pending deposit${item.tokenAddress}`;
      const pendingTransferredOutId = `pending transferred out${item.tokenAddress}`;
      const itemRows = [];
      if (item.tokenType !== Nf3.Constants.TOKEN_TYPE.ERC1155)
        itemRows.push(
          <Table.Row
            key={item.tokenAddress}
            active={item.tokenAddress === token.activeTokenRowId}
            onClick={() => {
              setActiveRow(item.tokenAddress, null);
            }}
          >
            <Table.Cell colSpan="4" title={item.tokenAddress} id="address">
              {item.tokenAddress}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenType} id={tokenTypeId}>
              {item.tokenType}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenBalanceL1} id={l1BalanceId}>
              {item.tokenBalanceL1}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenBalanceL2} id={l2BalanceId}>
              {item.tokenBalanceL2}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenBalanceL2} id={pendingDepositId}>
              {item.tokenPendingDepositL2}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenBalanceL2} id={pendingTransferredOutId}>
              {item.tokenPendingSpentL2}
            </Table.Cell>
          </Table.Row>,
        );
      else {
        // main row
        itemRows.push(
          <Table.Row
            key={item.tokenAddress}
            active={item.tokenAddress === token.activeTokenRowId && token.activeTokenId === null}
            onClick={() => {
              setActiveRow(item.tokenAddress, null);
            }}
          >
            <Table.Cell colSpan="4" title={item.tokenAddress} id="address">
              {renderItemCaret(item.tokenAddress)}
              {item.tokenAddress}
            </Table.Cell>
            <Table.Cell colSpan="1" title={item.tokenType} id={tokenTypeId}>
              {item.tokenType}
            </Table.Cell>
          </Table.Row>,
        );
        // Auxiliary rows
        if (token.detailedErc1155.includes(item.tokenAddress)) {
          for (let idx = 0; idx < item.tokenErc1155Details.length; idx++) {
            itemRows.push(
              <Table.Row
                key={item.tokenErc1155Details[idx].tokenId}
                active={item.tokenErc1155Details[idx].tokenId === token.activeTokenId}
                onClick={() => {
                  setActiveRow(item.tokenAddress, item.tokenErc1155Details[idx].tokenId);
                }}
              >
                <Table.Cell colSpan="1"></Table.Cell>
                <Table.Cell colSpan="1">{item.tokenErc1155Details[idx].tokenId}</Table.Cell>
                <Table.Cell colSpan="3"></Table.Cell>
                <Table.Cell colSpan="1">{item.tokenErc1155Details[idx].l1Balance}</Table.Cell>
                <Table.Cell colSpan="1">{item.tokenErc1155Details[idx].l2Balance}</Table.Cell>
                <Table.Cell colSpan="1">{item.tokenErc1155Details[idx].pendingDeposit}</Table.Cell>
                <Table.Cell colSpan="1">{item.tokenErc1155Details[idx].pendingSpent}</Table.Cell>
              </Table.Row>,
            );
          }
        }
      }
      return itemRows;
    });
    return rows;
  }

  React.useEffect(() => {
    const retrieveBalance = setInterval(() => {
      reload();
    }, Constant.BALANCE_INTERVAL);
    return () => clearInterval(retrieveBalance);
  }, []);

  const handleOnTokenAddSubmit = (tokenName, tokenType, tokenAddress, tokenErc1155Details) => {
    const tokenInfo = {
      tokenId: '0x0',
      balance: '0',
      decimals: 0,
      tokenAddress: tokenAddress.toLowerCase(),
      tokenType,
      tokenName,
      tokenErc1155Details,
    };
    onAddToken(login.nf3.zkpKeys.compressedPkd, tokenInfo);
  };
  const toggleModalTokenAdd = () => {
    setModalTokenAddEnable(!modalTokenAddEnable);
  };

  const removeToken = () => {
    onUnselectToken(false);
    toggleTokenSelected();
  };

  return (
    <Container>
      <Table padded fixed selectable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Account Address:</Table.HeaderCell>
            <Table.HeaderCell colSpan="4" id="wallet-info-cell-ethaddress">
              {' '}
              {importedWallet()}{' '}
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="4">
              <Button
                icon
                labelPosition="left"
                onClick={toggleModalTokenAdd}
                primary
                floated="right"
                id="wallet-info-cell-add-token"
              >
                <Icon name="plus" />
                Add Token
              </Button>
              <Button
                icon
                labelPosition="left"
                id="wallet-info-cell-remove-token"
                toggle
                onClick={removeToken}
                primary
                floated="right"
                active={removeTokenEnable && token.tokenPool.length > 0}
                disabled={token.tokenPool.length === 0}
              >
                <Icon name="minus" /> Remove Token
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
            <Table.HeaderCell colSpan="1" textAlign="left">
              Pending Deposit
            </Table.HeaderCell>
            <Table.HeaderCell colSpan="1" textAlign="left">
              Pending Outflow
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
  onSelectToken: (tokenRowId, tokenId) => dispatch(selectToken(tokenRowId, tokenId)),
  onUnselectToken: removeFromDisplayedDetails => dispatch(unselectToken(removeFromDisplayedDetails)),
  onAddToken: (compressedPkd, tokenInfo) => dispatch(addToken(compressedPkd, tokenInfo)),
  onDeleteToken: (compressedPkd, tokenRowId, tokenId) =>
    dispatch(deleteToken(compressedPkd, tokenRowId, tokenId)),
  onLoadTokens: initTokens => dispatch(tokensLoad(initTokens)),
});

export default connect(mapStateToProps, mapDispatchToProps)(WalletInfo);
