import React from 'react';
import { generalise } from 'general-number';
import { Button, Modal } from 'react-bootstrap';
import { markWithdrawState } from '@Nightfall/services/database';
import { finaliseWithdrawal } from '@Nightfall/services/finalise-withdrawal';
import { isValidWithdrawal } from '@Nightfall/services/valid-withdrawal';
import { getStoreCircuit } from '@Nightfall/services/database.js';
import { submitTransaction } from '../../common-files/utils/contract';
import stylesModal from '../../styles/modal.module.scss';
import { shieldAddressGet } from '../../utils/lib/local-storage';
import successHand from '../../assets/img/success-hand.png';
import nightfall from '../../assets/svg/nightfall.svg';

interface TxModalProps {
  transactionhash: string;
  _id: string;
  recipientaddress: string;
  symbol: string;
  withdrawready: boolean;
  value: string;
  txtype: string;
}

export default function TxInfoModal(props: TxModalProps): JSX.Element {
  const [withdrawCircuitHash, setWithdrawCircuitHash] = React.useState('');

  React.useEffect(() => {
    const getWithdrawHash = async () => {
      const withdrawHash = generalise((await getStoreCircuit('withdraw-hash')).data)
        .hex(32)
        .toString();
      setWithdrawCircuitHash(withdrawHash);
    };
    getWithdrawHash();
  }, []);

  const confirmWithdraw = async () => {
    const shieldContractAddress = shieldAddressGet();
    const isValid = await isValidWithdrawal(props.transactionhash, shieldContractAddress);
    if (isValid) {
      const { rawTransaction } = await finaliseWithdrawal(
        props.transactionhash,
        shieldContractAddress,
      );
      try {
        await submitTransaction(rawTransaction, shieldContractAddress, 0, 0);
        await markWithdrawState(props.transactionhash, 'finalised');
      } catch (error) {
        console.log('Withdraw Failed');
      }
    }
  };

  return (
    <Modal {...props} centered>
      <Modal.Header closeButton>
        <Modal.Title>Transaction Information</Modal.Title>
      </Modal.Header>
      <Modal.Header>
        <Modal.Title style={{ fontSize: '1rem', lineHeight: '1.5rem' }}>
          <div>Transaction Amount</div>
        </Modal.Title>
        <Modal.Title style={{ fontSize: '1rem', lineHeight: '1.5rem' }}>
          <div>
            {props.value} {props.symbol}
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className={stylesModal.modalBody} style={{ textAlign: 'center' }}>
          <img src={successHand}></img>
          <p style={{ fontWeight: '600', fontSize: '1.125rem', lineHeight: '1.5rem' }}>
            Transaction Successfully Completed
          </p>
        </div>
        <div>
          <div
            className={stylesModal.transferModeModal__text}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {/* <Col xs={3}>Nightfall Hash</Col> */}
            <img src={nightfall} style={{ height: '32px', width: '32px' }}></img>
            <p style={{ margin: '0' }}>
              {props?.transactionhash
                ? `${props?.transactionhash.slice(0, 10)}...${props?.transactionhash.slice(-10)}`
                : ''}
            </p>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {props.withdrawready && props.txtype === withdrawCircuitHash ? (
          <Button
            style={{
              background: '#7B3FE4',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxSizing: 'border-box',
              width: '100%',
            }}
            onClick={() => confirmWithdraw()}
          >
            {' '}
            Complete Withdrawal{' '}
          </Button>
        ) : (
          ''
        )}
      </Modal.Footer>
    </Modal>
  );
}
