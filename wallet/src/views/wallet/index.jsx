import React from 'react';
import Assets from '../../components/Assets/index.jsx';
import Tokens from '../../components/Tokens/index.jsx';
import styles from '../../styles/wallet.module.scss';

export default function Wallet() {
  return (
    <div className={styles.wallet}>
      <Assets />
      <Tokens />
    </div>
  );
}
