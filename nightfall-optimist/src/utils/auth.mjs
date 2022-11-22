export default function auth(req, res, next) {
  const token = req.headers['X-APP-TOKEN'];
  if (token === process.env.PROPOSER_KEY) return next();
  return res.status(401).send('Unauthorized');
}
