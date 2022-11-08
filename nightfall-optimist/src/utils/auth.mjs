export default function auth(req, res, next) {
  const token = req.headers['x-app-token'];
  if (token === process.env.AUTH_TOKEN) return next();
  return res.status(401).send('Unauthorized');
}
