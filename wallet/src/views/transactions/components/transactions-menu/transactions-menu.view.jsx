import React from 'react';
import { Table, Button, Icon } from 'semantic-ui-react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as txActionTypes from '../../../../store/transactions/transactions.actions';

function TransactionsMenu({ token, onNewTx }) {
  return (
    <Table padded textAlign="center" celled fixed>
      <Table.Body>
        <Table.Row>
          <Table.Cell>
            <Button.Group widths="3">
              <Button
                name="deposit"
                disabled={token.activeTokenRowId === ''}
                onClick={(e, { name }) => onNewTx(name)}
              >
                <Icon name="sign-in" size="big" />
                Deposit
              </Button>
              <Button
                name="transfer"
                disabled={token.activeTokenRowId === ''}
                onClick={(e, { name }) => onNewTx(name)}
              >
                <Icon name="share" size="big" />
                Transfer
              </Button>
              <Button
                name="withdraw"
                disabled={token.activeTokenRowId === ''}
                onClick={(e, { name }) => onNewTx(name)}
              >
                <Icon name="sign-out" size="big" />
                Withdraw
              </Button>
            </Button.Group>
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

TransactionsMenu.propTypes = {
  token: PropTypes.object.isRequired,
  onNewTx: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  token: state.token,
});

const mapDispatchToProps = dispatch => ({
  onNewTx: txType => dispatch(txActionTypes.txNew(txType)),
});

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsMenu);
