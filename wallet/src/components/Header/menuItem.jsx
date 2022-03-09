import React from 'react';
import { CgMenuGridO } from 'react-icons/cg';
import { useMediaQuery } from 'react-responsive';

import './menuItem.scss';

export default function MenuItem() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });

  return (
    <div className="menuBox">
      <CgMenuGridO />
      {!isSmallScreen && <span>Apps</span>}
    </div>
  );
}
