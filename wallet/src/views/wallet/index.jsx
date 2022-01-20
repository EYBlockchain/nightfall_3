
import Assets from '../../components/Assets'
import Tokens from '../../components/Tokens'
import styles from '../../styles/wallet.module.scss'

export default function Wallet() {        
    return (
        <div className={styles.wallet}>
            <Assets />
            <Tokens />            
        </div>
    )
}