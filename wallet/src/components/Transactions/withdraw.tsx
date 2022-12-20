import React from 'react';
import { Button } from 'react-bootstrap';
// import InstantWithdraw from '../Modals/instantWithdrawal';
import './withdraw.scss';

interface WithdrawProps {
  withdrawready: boolean;
  transactionhash: string;
}

export default function WithdrawTransaction(props: WithdrawProps): JSX.Element {
  // const [showInstant, setInstant] = useState(false);
  return (
    <>
      <div onClick={e => e.stopPropagation()}>
        {/*
          <InstantWithdraw
            onHide={() => setInstant(false)}
            show={showInstant}
            transactionhash={props.transactionhash}
          ></InstantWithdraw> */}
      </div>
      <div className="withdrawDrop">
        <div className="withdraw-section">
          <div className="header-h6">
            {!props.withdrawready
              ? 'Your withdrawal is awaiting confirmation. Come back later.'
              : 'Please click on Confirm to complete your withdrawal'}
          </div>
          <div className="btn-group">
            {!props.withdrawready ? (
              <></>
            ) : (
              <Button
                variant="primary"
                // Prop for if it is confirmed
                bsPrefix="withdraw-continue-btn"
                onClick={() => {
                  console.log('Finalised');
                }}
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
