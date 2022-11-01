import React from 'react';
import { useMediaQuery } from 'react-responsive';
import Logo from './logo.jsx';
import NavItems from './navItems.jsx';

import './header.scss';

export default function Header() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 1000px)' });

  if (!isSmallScreen) {
    return (
      <div className="navHead">
        <Logo />
        <NavItems />
      </div>
    );
  }
  return (
    <div className="navHead">
      <Logo />
      <NavItems />
    </div>
  );
}
