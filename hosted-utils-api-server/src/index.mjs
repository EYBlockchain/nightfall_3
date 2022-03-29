import express from 'express';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
app.use(express.static('public')); // serves proving key

app.listen(80);
