import React from 'react';
import { Button, Col, Modal, Row } from 'react-bootstrap';
import { getContractAddress, submitTransaction } from '../../common-files/utils/contract';
import { markWithdrawState } from '../../nightfall-browser/services/database';
import { finaliseWithdrawal } from '../../nightfall-browser/services/finalise-withdrawal';
import { isValidWithdrawal } from '../../nightfall-browser/services/valid-withdrawal';
import stylesModal from '../../styles/modal.module.scss';

export default function TxInfoModal(props: any) {
  const confirmWithdraw = async () => {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
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
            <Col xs={9}>{props.recipientAddress}</Col>
          </Row>
          <Row className={stylesModal.transferModeModal__text}>
            <Col xs={3}>Nightfall Block Number</Col>
            <Col xs={9}>{props.isOnChain}</Col>
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
