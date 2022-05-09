import React from 'react';
import { Button, Col, Modal, Row } from 'react-bootstrap';
import { markWithdrawState } from '@Nightfall/services/database';
import { finaliseWithdrawal } from '@Nightfall/services/finalise-withdrawal';
import { isValidWithdrawal } from '@Nightfall/services/valid-withdrawal';
import { submitTransaction } from '../../common-files/utils/contract';
import stylesModal from '../../styles/modal.module.scss';
import { shieldAddressGet } from '../../utils/lib/local-storage';

interface TxModalProps {
  transactionhash: string;
  _id: string;
  recipientaddress: string;
  isonChain: string;
  withdrawready: boolean;
}

export default function TxInfoModal(props: TxModalProps): JSX.Element {
  const confirmWithdraw = async () => {
    const shieldContractAddress = shieldAddressGet();
    const isValid = await isValidWithdrawal(props.transactionhash, shieldContractAddress);
    if (isValid) {
      const { rawTransaction } = await finaliseWithdrawal(
        props.transactionhash,
        shieldContractAddress,
      );
      try {
        await submitTransaction(rawTransaction, shieldContractAddress, 0);
        await markWithdrawState(props.transactionhash, 'finalised');
      } catch (error) {
        console.log('Withdraw Failed');
      }
    }
  };

  return (
    <Modal {...props} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Transaction Information</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className={stylesModal.modalBody}>
          <Row className={stylesModal.transferModeModal__text}>
            <Col xs={3}>Nightfall Transaction Hash</Col>
            <Col xs={9}>{props._id}</Col>
          </Row>
          <Row className={stylesModal.transferModeModal__text}>
            <Col xs={3}>Transaction Recipient</Col>
            <Col xs={9}>{props.recipientaddress}</Col>
          </Row>
          <Row className={stylesModal.transferModeModal__text}>
            <Col xs={3}>Nightfall Block Number</Col>
            <Col xs={9}>{props.isonChain}</Col>
          </Row>
          <Row>
            {props.withdrawready ? (
              <Button onClick={() => confirmWithdraw()}> Continue </Button>
            ) : (
              ''
            )}
          </Row>
        </div>
      </Modal.Body>
    </Modal>
  );
}
