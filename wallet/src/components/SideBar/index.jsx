import React from 'react';

import { GiElectric } from 'react-icons/gi';
import { RiWallet3Line } from 'react-icons/ri';
import { MdOutlineSupport } from 'react-icons/md';
import TransactionImg from '../../assets/svg/transactions-side.svg';
import TransactionImgGrey from '../../assets/svg/transactions-side-grey.svg';
import WalletImg from '../../assets/svg/wallet-side.svg';
import WalletImgGrey from '../../assets/svg/wallet-side-grey.svg';
import BridgeImg from '../../assets/svg/bridge-side.svg';
import BridgeImgGrey from '../../assets/svg/bridge-side-grey.svg';
import SideItem from './sideItems.jsx';
import styles from '../../styles/sidebar/body.module.scss';

export default function SideBar() {
  console.log(window.location.pathname);
  return (
    <div className={styles.sideBar}>
      <div className={styles.sideItems}>
        <SideItem text={'Nightfall Assets'} link={'/wallet'} Icon={[WalletImg, WalletImgGrey]} />
        <SideItem
          text={'L2 Bridge'}
          link={'/bridge'}
          Icon={[BridgeImg, BridgeImgGrey]}
          SideState={'0xf05e9fb485502e5a93990c714560b7ce654173c3'}
        />
        <SideItem
          text={'Transactions'}
          link={'/transactionPage'}
          Icon={[TransactionImg, TransactionImgGrey]}
        />
      </div>
      <div
        style={{
          bottom: '0',
          position: 'absolute',
          paddingBottom: '50px',
        }}
      >
        <div className={styles.links}>
          <GiElectric size={24} />
          <div className={styles.linkText}>{"What's new?"}</div>
        </div>
        <div className={styles.links}>
          <RiWallet3Line size={24} />
          <div className={styles.linkText}>Main Wallet</div>
        </div>
        <div className={styles.links}>
          <MdOutlineSupport size={24} />
          <div className={styles.linkText}>Support</div>
        </div>
      </div>
    </div>
  );
}
