import React from 'react';
import logo from '../../assets/img/polygonLogo.png';
import styles from '../../styles/header/logo.module.scss';

export default function Logo() {
  return (
    <div className={styles.container}>
      <div className={styles.boxLogo}>
        <img src={logo} />
      </div>
      <div className={styles.logoText}>
        <div className={styles.logoTitle}>nightfall</div>
        <span>Wallet</span>
      </div>
    </div>
  );
}
