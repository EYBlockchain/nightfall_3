import Web3 from "web3"

declare var window: any

const loadWeb3 = async () => {
  if (window.web3) {
      window.web3 = new Web3(window.ethereum)
      // await window.ethereum.enable()
      await window.ethereum.request({ method: 'eth_requestAccounts' })
  } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider)
  } else {
      window.alert(
          'Non-Ethereum browser detected. You should consider trying MetaMask!'
      )
  }
}

export default loadWeb3