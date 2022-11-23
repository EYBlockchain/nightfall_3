export default function auth(req, res, next) {
  const token = req.headers['X-APP-TOKEN'];
  if (token === process.env.AUTH_TOKEN) return next();
  return res.status(401).send('Unauthorized');
}
