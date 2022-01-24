import React from 'react';

import styles from '../../styles/sidebar/body.module.scss';
import SideItem from './sideItems.jsx';

export default function SideBar() {
  return (
    <div className={styles.sideBar}>
      <SideItem text={'assets'} link={'/wallet'} />
      <SideItem text={'bridge'} link={'/bridge'} />
    </div>
  );
}
