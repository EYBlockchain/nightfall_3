/* eslint-disable cypress/no-unnecessary-waiting */

/*
 * This is the e2e test for nightfall browser
 * Note: to run it locally, follow below steps
 *  1. start all the containers from scratch.
 *  2. start wallet/nightfall_browser app (follow readme.md)
 *  3. In different terminal in wallet/ dir, run `npm run e2e-test`
 */

// Note: for now test will work with env variable RECIPIENT_PKD undefined

// for the case txPerBlock < noOfTx
function toAccommodateTx(txPerBlock, noOfTx) {
  let i = 2;
  if (txPerBlock > noOfTx) return txPerBlock;
  while (txPerBlock * i < noOfTx) i++;
  return txPerBlock * i;
}

Cypress.LocalStorage.clear = function () {};

describe('End to End tests', () => {
  let currentTokenBalance = 0;
  const depositValue = 4;

  // currently e2e browser test need to know transaction per block configuration
  // because wallet websocket receive block proposed event silently
  // and update the IndexDB
  // check for balance and keep doing one transaction(for example deposit) to satisfy
  // tx count per block will be impractical.
  // reason is, it through blance change we doing assertion of logic
  const txPerBlock = Number(Cypress.env('TRANSACTIONS_PER_BLOCK') || 2);
  let txCount = 0;

  beforeEach(() => {
    cy.on('window:before:load', win => {
      cy.spy(win.console, 'log');
      cy.spy(win.console, 'error');
      cy.spy(win.console, 'warn');
    });
  });

  context('MetaMask', () => {
    it('acceptMetamaskAccess should accept connection request to metamask', () => {
      cy.visit('/');
      cy.acceptMetamaskAccess().then(connected => expect(connected).to.be.true);
    });

    it('generate Mnemonic and set state', () => {
      cy.contains('Polygon Nightfall Wallet').click();
      cy.get('button').contains('Generate Mnemonic', { timeout: 10000 }).click();
      cy.get('button').contains('Create Wallet', { timeout: 10000 }).click();
      cy.confirmMetamaskSignatureRequest().then(confirmed => expect(confirmed).to.be.true);
      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.url().should('include', '/bridge');
      cy.wait(10000);
      cy.contains('Nightfall Assets', { timeout: 10000 }).click();
      cy.url().should('include', '/wallet');

      // once state get set for mnemonic visiting wallet page again
      // will not open Generate Mnemonic modal, hence the below assertion
      cy.get('button').contains('Generate Mnemonic').should('not.exist');
      cy.get('#TokenItem_tokenDepositMATIC', { timeout: 10000 }).should('be.visible');
    });
  });

  context('Deposit', () => {
    /*
     * four depsoits, i.e four commitments for value 4
     * 1st commitment will use withdraw
     * 2nd for single transfer
     * 3rd and 4th for double trransfer
     */

    let noOfDeposit = 4;
    // for now in nightfall browser deposit balance reflect only after receiving block proposed event
    noOfDeposit = txPerBlock > noOfDeposit ? txPerBlock : toAccommodateTx(txPerBlock, noOfDeposit);
    it(`do ${noOfDeposit} deposit of value ${depositValue}`, () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();
      // for now in browser if once we typed deposit value in text box
      // we can do muptiple deposit one after another
      // without need to re-type
      // that is the reason below code is not the part of for loop
      cy.get('#Bridge_amountDetails_tokenAmount').type(depositValue);

      for (let i = 0; i < noOfDeposit; i++) {
        cy.get('button').contains('Transfer').click();
        cy.get('button').contains('Create Transaction').click();
        cy.get('#Bridge_modal_continueTransferButton').click();
        cy.wait(30000);
        if (i === 0) {
          // for first depsoit we need approve ERC20
          cy.confirmMetamaskPermissionToSpend().then(approved => expect(approved).to.be.true);
          cy.wait(30000);
        }
        cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
        cy.wait(50000);
      }
      cy.contains('Nightfall Assets').click();
      cy.wait(20000);
    });

    it(`check token balance equal to ${depositValue * noOfDeposit}`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(depositValue * noOfDeposit);
        currentTokenBalance = totalBalance;
        txCount += noOfDeposit;
      });
    });
  });

  context('Withdraw', () => {
    const withdrawValue = 4;

    it(`withdraw token of value ${withdrawValue}`, () => {
      cy.get('#TokenItem_tokenWithdrawMATIC').click();
      cy.get('label').contains('Withdraw').click();
      cy.get('#Bridge_amountDetails_tokenAmount').type(withdrawValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance after withdraw`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - withdrawValue);
        currentTokenBalance = totalBalance;
        txCount += 1;
      });
    });
  });

  context('Single Transfer', () => {
    const transferValue = 4;

    /*
     * dummy recipientPublicKey of user who does not exist
     * Note: even though we are passing recipientPkd, but in code
     *   it gets override by sender's pdk for now
     *   hence two check
     */
    const recipientZkpPublicKey = Cypress.env('RECIPIENT_PKD') || ' ';

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedZkpPublicKey').clear().type(recipientZkpPublicKey);
      cy.get('button').contains('Continue').click();
      cy.contains('L2 Bridge', { timeout: 10000 }).click();
      cy.wait(10000);
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance after transfer`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - transferValue);
        currentTokenBalance = totalBalance;
        txCount += 1;
      });
    });

    // This case because recipient and sender both are same
    // NOTE: when browser fixes its recipent logic to be different person then please remove below test
    it(`recepient: check token balance`, () => {
      cy.wait(50000);
      cy.contains('L2 Bridge').click();
      cy.wait(10000);
      cy.contains('Nightfall Assets').click();
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance + transferValue);
        currentTokenBalance = totalBalance;
      });
    });
  });

  context('Double Transfer', () => {
    const transferValue = 6;

    // hardcode 2 here is because it is double transfer
    // case is: it always will pick two sutiable commitments
    const commitmentValues = depositValue * 2;
    const returnValue = commitmentValues - transferValue;

    /*
     * dummy recipientPublicKey of user who does not exist
     * Note: even though we are passing recipientPkd, but in code
     *   it gets override by sender's pdk for now
     *   hence two check
     */
    const recipientZkpPublicKey = Cypress.env('RECIPIENT_PKD') || ' ';

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedZkpPublicKey').clear().type(recipientZkpPublicKey);
      cy.get('button').contains('Continue').click();
      cy.wait(50000);
      cy.contains('L2 Bridge').click();
      cy.wait(10000);
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance after double transfer`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - commitmentValues);
        currentTokenBalance = totalBalance;
        txCount += 1;
      });
    });

    let noOfDeposit = 0;
    it(`do some deposit of value ${depositValue} to satisfy ${txPerBlock} tx per block`, () => {
      noOfDeposit = txCount > txPerBlock ? txCount % txPerBlock : txPerBlock - txCount;
      if (!noOfDeposit) {
        cy.log('Skipping this block');
        return;
      }

      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.get('#Bridge_amountDetails_tokenAmount').type(depositValue);

      for (let i = 0; i < noOfDeposit; i++) {
        cy.get('button').contains('Transfer').click();
        cy.get('button').contains('Create Transaction').click();
        cy.get('#Bridge_modal_continueTransferButton').click();
        cy.wait(30000);
        cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
        cy.wait(50000);
      }
      cy.contains('Nightfall Assets').click();
    });

    // in case because recipient and sender both are same
    // avoid transferValue from assertion
    it(`check token balance after change return`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(
          currentTokenBalance + depositValue * noOfDeposit + transferValue + returnValue,
        );
        currentTokenBalance = totalBalance;
        txCount += noOfDeposit;
      });
    });
  });
});
