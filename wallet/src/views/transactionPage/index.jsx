import React from 'react';
import './styles.scss';
import Header from '@Components/Header/header.jsx';
import SideBar from '@Components/SideBar/index.jsx';
import Transactions from '@Components/Transactions/index.jsx';

export default function TransactionPage() {
  return (
    <div>
      <Header />
      <div className="bridgeComponent">
        <div className="bridgeComponent__left">
          <SideBar />
        </div>
        <div className="bridgeComponent__right">
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
        </div>
      </div>
    </div>
  );
}
