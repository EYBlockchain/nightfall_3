/**
  function to wait until sufficient balance is achieved from
  transactions
*/
const waitForSufficientBalance = (client, value) => {
  return new Promise(resolve => {
    async function isSufficientBalance() {
      const balances = await client.getLayer2Balances();
      // if layer 2 balances don't exist, then wait a bit and look for balances again
      if (Object.keys(balances).length === 0) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        isSufficientBalance();
      }
      // if client does not have layer 2 balances, then wait a bit and look again
      const clientBalances = balances[client.zkpKeys.compressedPkd];
      if (clientBalances === undefined || Object.keys(clientBalances).length === 0) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        isSufficientBalance();
      }
      const balance = clientBalances[Object.keys(clientBalances)[0]];
      // if client has layer 2 balances and if it is equal to value required
      if (balance > value) {
        // console.log('sufficient balance');
        resolve();
      } else {
        // console.log('insufficient balance', balance);
        await new Promise(resolving => setTimeout(resolving, 10000));
        isSufficientBalance();
      }
    }
    isSufficientBalance();
  });
};

export default waitForSufficientBalance;
