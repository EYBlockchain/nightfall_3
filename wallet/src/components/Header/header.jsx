import React from 'react';
import { useMediaQuery } from 'react-responsive';
import { CgMenu } from 'react-icons/cg';
import styles from '../../styles/header/navHeader.module.scss';
import Logo from './logo.jsx';
import NavItems from './navItems.jsx';

export default function Header() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });

  if (!isSmallScreen) {
    return (
      <div className={styles.navHead}>
        <Logo />
        <NavItems />

        {/* <SearchBox /> */}
      </div>
    );
  }
  return (
    <div className={styles.navHead}>
      <CgMenu />
      <Logo />
      <NavItems />

      {/* <SearchBox /> */}
    </div>
  );
}
