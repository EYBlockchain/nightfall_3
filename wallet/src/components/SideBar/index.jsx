import React from 'react';

import { GiElectric } from 'react-icons/gi';
import { CgArrowsExchange } from 'react-icons/cg';
import { RiWallet3Line } from 'react-icons/ri';
import { MdOutlineSupport } from 'react-icons/md';
import SideItem from './sideItems.jsx';
import styles from '../../styles/sidebar/body.module.scss';

export default function SideBar() {
  console.log(window.location.pathname);
  return (
    <div className={styles.sideBar}>
      <div className={styles.sideItems}>
        <SideItem text={'assets'} link={'/wallet'} Icon={RiWallet3Line} />
        <SideItem text={'bridge'} link={'/bridge'} Icon={CgArrowsExchange} />
      </div>
      <div>
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
