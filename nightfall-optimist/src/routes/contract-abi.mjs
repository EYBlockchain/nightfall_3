/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import {
  getContractAbi,
  clearCachedContracts,
} from '@polygon-nightfall/common-files/utils/contract.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  /contract-abi/{contract}:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Contract ABI
 *      summary: Get the contract ABI.
 *      description: Route that will return the contract ABI based on the contract name.
 *      parameters:
 *        - in: path
 *          name: contract
 *          schema:
 *            type: string
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessGetContractAbi'
 *        404:
 *          $ref: '#/components/responses/NotFound'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/:contract', async (req, res, next) => {
  const { contract } = req.params;
  try {
    const abi = await getContractAbi(contract);
    if (abi) {
      res.json({ abi });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /contract-abi/clear:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Contract ABI
 *      summary: Clear cached contracts.
 *      description: Route that will clear the cached contracts.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/Success'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        400:
 *          $ref: '#/components/responses/BadRequest'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/clear', auth, async (req, res, next) => {
  try {
    await clearCachedContracts();
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

export default router;
