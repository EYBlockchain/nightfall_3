import React from 'react';
import Transactions from '@Components/Transactions/index.jsx';

export default function TransactionPage() {
  return (
    <div className="blueBack">
      <div style={{ padding: '32px 80px' }}>
        <div
          className="headerH2"
          style={{
            fontWeight: '700',
            fontSize: '36px',
            lineHeight: '44px',
            letterSpacing: '-.01em',
          }}
        >
          Transactions
        </div>
        <div>
          <Transactions />
        </div>
      </div>
    </div>
  );
}
