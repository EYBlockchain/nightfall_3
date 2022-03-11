const verifyIfValueIsGreaterThen = (inputAmount: number, accountBalance: number): boolean => {
  if(inputAmount > accountBalance) {
    return true;
  }
  return false;
}

export default verifyIfValueIsGreaterThen;