/**
  function to retrieve balance of user
*/
export const retrieveL2Balance = async client => {
  const balances = await client.getLayer2Balances();
  // if there are no balances
  if (Object.values(balances).length === 0) {
    return 0;
  }
  const { balance } = Object.values(balances)[0][0];
  return balance;
};

/**
  function to wait until sufficient balance is achieved from
  transactions
*/
export const waitForSufficientBalance = (client, value) => {
  return new Promise(resolve => {
    async function isSufficientBalance() {
      const balance = await retrieveL2Balance(client);
      console.log('Balance', balance, value);
      if (balance < value) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        isSufficientBalance();
      } else resolve();
    }
    isSufficientBalance();
  });
};
