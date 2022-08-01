import React, { useContext } from 'react';

import { useMediaQuery } from 'react-responsive';
import Lottie from 'lottie-react';
import TransactionImg from '../../assets/svg/transactions-side.svg';
import TransactionImgGrey from '../../assets/svg/transactions-side-grey.svg';
import WalletImg from '../../assets/svg/wallet-side.svg';
import WalletImgGrey from '../../assets/svg/wallet-side-grey.svg';
import BridgeImg from '../../assets/svg/bridge-side.svg';
import BridgeImgGrey from '../../assets/svg/bridge-side-grey.svg';
import SideItem from './sideItem.jsx';
import syncing from '../../assets/lottie/syncing.json';
import synced from '../../assets/svg/tickBox.svg';

import './index.scss';
import { UserContext } from '../../hooks/User';

export default function SideBar() {
  const isSmallScreen = useMediaQuery({ query: '(min-width: 768px)' });
  const [state] = useContext(UserContext);
  if (isSmallScreen) {
    return (
      <div className="sideBar">
        <div className="sideItems">
          <SideItem text="Nightfall Assets" link="/" Icon={[WalletImg, WalletImgGrey]} />
          <SideItem
            text="L2 Bridge"
            link="/bridge"
            Icon={[BridgeImg, BridgeImgGrey]}
            SideState=""
          />
          <SideItem
            text="Transactions"
            link="/transactionPage"
            Icon={[TransactionImg, TransactionImgGrey]}
          />
        </div>
        <div>
          <div className="links">
            {/* <GiElectric size={24} /> */}
            {/* eslint-disable */
            state.circuitSync && state.chainSync ? (
              <>
                <img src={synced} style={{ height: '32px', width: '32px' }} />
                <div className="linkText">Nightfall Synced</div>
              </>
            ) : state.timberSync ?(
              <>
                <Lottie style={{ height: '32px', width: '32px' }} animationData={syncing} loop />
                <div className="linkText">Timber Synced - Syncing Nightfall...</div>
              </>
            ) : (
              <>
                <Lottie style={{ height: '32px', width: '32px' }} animationData={syncing} loop />
                <div className="linkText">Syncing Nightfall...</div>
              </>
            )
            /* eslint-enable */
            }
          </div>
          {/* <div className="links">
            <MdOutlineSupport size={24} />
            <div className="linkText">Support</div>
          </div> */}
        </div>
      </div>
    );
  }
  return <div />;
}
