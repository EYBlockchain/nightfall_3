import React from 'react';
import { useMediaQuery } from 'react-responsive';
import { CgMenu } from 'react-icons/cg';
import Logo from './logo.jsx';
import NavItems from './navItems.jsx';

import './header.scss';

export default function Header() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 768px)' });

  if (!isSmallScreen) {
    return (
      <div className="navHead">
        <Logo />
        <NavItems />

        {/* <SearchBox /> */}
      </div>
    );
  }
  return (
    <div className="navHead">
      <CgMenu />
      <Logo />
      <NavItems />

      {/* <SearchBox /> */}
    </div>
  );
}
