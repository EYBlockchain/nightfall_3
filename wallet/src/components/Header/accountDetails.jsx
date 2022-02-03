import React from 'react';
import metamkaskLogo from '../../assets/svg/metamaskLogo.svg';

import './accountDetails.scss';

export default function AccountDetails() {
  return (
    <div className="accountBox">
      <div className="accountAddress">account</div>
      <img src={metamkaskLogo} />
    </div>
  );
}
