/* eslint no-shadow: "off" */
/* eslint import/no-extraneous-dependencies: "off" */
/* eslint camelcase: "off" */
/* eslint object-shorthand: "off" */

import chai from 'chai';
import chaiHttp from 'chai-http';
import axios from 'axios';
import express from 'express';
import { setupHttpDefaults } from '../utils/httputils.mjs';
import NotFoundError from '../utils/not-found-error.mjs';
import ValidationError from '../utils/validation-error.mjs';

chai.use(chaiHttp);
chai.should();

describe('HTTP Utils tests', function () {
  const app_0 = express();
  const APP_0_PORT = 8000;

  const app_1 = express();
  const APP_1_PORT = 8001;

  let correlationIdReceivedApp1;

  this.beforeAll(function () {
    // app#0
    const routerApp0 = express.Router();

    routerApp0.get('/test/:id', async (req, res, next) => {
      const id = parseInt(req.params.id, 10);
      try {
        if (Number.isNaN(id)) {
          throw new ValidationError("ID can't be lower than 1");
        }

        if (id < 1) {
          throw new NotFoundError();
        }

        if (id === 999) {
          throw new Error();
        }

        // calls app#1 endpoint
        await axios.get(`http://localhost:${APP_1_PORT}/test`);

        res.json({ id: id });
      } catch (err) {
        next(err);
      }
    });

    setupHttpDefaults(app_0, app_0 => {
      app_0.use(routerApp0);
    });

    app_0.listen(APP_0_PORT);

    // app#1
    const routerApp1 = express.Router();

    routerApp1.get('/test', async (req, res) => {
      correlationIdReceivedApp1 = req.header('X-Correlation-Id');
      res.sendStatus(200);
    });

    setupHttpDefaults(
      app_1,
      app_1 => {
        app_1.use(routerApp1);
      },
      false,
      false,
    );

    app_1.listen(APP_1_PORT);
  });

  it('Should create the healthcheck endpoint for app#0', function (done) {
    chai
      .request(app_0)
      .get('/healthcheck')
      .end((err, res) => {
        res.should.have.status(200);
        done();
      });
  });

  it('Should not create the healthcheck endpoint for app#1', function (done) {
    chai
      .request(app_1)
      .get('/healthcheck')
      .end((err, res) => {
        res.should.have.status(404);
        done();
      });
  });

  it('Should reply with CORS header', function (done) {
    chai
      .request(app_0)
      .get('/healthcheck')
      .end((err, res) => {
        res.should.have.header('Access-Control-Allow-Origin');
        done();
      });
  });

  it('Shouldn`t reply with header `x-powered-by`', function (done) {
    chai
      .request(app_0)
      .get('/healthcheck')
      .end((err, res) => {
        res.should.not.have.header('x-powered-by');
        done();
      });
  });

  it('Should create routes accordingly', function (done) {
    chai
      .request(app_0)
      .get('/test/111')
      .end((err, res) => {
        res.should.have.status(200);
        done();
      });
  });

  it('Should reply with the correlationId header', function (done) {
    chai
      .request(app_0)
      .get('/test/111')
      .end((err, res) => {
        res.should.have.header('X-Correlation-Id');
        done();
      });
  });

  it('Should receive HTTP status 400', function (done) {
    chai
      .request(app_0)
      .get('/test/aaa')
      .end((err, res) => {
        res.should.have.status(400);
        done();
      });
  });

  it('Should receive HTTP status 404', function (done) {
    chai
      .request(app_0)
      .get('/test/0')
      .end((err, res) => {
        res.should.have.status(404);
        done();
      });
  });

  it('Should receive HTTP status 500', function (done) {
    chai
      .request(app_0)
      .get('/test/999')
      .end((err, res) => {
        res.should.have.status(500);
        done();
      });
  });

  it('Should pass the `correlationId` header from `app#0` to `app#1` for any HTTP request perfomed', function (done) {
    chai
      .request(app_0)
      .get('/test/111')
      .end((err, res) => {
        res.should.have.header('X-Correlation-Id', correlationIdReceivedApp1);
        done();
      });
  });
});
