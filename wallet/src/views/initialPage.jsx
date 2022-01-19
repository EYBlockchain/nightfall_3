import React from 'react';
import styles from '../styles/initialPage.module.scss';

const cardsData = [
  {
    imageName: 'poly-wallet',
    title: 'Polygon Wallet',
    desc: 'Send and receive crypto assets on Polygon network',
    route: 'wallet',
  },
  {
    imageName: 'poly-nightfall-wallet',
    title: 'Polygon Nightfall Wallet',
    desc: 'Send and receive crypto assets on Polygon Nightfall network',
    route: 'walletNF3',
  },
  {
    imageName: 'poly-bridge',
    title: 'Polygon Bridge',
    desc: 'Deposit and withdraw between networks',
    route: 'bridge',
  },
  {
    imageName: 'poly-staking',
    title: 'Polygon Staking',
    desc: 'Stake MATIC to earn rewards',
    route: 'staking',
    tag: 'Live on ETHEREUM chain',
  },
  {
    imageName: 'poly-widget-dashboard',
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
      <a href="/login">
        <div className={styles.cardsContainer}>
          {cardsData.map((card, index) => (
            <div className={styles.mcard} key={index}>
              <div style={{ marginTop: '20px', marginBottom: '15px' }}>
                {/* TODO fix the .tag and width and height */}
                <img src="" width={105} height={110} alt={card.title} />
              </div>
              <div className={styles.headerh4}>{card.title}</div>
              <div className="desc text-gray-500 ms-t-8">{card.desc}</div>
              {card.tag && (
                // <div v-if="data.tag" className="tag ms-t-44 d-inline-block"></div>
                <div className={styles.tag}>{card.tag}</div>
              )}
            </div>
          ))}
        </div>
      </a>
    </div>
  );
}
