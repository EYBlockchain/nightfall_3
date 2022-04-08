import React from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import metamkaskLogo from '../../assets/svg/metamaskLogo.svg';
import { useAccount } from '../../hooks/Account/index.tsx';

import './accountDetails.scss';

export default function AccountDetails() {
  const { accountInstance } = useAccount();
  return (
    <div className="accountBox">
      <img src={metamkaskLogo} />
      {accountInstance.address && (
        <div className="accountAddress">
          {`${accountInstance.address.slice(0, 6)}...${accountInstance.address.slice(-6)}`}
        </div>
      )}
      {!accountInstance.address && <div className="accountAddress">sign in</div>}
      <span>
        <IoIosArrowDown />
      </span>
    </div>
  );
}
