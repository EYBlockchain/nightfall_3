import config from 'config';
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

export default function auth(req, res, next) {
  const token = req.headers['x-app-token'];
  if (token === environment.AUTH_TOKEN) return next();
  return res.status(401).send('Unauthorized');
}
