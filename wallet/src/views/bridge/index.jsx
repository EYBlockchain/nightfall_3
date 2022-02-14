/* eslint-disable react/jsx-no-undef */
/* eslint-disable react/jsx-pascal-case */
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';
import styles from '../../styles/bridge.module.scss';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
// eslint-disable-next-line import/no-unresolved
import BridgeComponent from '../../components/BridgeComponent';

const Bridge = () => {
  // const location = useLocation();

  function defineComponents() {
    const BridgeElement = reactToWebcomponent(BridgeComponent, React, ReactDOM);
    customElements.define('bridge-component', BridgeElement);
    // const bridgeComponent = document.createElement('bridge-component');
    // bridgeComponent.location = location;
  }

  useEffect(() => {
    defineComponents();
  }, []);

  return (
    // containerFluid
    <div>
      <Header />
      <div className={styles.bridgeComponent}>
        <div className={styles.bridgeComponent__left}>
          <SideBar />
        </div>
        <div className={styles.bridgeComponent__right}>
          <div className={styles.blueBack}>
            {/* <WarningBanner className="warning-banner" /> */}

            <div className={styles.pagePartition}>
              <div className={styles.infoWrapper}>
                <div className={styles.innerWrapper}>
                  <div className={styles.headerH2}>Nightfall Bridge</div>
                  <div className={styles.description}>
                    Safe, fast and private token transfers on Ethereum.
                  </div>
                  <div className={styles.points}>
                    {/* v-tooltip="{
                                      content: fastWithdrawInfoMsg,
                                      placement: 'top-center',
                                  }"
                                  :to="{ name: 'fast-withdraw' }" 
                                  For link below */}
                    <a href="fast" className={styles.linkButton}>
                      Fast Withdraw
                    </a>
                    {/* :to="{ name: 'on-ramp' }" 
                                  For link below */}
                    <a href="ramp" className={styles.linkButton}>
                      On Ramp Transfers
                    </a>
                    <a
                      id="youtube-video-tutorial"
                      className={styles.linkButton}
                      href="YOUTUBE_VIDEO_TUTORIAL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      How it works?
                    </a>
                    <a
                      id="faq-docs"
                      className={styles.linkButton}
                      href="FAQ_DOCS_LINK"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      FAQ
                    </a>
                    <a
                      id="user-guide"
                      className={styles.linkButton}
                      href="USER_GUIDE_DOCS_LINK"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      User guide
                    </a>
                  </div>
                </div>
                <div className={styles.bottomSection}>
                  <img src={bridgeInfoImage} alt="" height="219" width="326" />
                </div>
              </div>
              <div>
                <bridge-component />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
