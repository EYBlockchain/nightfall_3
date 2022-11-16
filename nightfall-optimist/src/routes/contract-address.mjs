/**
 * Route for depositing (minting) a crypto commitment.
 * This code assumes that the Shield contract already has approval to spend
 * funds on a zkp deposit
 */
import express from 'express';
import { getContractAddress } from '@polygon-nightfall/common-files/utils/contract.mjs';

const router = express.Router();

/**
 * @openapi
 *  /contract-address/{contract}:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Contract Address
 *      summary: Get the contract address.
 *      description: Route that will return the contract address based on the contract name.
 *      parameters:
 *        - in: path
 *          name: contract
 *          schema:
 *            type: string
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessGetContractAddress'
 *        404:
 *          $ref: '#/components/responses/NotFound'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/:contract', async (req, res, next) => {
  const { contract } = req.params;
  try {
    const address = await getContractAddress(contract);

    res.json({ address });
  } catch (err) {
    next(err);
  }
});

export default router;
