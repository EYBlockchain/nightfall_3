import React from 'react';
import metamkaskLogo from '../../assets/svg/metamaskLogo.svg';
import styles from '../../styles/header/accountDetails.module.scss';

export default function AccountDetails() {
  return (
    <div className={styles.accountBox}>
      <div className={styles.accountAddress}>account</div>
      <img src={metamkaskLogo} />
    </div>
  );
}
