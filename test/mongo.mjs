import chai from 'chai';
// import chaiHttp from 'chai-http';
import config from 'config';
import mongo from '../src/utils/mongo.mjs';

const { expect } = chai;
// chai.use(chaiHttp);
const { MONGO_URL, COMMITMENTS_DB } = config;

describe('Testing the mongodb instance', () => {
  let db;
  it('should connect to the mongo database and get database object', async () => {
    db = await mongo.connect(MONGO_URL, COMMITMENTS_DB);
    expect((await db.stats()).db).to.equal(COMMITMENTS_DB);
  });
  it('should get or create a collection and insert data', async () => {
    const collection = await db.collection('commitments');
    const data = { name: 'westlad' };
    let resp = await collection.insertOne(data);
    expect(resp.result.ok).to.equal(1);
    resp = await collection.findOne(data);
    expect(resp.name).to.equal(data.name);
  });
  after(() => mongo.disconnect());
});
