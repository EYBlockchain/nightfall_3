import express from 'express';
import checkCircuitHash from '../services/checkCircuitHash.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
    req.setTimeout(3600000); // 1 hour
    try {
        res.send(await checkCircuitHash(req.body));
    } catch (err) {
        next(err);
    }
});

export default router;
