import React, { Component } from 'react';
import { Table, Button, Icon } from 'semantic-ui-react';
import { connect } from 'react-redux'

class TransactionsMenu extends Component {

  render() {
    return (
      <Table padded textAlign="center" celled fixed>

        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Button.Group widths="3">
                <Button name="deposit" disabled={this.props.token.activeTokenRowId === ''} onClick={this.props.handleItemClick}>
                  <Icon name="sign-in" size="big"/>
                  Deposit
                </Button>
                <Button name="transfer" disabled={this.props.token.activeTokenRowId === ''} onClick={this.props.handleItemClick}>
                  <Icon name="share" size="big" />
                  Transfer
                </Button>
                <Button name="withdraw" disabled={this.props.token.activeTokenRowId === ''} onClick={this.props.handleItemClick}>
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
}

const mapStateToProps = (state) => ({
  token: state.token,
});

const mapDispatchToProps = (dispatch) => ({
});

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsMenu);
