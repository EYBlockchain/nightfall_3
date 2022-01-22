import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/initialPage.module.scss';
import polyNightfallWallet from '../static/img/homepage/polyNightfallWallet.png';
import polyBridge from '../static/img/homepage/polyBridge.png';
import polyStaking from '../static/img/homepage/polyStaking.png';
import polyWallet from '../static/img/homepage/polyWallet.png';
import polyWidgetDashboard from '../static/img/homepage/polyWidgetDashboard.png';

// fix: problems with page redirect and images presentation

// I changed all the names of the mainpage images for camelCase. Imported each one with the same name. And in the list of options
// to be presented in the cards of the mainpage I changed the imageName attribute to be equal of the name of the png image. So at the moment
// of present the image I doing some conditionals to present the correct image based on the imageName.

// About problem with redirection. I added the exec tag in the '/' route. This way the pege only be redirect to the main page if the path
// was exactly '/'.
const cardsData = [
  {
    imageName: 'polyWallet',
    title: 'Polygon Wallet',
    desc: 'Send and receive crypto assets on Polygon network',
    route: 'wallet',
  },
  {
    imageName: 'polyBridge',
    title: 'Polygon Bridge',
    desc: 'Deposit and withdraw between networks',
    route: 'bridge',
  },
  {
    imageName: 'polyNightfallWallet',
    title: 'Polygon Nightfall Wallet',
    desc: 'Send and receive crypto assets on Polygon Nightfall network',
    route: 'walletNF3',
  },
  {
    imageName: 'polyStaking',
    title: 'Polygon Staking',
    desc: 'Stake MATIC to earn rewards',
    route: 'staking',
    tag: 'Live on ETHEREUM chain',
  },
  {
    imageName: 'polyWidgetDashboard',
    title: 'Widget Dashboard',
    desc: 'Manage all your Polygon wallet widgets at one place',
    route: 'widget-dashboard',
    tag: 'Supported only on desktop',
  },
];

// src={require('../static/img/homepage/poly-bridge.png')}
export default function MainPage() {
  return (
    <div className={styles.homepage}>
      <div className={styles.headerh2}>Getting started with Polygon PoS chain</div>
      <div className="font-body-medium text-center text-gray-500 ms-t-12 ms-b-38">
        The safe, fast, and most secure way to use Polygon PoS.
      </div>
      <div className={styles.cardsContainer}>
        {cardsData.map((card, index) => (
          <Link key={index} to="/wallet">
            <div className={styles.mcard}>
              <div style={{ marginTop: '20px', marginBottom: '15px' }}>
                {/* TODO fix the .tag and width and height */}
                <img
                  src={
                    // eslint-disable-line no-nested-ternary
                    card.imageName === 'polyNightfallWallet' // eslint-disable-line no-nested-ternary
                      ? polyNightfallWallet // eslint-disable-line no-nested-ternary
                      : card.imageName === 'polyBridge' // eslint-disable-line no-nested-ternary
                      ? polyBridge // eslint-disable-line no-nested-ternary
                      : card.imageName === 'polyStaking' // eslint-disable-line no-nested-ternary
                      ? polyStaking // eslint-disable-line no-nested-ternary
                      : card.imageName === 'polyWallet' // eslint-disable-line no-nested-ternary
                      ? polyWallet // eslint-disable-line no-nested-ternary
                      : card.imageName === 'polyWidgetDashboard' && polyWidgetDashboard // eslint-disable-line no-nested-ternary
                  }
                  width={105}
                  height={110}
                  alt={card.title}
                />
              </div>
              <div className={styles.headerh4}>{card.title}</div>
              <div className={styles.desc}>{card.desc}</div>
              {card.tag && (
                // <div v-if="data.tag" className="tag ms-t-44 d-inline-block"></div>
                <div className={styles.tag}>{card.tag}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
