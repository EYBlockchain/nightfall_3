/**
  function to retrieve balance of user because getLayer2Balances returns
  balances of all users
*/
export const retrieveL2Balance = async client => {
  const balances = await client.getLayer2Balances();
  // if there are no balances
  if (Object.keys(balances).length === 0) {
    return 0;
  }
  const clientBalances = balances[client.zkpKeys.compressedPkd];
  // if this user has no balance
  if (clientBalances === undefined || Object.keys(clientBalances).length === 0) {
    return 0;
  }
  // TODO return address by contract address
  const balance = clientBalances[Object.keys(clientBalances)[0]];
  return balance;
};

/**
  function to wait until sufficient balance is achieved from
  transactions
*/
export const waitForSufficientBalance = (client, value) => {
  return new Promise(resolve => {
    async function isSufficientBalance() {
      const balances = await client.getLayer2Balances();
      console.log('Balance', balances, value);
      if (
        Object.keys(balances).length === 0 ||
        balances[client.zkpKeys.compressedPkd] === undefined ||
        Object.keys(balances[client.zkpKeys.compressedPkd]).length === 0 ||
        balances[client.zkpKeys.compressedPkd][
          Object.keys(balances[client.zkpKeys.compressedPkd])[0]
        ] === undefined ||
        balances[client.zkpKeys.compressedPkd][
          Object.keys(balances[client.zkpKeys.compressedPkd])[0]
        ] < value
      ) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        isSufficientBalance();
      } else resolve();
    }
    isSufficientBalance();
  });
};
