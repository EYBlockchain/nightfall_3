import React from 'react';
import logo from '../../assets/img/polygonLogo.png';

import './logo.scss';

export default function Logo() {
  return (
    <div className="container">
      <div className="boxLogo">
        <img src={logo} />
      </div>
      <div className="logoText">
        <div className="logoTitle">nightfall</div>
        <span>Wallet</span>
      </div>
    </div>
  );
}
