import axios from 'axios';

const BASE_URL = 'https://api.coingecko.com/api/v3/simple';

const getPrice = async (coinID: string, currency: string = 'usd'): Promise<any> => {
  const res: Record<string, Record<string, number>> = (
    await axios.get(`${BASE_URL}/price?ids=${coinID}&vs_currencies=${currency}`)
  ).data;
  console.log('rest', res);
  return res[coinID][currency];
};

export default getPrice;
