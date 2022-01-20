import styles from '../../styles/assets.module.scss'

export default function Assets() {
    return (
        <div className={styles.dashboardTopSection}>
            <div className={styles.container}>
                <div className="row">
                    <div className="col-lg-6">
                        <div className={styles.heading}>
                            Nightfall 
                        </div>
                        <div className={styles.amount}>
                            &#36;{ 10 }
                        </div>
                        <div
                            className={styles.buttonsWrapper}
                        >
                            <button
                                className=""
                                icon-name="navbar/qr"
                                onClick={() => {}}
                            >Receive</button>
                            <button                                
                                icon-name="navbar/send"
                                onClick={() => {}}
                            >Send</button>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className={styles.depositWrapper}>
                            <a
                                className={styles.linkButton}
                                href="USER_GUIDE_DOCS_LINK"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                How it works?
                                {/* <svg-sprite-icon
                                    name="right-arrow-white"
                                    className="right-arrow-white"
                                /> */}
                            </a>

                            <button                                                            
                                className={styles.linkButton}
                                onClick={()=>{}}
                            >
                                Move funds from 
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* <receive-qr-code
            v-if="showReceiveModal"
            :uri="account.address"
            :close="toggleReceiveTokenModal"
            />
            <send-token-modal v-if="showSendModal" :cancel="toggleSendTokenModal" /> */}
        </div>)
}