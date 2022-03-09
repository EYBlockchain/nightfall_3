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
          account {accountInstance.address.slice(2, accountInstance.address.length)}
        </div>
      )}
      {!accountInstance.address && <div className="accountAddress">sign in</div>}
      <span>
        <IoIosArrowDown />
      </span>
    </div>
  );
}
