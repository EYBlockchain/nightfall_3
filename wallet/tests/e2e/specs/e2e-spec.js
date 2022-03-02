/* eslint-disable cypress/no-unnecessary-waiting */

/*
 * This is the e2e test for nightfall browser
 * Note: to run it locally, follow below steps
 *  1. start all the containers from scratch.
 *  2. start wallet/nightfall_browser app (follow readme.md)
 *  3. In different terminal in wallet/ dir, run `npm run e2e-test`
 */

 // Note: for now test will work with env variable RECIPIENT_PKD undefined

describe('End to End tests', () => {
  let currentTokenBalance = 0;
  const depositValue = 4;

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
      cy.get('button').contains('Generate Mnemonic').click();
      cy.get('button').contains('Create Wallet').click();
      cy.confirmMetamaskSignatureRequest().then(confirmed => expect(confirmed).to.be.true);
      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.url().should('include', '/bridge');
      cy.contains('Nightfall Assets').click();
      cy.url().should('include', '/wallet');

      // once state get set for mnemonic visiting wallet page again
      // will not open Generate Mnemonic modal, hence the below assertion
      cy.get('button').contains('Generate Mnemonic').should('not.exist');
    });
  });

  context('Deposit', () => {
    /*
     * four depsoits, i.e four commitments for value 4
     * 1st commitment will use withdraw
     * 2nd for single transfer
     * 3rd and 4th for double trransfer
     */
    const noOfDeposit = 4;
    it(`do ${noOfDeposit} deposit of value ${depositValue}`, () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();

      // for now in browser if once typed deposit value in text box
      // we can do muptiple deposit on after another
      // without need to re-type
      // that is the reason below code is the part of for loop
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
        cy.get('.btn-close').click();
      }
      cy.contains('Nightfall Assets').click();
      cy.wait(20000);
    });

    it(`check token balance equal to ${depositValue * noOfDeposit}`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(depositValue * noOfDeposit);
        currentTokenBalance = totalBalance;
      });
    });
  });

  context('Withdraw', () => {
    const withdrawValue = 4;

    it(`withdraw token of value ${withdrawValue}`, () => {
      cy.get('#TokenItem_tokenWithdrawMATIC').click();
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(withdrawValue);
      cy.get('label').contains('Withdraw').click();
      cy.get('#Bridge_amountDetails_tokenAmount').type(withdrawValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance after withdraw`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - withdrawValue);
        currentTokenBalance = totalBalance;
      });
    });
  });

  context('Single Transfer', () => {
    const transferValue = 4;

    /*
     * dummy pkd of user who does not exist
     * Note: even though we are passing recipientPkd but in code
     *   it gets override by sender's pdk for now
     *   hence two check
     *   check1: before Block Proposed event
     *   check2: after Block Proposed event
     */
    const recipientPkd = process.env.RECIPIENT_PKD;

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedPkd').clear().type(recipientPkd);
      cy.get('button').contains('Continue').click();
      cy.wait(50000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close').click();
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
    });

    // check1
    it(`check token balance after transfer`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - transferValue);
        currentTokenBalance = totalBalance;
      });
    });

    // check2
    // This case because recipient and sender both are same
    // logged in user
    // NOTE: when browser fixes it recipent logic to be different
    // person, please skip below test
    it(`recepient: check token balance`, () => {
      cy.wait(50000);
      cy.contains('L2 Bridge').click();
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
    const retries = 3;
    let retriesCount = 0;

    // hardcode 2 here is because it is double transfer
    // case is it always will pick sutiable commitments
    const commitmentValues = depositValue * 2;
    const returnValue = commitmentValues - transferValue;

    /*
     * dummy pkd of user who does not exist
     * Note: even though we are passing recipientPkd but in code
     *   it gets override by sender's pdk for now
     *   hence two check
     *   check1: before Block Proposed event
     *   check2: after Block Proposed event
     */
    const recipientPkd = process.env.RECIPIENT_PKD;

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedPkd').clear().type(recipientPkd);
      cy.get('button').contains('Continue').click();
      cy.wait(50000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close').click();
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance after double transfer`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - commitmentValues);
        currentTokenBalance = totalBalance;
      });
    });

    const waitForBlockProposedEvent = async () => {
      retriesCount++;
      cy.wait(10000);
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
      cy.log(await cy.get('#TokenItem_tokenBalanceMATIC'));
      if (retriesCount !== retries)
        waitForBlockProposedEvent();
    }

    it('check', async () => {
      waitForBlockProposedEvent();
    });

    // it(`initiate deposit of value ${depositValue} to satisfy 2 tx per block`, () => {
    //   cy.get('#TokenItem_tokenDepositMATIC').click();
    //   // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
    //   cy.get('#Bridge_amountDetails_tokenAmount').type(depositValue);
    //   cy.get('button').contains('Transfer').click();
    //   cy.get('button').contains('Create Transaction').click();
    //   cy.get('#Bridge_modal_continueTransferButton').click();
    //   cy.wait(30000);
    //   cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
    //   cy.wait(50000);
    //   cy.get('.btn-close').click();
    //   cy.contains('Nightfall Assets').click();
    // });

    // // check2
    // // This case because recipient and sender both are same
    // // logged in user
    // it(`check token balance after transfer - after block proposed event`, () => {
    //   cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
    //     const totalBalance = Number($div.text());
    //     const returnCommitmentValue = depositValue * 2 - transferValue;
    //     expect(totalBalance).to.equal(
    //       currentTokenBalance + depositValue + transferValue + returnCommitmentValue,
    //     );
    //     currentTokenBalance = totalBalance;
    //   });
    // });
  });
});
