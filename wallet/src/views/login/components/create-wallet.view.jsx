import React, { Component } from 'react';
import {
  Button, Modal, Form, Icon,
} from 'semantic-ui-react';
import { DEFAULT_PRIVATE_KEY } from '../../../constants';

class CreateWalletModal extends Component {
  constructor(props) {
    super(props);
    this.handleClickOnImport = this.props.handleClickOnImport.bind(this);
  }

  handleSubmit = () => {
    const privateKey = this.inputPrivateKey.value === '' ? DEFAULT_PRIVATE_KEY : this.inputPrivateKey.value;
    this.props.handleClickOnImport(privateKey);
    this.props.toggleModalPrivateKey();
  }

  render() {
    return (
      <Modal open={this.props.modalPrivateKey}>
        <Modal.Header>Create Nightfall Wallet</Modal.Header>
        <Modal.Content>
          <Form onSubmit={this.handleSubmit}>
            <Form.Field>
              <label htmlFor="private-key">
                Private Key
                <input
                  type="text"
                  ref={(value) => { this.inputPrivateKey = value; }}
                  placeholder={this.props.wallet.isValidPrivateKey
                    ? this.props.wallet.privateKey
                    : DEFAULT_PRIVATE_KEY}
                  onChange={this.handleChange}
                  id="private-key"
                />
              </label>
            </Form.Field>
            <Modal.Actions>
              <Button color="blue" type="submit">
                <Icon />
                Submit
              </Button>
            </Modal.Actions>
          </Form>
        </Modal.Content>
      </Modal>
    );
  }
}

export default CreateWalletModal;
