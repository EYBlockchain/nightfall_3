import chai from 'chai';
import chaiHttp from 'chai-http';
import Web3 from 'web3';

const { expect } = chai;
chai.use(chaiHttp);

describe('Testing the http API', () => {
  let web3;
  let id;
  let shieldAddress;
  let txToSign;
  let ercAddress;
  const url = 'http://localhost:8080';
  const tokenId = '0x01';
  const value = 10;
  // this is the private key for the test account in openethereum
  const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const gas = 10000000;

  it('should respond with status 200 to the health check', async () => {
    const res = await chai.request(url).get('/healthcheck');
    expect(res.status).to.equal(200);
  });

  it('should generate a 256 bit zkp private key for a user', async () => {
    const res = await chai.request(url).get('/generate-zkp-key');
    expect(res.body.keyId).to.be.a('string');
    id = res.body.keyId; // save the public key as the id for following tests
  });

  it('should get the address of the shield contract', async () => {
    const res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;
    expect(shieldAddress).to.be.a('string');
  });

  it('should get the address of the test ERC contract stub', async () => {
    const res = await chai.request(url).get('/contract-address/ERCStub');
    ercAddress = res.body.address;
    expect(ercAddress).to.be.a('string');
  });

  it('should deposit some crypto into a ZKP commitment', async () => {
    const res = await chai
      .request(url)
      .post('/deposit')
      .send({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey: id,
      });
    txToSign = res.body.txToSign;
    expect(txToSign).to.be.a('string');
    // console.log(txToSign);
  });

  it('should should send the commitment proof to the shield contract to verify the proof and store the commitment in the Merkle tree', async () => {
    // now we need to sign the transaction and send it to the blockchain
    const tx = {
      to: shieldAddress,
      data: txToSign,
      gas,
    };
    try {
      web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
      const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      // console.log('receipt', receipt);
    } catch (err) {
      expect.fail(err);
    } finally {
      web3.currentProvider.connection.close();
    }
  });

  it('should transfer some crypto using ZKP', async () => {
    const res = await chai
      .request(url)
      .post('/transfer')
      .send({
        ercAddress,
        tokenId,
        value,
        senderZkpPublicKey: id,
        recipientZkpPublicKey: id,
      });
    // TODO
    console.log(res.body);
    expect(res.statusCode).to.equal(200);
  });

  it.skip('should withdraw some crypto from a ZKP commitment', async () => {
    chai
      .request(url)
      .post('/withdraw')
      .send({
        ercAddress,
        tokenId,
        value,
        senderZkpPublicKey: id,
        recipientAddress: id,
      })
      .end((err, res) => {
        // TODO
        expect(res.body.txToSign).to.be.a('string');
      });
  });
});
