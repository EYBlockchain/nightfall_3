import React, { useContext } from 'react';
import { useMediaQuery } from 'react-responsive';
import { IoIosArrowDown } from 'react-icons/io';
// import MenuItem from './menuItem.jsx';
import AccountDetails from './accountDetails.jsx';
import polygonNightfall from '../../assets/svg/polygon-nightfall.svg';

import './navItems.scss';
import { UserContext } from '../../hooks/User/index.jsx';

export default function NavItems() {
  const isSmallScreen = useMediaQuery({ query: '(max-width: 900px)' });
  const [state] = useContext(UserContext);
  return (
    <div className="navItems">
      {/* <MenuItem /> */}
      {!isSmallScreen && (
        <div className="accountBox">
          <img src={polygonNightfall} />
          {state.compressedPkd && (
            <div className="accountAddress">
              {`${state.compressedPkd.slice(0, 6)}...${state.compressedPkd.slice(-6)}`}
            </div>
          )}
          <span>
            <IoIosArrowDown />
          </span>
        </div>
      )}
      {!isSmallScreen && <AccountDetails />}
    </div>
  );
}
