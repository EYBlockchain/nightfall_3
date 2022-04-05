import React from 'react';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
import Transactions from '../../components/Transactions/index.jsx';
import './styles.scss';

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
