import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import InstantWithdraw from '../Modals/instantWithdrawal';
import './withdraw.scss';

export default function WithdrawTransaction(props: any) {
  const [showInstant, setInstant] = useState(false);
  console.log('props.withdrawready', props.withdrawready);
  return (
    <>
      <div onClick={e => e.stopPropagation()}>
        <InstantWithdraw
          onHide={() => setInstant(false)}
          show={showInstant}
          {...props}
          transactionhash={props.transactionhash}
        ></InstantWithdraw>
      </div>
      <div className="withdrawDrop">
        <div className="withdraw-section">
          <div className="header-h6">
            {!props.withdrawready
              ? 'Your withdrawal is awaiting confirmation. If you need the funds now, you can do an instant withdrawal.'
              : 'Please click on Confirm to complete your withdrawal'}
          </div>
          <div className="btn-group">
            {!props.withdrawready ? (
              <Button
                variant="secondary"
                bsPrefix="withdraw-instant-btn"
                onClick={e => {
                  console.log('Instant', e.currentTarget);
                  e.stopPropagation();
                  setInstant(true);
                }}
              >
                Instant Withdraw
              </Button>
            ) : (
              <Button
                variant="primary"
                // Prop for if it is confirmed
                bsPrefix="withdraw-continue-btn"
                onClick={() => console.log('Finalised')}
              >
                Confirm Withdrawal
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
