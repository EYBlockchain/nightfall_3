import React from 'react';
import { useMediaQuery } from 'react-responsive';
import MenuItem from './menuItem.jsx';
import styles from '../../styles/header/navItems.module.scss';
import AccountDetails from './accountDetails.jsx';

export default function NavItems() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });

  return (
    <div className={styles.navItems}>
      <MenuItem />
      {!isSmallScreen && <AccountDetails />}
    </div>
  );
}
