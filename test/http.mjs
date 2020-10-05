import chai from 'chai';
// import chaiHttp from 'chai-http';
import supertest from 'supertest';
import config from 'config';
import app from '../src/app.mjs';

const { expect } = chai;
// chai.use(chaiHttp);
const request = supertest(app);
const { types } = config;

describe('Testing the http API', () => {
  let id;

  it('should respond with status 200 to the health check', async () => {
    const res = await request.get('/healthcheck');
    expect(res.status).to.equal(200);
  });

  it('should generate a 256 bit zkp private key for a user', async () => {
    const res = await request.get('/generate-zkp-key');
    expect(res.body.keyId).to.be.a('string');
    id = res.body.keyId; // save the public key as the id for following tests
  });

  it('should deposit some crypto into a ZKP commitment', async () => {
    // the address is for the OpsCoin that's on main-net, just as a dummy value
    const res = await request
      .post('/deposit')
      .send({ ercAddress: '0x409D23C77aAC746Ef5d57B5b44e628Ee4daa0F26', value: 10, id });
    expect(res.body.txToSign).to.be.a('string');
  });

  it.skip('should transfer some crypto using ZKP', async () => {
    const res = await request
      .post('/transfer')
      .send({ type: types.FUNGIBLE, value: 10, id: 1234, recipientId: 3456 });
    expect(res.body.txToSign).to.be.a('string');
  });

  it.skip('should withdraw some crypto from a ZKP commitment', async () => {
    const res = await request
      .post('/withdraw')
      .send({ type: types.FUNGIBLE, value: 10, id: 1234, recipientAddress: '0x1234' });
    expect(res.body.txToSign).to.be.a('string');
  });
});
