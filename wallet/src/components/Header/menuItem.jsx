import React from 'react';
import { CgMenuGridO } from 'react-icons/cg';
import { useMediaQuery } from 'react-responsive';
import styles from '../../styles/header/menuItem.module.scss';

export default function MenuItem() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });

  return (
    <div className={styles.menuBox}>
      <CgMenuGridO />
      {!isSmallScreen && <p>Apps</p>}
    </div>
  );
}
