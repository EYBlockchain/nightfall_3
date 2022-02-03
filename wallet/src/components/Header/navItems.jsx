import React from 'react';
import { useMediaQuery } from 'react-responsive';
import MenuItem from './menuItem.jsx';
import AccountDetails from './accountDetails.jsx';

import './navItems.scss';

export default function NavItems() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });

  return (
    <div className="navItems">
      <MenuItem />
      {!isSmallScreen && <AccountDetails />}
    </div>
  );
}
