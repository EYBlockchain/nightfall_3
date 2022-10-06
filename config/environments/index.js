const docker = require('./docker');
const aws = require('./aws');
const localhost = require('./localhost');
const polygonEdge = require('./polygonEdge');

module.exports = { polygonEdge, localhost, aws, docker };
