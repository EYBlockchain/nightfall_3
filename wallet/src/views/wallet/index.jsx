import React from 'react';
import Assets from '../../components/Assets/index.jsx';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
import Tokens from '../../components/Tokens/index.jsx';
import styles from '../../styles/wallet.module.scss';

export default function Wallet() {
  return (
    <div className={styles.wallet}>
      <Header />
      <div className={styles.walletComponents}>
        <div className={styles.walletComponents__left}>
          <SideBar />
        </div>
        <div className={styles.walletComponents__right}>
          <Assets />
          <Tokens />
        </div>
      </div>
    </div>
  );
}
