import config from 'config';
import crypto from 'crypto';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

export default function auth(req, res, next) {
  const token = req.headers['x-app-token'];
  if (token === crypto.createHash('sha256').update(environment.PROPOSER_KEY).digest('hex'))
    return next();
  return res.status(401).send('Unauthorized');
}
