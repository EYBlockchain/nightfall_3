/* ignore unused exports */
import * as Nf3 from 'nf3';
import {
  ERROR_AUTO_HIDE_PERIOD,
} from '../../constants';
import * as txActions from './transactions.actions';
import * as messageActions from '../message/message.actions';

function txInstantWithdrawSubmit(withdrawTransactionHash, fee) {
  return async (dispatch, getState) => {
    const {
      login: { nf3 },
    } = getState();
    nf3
      .requestInstantWithdrawal(withdrawTransactionHash, fee)
      .then(txReceipt => {
        if (txReceipt === null) {
          throw new Error('Non existent hash');
        }
        // TODO dispatch error
        dispatch(txActions.txSuccess(Nf3.Constants.TX_TYPES.INSTANT_WITHDRAW, txReceipt));
        dispatch(messageActions.newInfo('Instant Withdrawal submitted'));
        setTimeout(() => {
          dispatch(messageActions.clearMsg());
        }, ERROR_AUTO_HIDE_PERIOD);
      })
      .catch(err => {
        dispatch(txActions.txFailed());
        // TODO dispatch error
        console.log(err);
      });
  };
}

function txSubmit(txParams) {
  const tokenAmountWei = Nf3.Units.toBaseUnit(
    txParams.tokenAmount,
    txParams.tokenDecimals,
  ).toString();
  // TODO: offchain needs to be a value from form
  const offchain = false;

  return async (dispatch, getState) => {
    const {
      login: { nf3 },
    } = getState();

    dispatch(txActions.txDispatch());
    switch (txParams.txType) {
      case Nf3.Constants.TX_TYPES.DEPOSIT:
        // TODO: dispatch error
        nf3
          .deposit(
            txParams.tokenAddress,
            txParams.tokenType,
            tokenAmountWei,
            txParams.tokenId,
            txParams.fee,
          )
          .then(txReceipt => {
            dispatch(txActions.txSuccess(Nf3.Constants.TX_TYPES.DEPOSIT, txReceipt));
            dispatch(messageActions.newInfo('Deposit submitted'));
            setTimeout(() => {
              dispatch(messageActions.clearMsg());
            }, ERROR_AUTO_HIDE_PERIOD);
            // TODO: dispatch error
            console.log(txReceipt);
          })
          .catch(err => {
            dispatch(txActions.txFailed());
            dispatch(messageActions.newError('Deposit Failed'));
            setTimeout(() => {
              dispatch(messageActions.clearMsg());
            }, ERROR_AUTO_HIDE_PERIOD);
            // TODO: dispatch error
            console.log(err);
          });
        break;

      case Nf3.Constants.TX_TYPES.TRANSFER:
        // TODO: dispatch error
        nf3
          .transfer(
            offchain,
            txParams.tokenAddress,
            txParams.tokenType,
            tokenAmountWei,
            txParams.tokenId,
            txParams.compressedPkd,
            txParams.fee,
          )
          .then(txReceipt => {
            dispatch(txActions.txSuccess(Nf3.Constants.TX_TYPES.TRANSFER, txReceipt));
            dispatch(messageActions.newInfo('Transfer submitted'));
            setTimeout(() => {
              dispatch(messageActions.clearMsg());
            }, ERROR_AUTO_HIDE_PERIOD);
            // TODO: dispatch error
            console.log(txReceipt);
          })
          .catch(err => {
            dispatch(txActions.txFailed());
            dispatch(messageActions.newError('Transfer Failed'));
            setTimeout(() => {
              dispatch(messageActions.clearMsg());
            }, ERROR_AUTO_HIDE_PERIOD);
            // TODO: dispatch error
            console.log(err);
            console.log('SFSDFSDFD');
          });
        break;

      case Nf3.Constants.TX_TYPES.WITHDRAW:
      case Nf3.Constants.TX_TYPES.INSTANT_WITHDRAW:
        {
          // TODO: dispatch error
          const nRetries = 0;
          nf3
            .withdraw(
              offchain,
              txParams.tokenAddress,
              txParams.tokenType,
              tokenAmountWei,
              txParams.tokenId,
              txParams.ethereumAddress,
              txParams.fee,
            )
            .then(txReceipt => {
              const latestWithdrawTransactionHash = nf3.getLatestWithdrawHash();
              dispatch(
                txActions.txSuccess(
                  Nf3.Constants.TX_TYPES.WITHDRAW,
                  txReceipt,
                  latestWithdrawTransactionHash,
                  nRetries,
                ),
              );
              dispatch(messageActions.newInfo('Withdrawal submitted'));
              setTimeout(() => {
                dispatch(messageActions.clearMsg());
              }, ERROR_AUTO_HIDE_PERIOD);
              // TODO: dispatch error
              console.log(txReceipt);
<<<<<<< HEAD
=======

              if (txParams.txType === Nf3.Constants.TX_TYPES.INSTANT_WITHDRAW) {
                dispatch(
                  txInstantWithdrawSubmit(
                    latestWithdrawTransactionHash,
                    txParams.instantWithdrawFee,
                  ),
                );
              }
            })
            .catch(err => {
              dispatch(txActions.txFailed());
              dispatch(messageActions.newError('Withdraw Failed'));
              setTimeout(() => {
                dispatch(messageActions.clearMsg());
              }, ERROR_AUTO_HIDE_PERIOD);
              // TODO: dispatch error
              console.log(err);
>>>>>>> master
            });
        }
        break;

      default:
        throw new Error('Unknown transaction', txParams.txType);
    }
  };
}

function txWithdrawUpdate() {
  return async (dispatch, getState) => {
    const {
      login: { nf3 },
      token: { tokenPool },
    } = getState();
    const filteredPendingWithdrals = [];
    const pendingWithdraws = await nf3.getPendingWithdraws();
    if (Object.keys(pendingWithdraws).includes(nf3.zkpKeys.compressedPkd)) {
      for (const ercContractWithdrawal of Object.keys(
        pendingWithdraws[nf3.zkpKeys.compressedPkd],
      )) {
        filteredPendingWithdrals.push(
          ...pendingWithdraws[nf3.zkpKeys.compressedPkd][ercContractWithdrawal],
        );
      }
    }

    const updatedWithdrawalInfo = await Promise.all(
      filteredPendingWithdrals.map(el => {
        const tokenInfo = tokenPool.find(poolEl => poolEl.tokenAddress === el.ercAddress);
        if (!tokenInfo) {
          return Nf3.Tokens.getERCInfo(el.ercAddress, nf3.ethereumAddress, nf3.web3, {
            toEth: true,
            tokenId: 0,
            details: true,
          }).then(info => {
            return {
              ...el,
              decimals: info.decimals,
              balanceEth: Nf3.Units.fromBaseUnit(el.balance.toString(), info.decimals),
              tokenType: info.tokenType,
              tokenName: '',
            };
          });
        }
        return {
          ...el,
          decimals: tokenInfo.decimals,
          balanceEth: Nf3.Units.fromBaseUnit(el.balance.toString(), tokenInfo.tokenDecimals),
          tokenType: tokenInfo.tokenType,
          tokenName: tokenInfo.tokenName,
        };
      }),
    );
    dispatch(txActions.txWithdrawUpdate(updatedWithdrawalInfo));
  };
}

export { txSubmit, txInstantWithdrawSubmit, txWithdrawUpdate };
