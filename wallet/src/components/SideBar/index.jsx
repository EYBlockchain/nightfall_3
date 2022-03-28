import React from 'react';

import { GiElectric } from 'react-icons/gi';
import { RiWallet3Line } from 'react-icons/ri';
import { MdOutlineSupport } from 'react-icons/md';
import { useMediaQuery } from 'react-responsive';
import TransactionImg from '../../assets/svg/transactions-side.svg';
import TransactionImgGrey from '../../assets/svg/transactions-side-grey.svg';
import WalletImg from '../../assets/svg/wallet-side.svg';
import WalletImgGrey from '../../assets/svg/wallet-side-grey.svg';
import BridgeImg from '../../assets/svg/bridge-side.svg';
import BridgeImgGrey from '../../assets/svg/bridge-side-grey.svg';
import SideItem from './sideItem.jsx';

import './index.scss';
import { getContractAddress } from '../../common-files/utils/contract';

export default function SideBar() {
  const isSmallScreen = useMediaQuery({ query: '(min-width: 768px)' });
  const [tokenAddress, setTokenAddres] = React.useState('');
  
  React.useEffect(() => {
    async function fecthData() {
      const { address } = (await getContractAddress('ERC20Mock')).data; // TODO Temporary while we use ERC20 Mocks.
      setTokenAddres(address);
    }
    fecthData();
  }, []);

  if (isSmallScreen) {
    return (
      <div className="sideBar">
        <div className="sideItems">
          <SideItem text={'Nightfall Assets'} link={'/wallet'} Icon={[WalletImg, WalletImgGrey]} />
          <SideItem
            text={'L2 Bridge'}
            link={'/bridge'}
            Icon={[BridgeImg, BridgeImgGrey]}
            SideState={tokenAddress}
          />
          <SideItem
            text={'Transactions'}
            link={'/transactionPage'}
            Icon={[TransactionImg, TransactionImgGrey]}
          />
        </div>
        <div>
          <div className="links">
            <GiElectric size={24} />
            <div className="linkText">{"What's new?"}</div>
          </div>
          <div className="links">
            <RiWallet3Line size={24} />
            <div className="linkText">Main Wallet</div>
          </div>
          <div className="links">
            <MdOutlineSupport size={24} />
            <div className="linkText">Support</div>
          </div>
        </div>
      </div>
    );
  }
  return <div></div>;
}
