import Web3 from 'web3';
import sinon from 'sinon';
import assert from 'assert';
import { estimateGas, TX_GAS_DEFAULT, TX_GAS_MULTIPLIER } from '../utils/ethereum/gas.mjs';

describe('Estimate gas', () => {
  const web3 = new Web3();
  const tx = {
    from: '0xfrom9bF4A217A57A84dfbbA633E008F05378D47d',
    to: '0xto508a9e024CaCa25f139C6490c0dea49eF37795',
    value: '10',
    data: '0xdcc7bceb000000000000000..00499d11e0b6eac',
  };

  let stubWeb3EstimateGas;
  before(function () {
    stubWeb3EstimateGas = sinon.stub(web3.eth, 'estimateGas');
  });

  after(function () {
    stubWeb3EstimateGas.restore();
  });

  it('Should return default * multiplier if web3 call fails', async () => {
    stubWeb3EstimateGas.throws();

    const gas = await estimateGas(tx, web3);

    assert.throws(stubWeb3EstimateGas);
    assert.equal(gas, Math.ceil(TX_GAS_DEFAULT * TX_GAS_MULTIPLIER));
  });

  it('Should return gas * multiplier', async () => {
    const TEST_GAS = 100467;
    stubWeb3EstimateGas.resolves(TEST_GAS);

    const gas = await estimateGas(tx, web3);

    stubWeb3EstimateGas.calledOnceWithExactly(tx);
    assert.equal(gas, Math.ceil(TEST_GAS * TX_GAS_MULTIPLIER));
  });
});
