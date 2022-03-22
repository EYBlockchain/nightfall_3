import React, { useState } from 'react';
import { Button, Col, FormControl, InputGroup, Modal, ProgressBar, Row } from 'react-bootstrap';
import { getContractAddress, submitTransaction } from '../../common-files/utils/contract';
import { markWithdrawState } from '../../nightfall-browser/services/database';
import setInstantWithdrawl from '../../nightfall-browser/services/instant-withdrawal';
import './index.scss';

export default function InstantWithdraw(props: any) {
  const [fee, setFee] = useState(0);
  const setInstantWithdrawal = async () => {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { rawTransaction } = await setInstantWithdrawl(
      props.transactionhash,
      shieldContractAddress,
    );
    try {
      await submitTransaction(rawTransaction, shieldContractAddress, fee);
      await markWithdrawState(props.transactionhash, 'instant');
    } catch (error) {
      console.log('Withdraw Failed');
    }
  };
  return (
    <Modal {...props} centered dialogClassName="box s-modal">
      <Modal.Header bsPrefix="box-header">
        {/* <Modal.Title> */}
        <div className="modal-title">Request Instant Withdrawl</div>
        {/* </Modal.Title> */}
        <Button className="btn-close" bsPrefix="close-btn" onClick={() => props.onHide()}></Button>
      </Modal.Header>
      <Modal.Body>
        <Row className="ps-x-32 ps-y-16 border-top border-bottom">
          <Col xs={8}>Transfer Amount</Col>
          <Col>0.1 Eth</Col>
        </Row>
        <Row className="ps-x-32 ps-y-16 border-bottom">
          <ProgressBar now={30} />
        </Row>
        <Row className="ps-x-32 ps-y-16 border-bottom">
          <h5>Instant Withdrawal Request</h5>
          <p>
            For security reasons, withdrawals takes 7 days to be finalised. Instant withdrawals
            allows you to skip this 7 day wait for a fee.
            <br></br>
            This fee is collected by Liquidity Providers (LPs) in exchange for paying you the
            withdrawal ahead of time.
            <br></br>
            Set the fee that you are willing to pay for this withdrawal to be processed early.
            <br></br>
            Note:
            <br></br>
            There is no guarantee that your request for an instant withdrawal will be fulfilled. It
            is dependent on the fee provided and availability of LPs.
          </p>
        </Row>
        <Row>
          <InputGroup className="mb-3">
            <FormControl
              placeholder="Fee For Instant Withdrawal"
              aria-label="Fee For Instant Withdrawal"
              value={fee}
              onChange={e => setFee(parseFloat(e.target.value))}
            />
            <Button variant="outline-secondary" onClick={() => setInstantWithdrawal()}>
              Set Instant Withdrawal
            </Button>
          </InputGroup>
        </Row>
      </Modal.Body>
    </Modal>
  );
}
