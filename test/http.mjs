import chai from 'chai';
import chaiHttp from 'chai-http';
// import config from 'config';

const { expect } = chai;
chai.use(chaiHttp);

describe('Testing the http API', () => {
  let id;
  // the address is for the OpsCoin contract that's on main-net: just as a dummy value.
  const ercAddress = '0x409D23C77aAC746Ef5d57B5b44e628Ee4daa0F26';
  const url = 'http://localhost:8080';
  const tokenId = '0x01';

  it('should respond with status 200 to the health check', done => {
    chai
      .request(url)
      .get('/healthcheck')
      .end((err, res) => {
        expect(res.status).to.equal(200);
        done();
      });
  });

  it('should generate a 256 bit zkp private key for a user', done => {
    chai
      .request(url)
      .get('/generate-zkp-key')
      .end((err, res) => {
        expect(res.body.keyId).to.be.a('string');
        id = res.body.keyId; // save the public key as the id for following tests
        done();
      });
  });

  it('should deposit some crypto into a ZKP commitment', done => {
    chai
      .request(url)
      .post('/deposit')
      .send({
        ercAddress,
        tokenId: 0x01,
        value: 10,
        zkpPublicKey: id,
      })
      .end((err, res) => {
        expect(res.body.txToSign).to.be.a('string');
        console.log(res.body);
        done();
      });
  });

  it.skip('should transfer some crypto using ZKP', async () => {
    chai
      .request(url)
      .post('/transfer')
      .send({
        ercAddress,
        tokenId,
        value,
        senderZkpPublicKey,
        recipientZkpPublicKey
      })
      .end((err, res) => {
        // TODO
        expect(res.body.txToSign).to.be.a('string');
      });
  });

  it.skip('should withdraw some crypto from a ZKP commitment', async () => {
    chai
      .request(url)
      .post('/withdraw')
      .send({
        ercAddress,
        tokenId,
        value,
        senderZkpPublicKey,
        recipientAddress
      })
      .end((err, res) => {
        // TODO
        expect(res.body.txToSign).to.be.a('string');
      });
  });
});
