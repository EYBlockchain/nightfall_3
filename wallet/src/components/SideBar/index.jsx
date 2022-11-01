import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import TransactionImg from '../../assets/svg/transactions-side.svg';
import WalletImg from '../../assets/svg/wallet-side.svg';
import BridgeImg from '../../assets/svg/bridge-side.svg';
import synced from '../../assets/svg/tickBox.svg';

import './index.scss';
import { UserContext } from '../../hooks/User';

const sidebarLinks = [
  {
    text: 'Nightfall Assets',
    pathname: '/',
    icon: WalletImg,
  },
  {
    text: 'L2 Bridge',
    pathname: '/bridge',
    icon: BridgeImg,
  },
  {
    text: 'Transactions',
    pathname: '/transactionPage',
    icon: TransactionImg,
  },
];

export default function SideBar() {
  const isSmallScreen = useMediaQuery({ query: '(min-width: 768px)' });
  const [state] = useContext(UserContext);
  const isSynced = state.circuitSync && state.chainSync;

  if (isSmallScreen) {
    return (
      <div className="sidebar">
        <div className="sidebar__links">
          {sidebarLinks.map(({ pathname, text, icon }) => (
            <NavLink
              key={text}
              className="sidebar__link"
              activeClassName="sidebar__link--active"
              exact
              to={{
                pathname,
              }}
            >
              <img className="sidebar__icon" alt={`${text} icon`} src={icon} />
              <div>{text}</div>
            </NavLink>
          ))}
        </div>

        <div className="sidebar__status">
          {isSynced ? (
            <>
              <img src={synced} style={{ height: '32px', width: '32px' }} />
              <div>Nightfall Synced</div>
            </>
          ) : (
            <>
              <div className="sidebar__spinner"></div>
              <div>Syncing Nightfall...</div>
            </>
          )}
        </div>
      </div>
    );
  }
  return <div />;
}
