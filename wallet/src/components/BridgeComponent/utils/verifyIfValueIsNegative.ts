const verifyIfValueIsNegative = (inputAmount: number): boolean => {
  if(inputAmount < 0) {
    return true;
  }
  return false;
}

export default verifyIfValueIsNegative;