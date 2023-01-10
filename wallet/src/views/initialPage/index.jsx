import React from 'react';
import { Link } from 'react-router-dom';

import polyBridge from '../../static/img/homepage/poly-bridge.png';
import polyStaking from '../../static/img/homepage/poly-staking.png';
import polyWallet from '../../static/img/homepage/poly-wallet.png';
import polyWidgetDashboard from '../../static/img/homepage/poly-widget-dashboard.png';

import './initial.scss';

// fix: problems with page redirect and images presentation

// I changed all the names of the mainpage images for camelCase. Imported each one with the same name. And in the list of options
// to be presented in the cards of the mainpage I changed the imageName attribute to be equal of the name of the png image. So at the moment
// of present the image I doing some conditionals to present the correct image based on the imageName.

// About problem with redirection. I added the exec tag in the '/' route. This way the pege only be redirect to the main page if the path
// was exactly '/'.
const cardsData = [
  {
    imageName: 'poly-wallet',
    title: 'Nightfall Wallet',
    desc: 'Privately send and receive crypto assets on Ethereum',
    route: 'walletNF3',
  },
];

export default function MainPage() {
  return (
    <div className="homepage">
      <div className="header-h2 text-center">Getting started with Polygon PoS chain</div>
      <div
        className="font-body-medium text-center text-gray-500"
        style={{ marginTop: '12px', marginBottom: '38px' }}
      >
        The safe, fast, and most secure way to use Polygon PoS.
      </div>
      <div
        className="cards-container d-flex flex-column flex-lg-row justify-content-center"
        style={{ marginTop: '44px' }}
      >
        {cardsData.map((card, index) => (
          <Link
            className={`m-card text-center ${card.imageName.toString()}`}
            key={index}
            to="/wallet"
          >
            {/* TODO fix the .tag and width and height */}
            <img
              src={
                // eslint-disable-line no-nested-ternary
                card.imageName === 'poly-nightfall-wallet' // eslint-disable-line no-nested-ternary
                  ? polyWallet // eslint-disable-line no-nested-ternary
                  : card.imageName === 'poly-bridge' // eslint-disable-line no-nested-ternary
                  ? polyBridge // eslint-disable-line no-nested-ternary
                  : card.imageName === 'poly-staking' // eslint-disable-line no-nested-ternary
                  ? polyStaking // eslint-disable-line no-nested-ternary
                  : card.imageName === 'poly-wallet' // eslint-disable-line no-nested-ternary
                  ? polyWallet // eslint-disable-line no-nested-ternary
                  : card.imageName === 'poly-widget-dashboard' && polyWidgetDashboard // eslint-disable-line no-nested-ternary
              }
              alt={card.title}
            />

            <div className="header-h4 dark-700">{card.title}</div>
            <div className="desc text-gray-500" style={{ marginTop: '8px' }}>
              {card.desc}
            </div>
            {card.tag && (
              // <div v-if="data.tag" className="tag ms-t-44 d-inline-block"></div>
              <div className="tag d-inline-block" style={{ marginTop: '44px' }}>
                {card.tag}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
