/* eslint-disable no-undef */
/* ignore unused exports */
router.get('/reset-localblock', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    await Block.rollback();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

router.post('/gen-block', async (req, res, next) => {
  logger.debug('gen-block endpoint received POST');
  try {
    const { blockType } = req.body;
    await addBlock(blockType);
    await addTx(blockType);
    res.json({ status: 'OK' });
  } catch (err) {
    next(err);
  }
});

router.post('/stop-queue', async (req, res, next) => {
  logger.debug('stop-queue endpoint received POST');
  try {
    const { nonStopFlag } = req.body;
    setNonStopFlag(nonStopFlag);
    res.json({ status: 'OK' });
  } catch (err) {
    next(err);
  }
});

export default router;
