/* eslint-disable cypress/no-unnecessary-waiting */

/*
 * This is the e2e test for nightfall browser
 * Note: to run it locally, follow below steps
 *  1. start all the containers from scratch.
 *  2. start wallet/nightfall_browser app (follow readme.md)
 *  3. In different terminal in wallet/ dir, run `npm run e2e-test`
 */

describe('End to End tests', () => {
  let currentTokenBalance = 0;
  const depositValue = 4;

  context('MetaMask', () => {
    it('getNetwork should return network by default', () => {
      cy.getNetwork().then(network => {
        expect(network.networkName).to.be.equal('ganache-nightfall');
        expect(network.networkId).to.be.equal(1337);
      });
    });

    it('getMetamaskWalletAddress should return wallet address of current metamask account', () => {
      cy.getMetamaskWalletAddress().then(address => {
        expect(address).to.be.equal('0x9C8B2276D490141Ae1440Da660E470E7C0349C63');
      });
    });

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
      cy.get('button').contains('Generate Mnemonic').should('not.exist');
    });
  });

  context('Deposit', () => {
    it(`initial deposit of value ${depositValue}`, () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('#Bridge_amountDetails_tokenAmount').type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(20000);
      cy.confirmMetamaskPermissionToSpend().then(approved => expect(approved).to.be.true);
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
    });

    it(`second deposit of value ${depositValue}`, () => {
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
    });

    it(`third deposit of value ${depositValue}`, () => {
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
    });

    it(`fourth deposit of value ${depositValue}`, () => {
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
      cy.contains('Nightfall Assets').click();
    });

    it(`check token balance equal to ${depositValue * 4}`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(depositValue * 4);
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
    const recipientPkd = '0x90ff185f7fa35ddae731ddad18a958d55d45bb973c16735018f6bc6f3798a7e1';

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedPkd').clear().type(recipientPkd);
      cy.get('button').contains('Continue').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close').click();
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
      cy.wait(10000);
    });

    // check1
    it(`check token balance after transfer - before block proposed event`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - transferValue);
        currentTokenBalance = totalBalance;
      });
    });

    // check2
    // This case because recipient and sender both are same
    // logged in user
    it(`check token balance after transfer - after block proposed event`, () => {
      cy.wait(50000);
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
      cy.wait(10000);
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance + transferValue);
        currentTokenBalance = totalBalance;
      });
    });
  });

  context('Double Transfer', () => {
    const transferValue = 6;

    /*
     * dummy pkd of user who does not exist
     * Note: even though we are passing recipientPkd but in code
     *   it gets override by sender's pdk for now
     *   hence two check
     *   check1: before Block Proposed event
     *   check2: after Block Proposed event
     */
    const recipientPkd = '0x90ff185f7fa35ddae731ddad18a958d55d45bb973c16735018f6bc6f3798a7e1';

    it(`transfer token of value ${transferValue}`, () => {
      cy.get('#TokenItem_tokenSendMATIC').click();
      cy.get('#TokenItem_modalSend_tokenAmount').clear().type(transferValue);
      cy.get('#TokenItem_modalSend_compressedPkd').clear().type(recipientPkd);
      cy.get('button').contains('Continue').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close').click();
      cy.contains('L2 Bridge').click();
      cy.contains('Nightfall Assets').click();
      cy.wait(10000);
    });

    it(`check token balance after transfer - before block proposed event`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance - depositValue * 2);
        currentTokenBalance = totalBalance;
      });
    });

    it(`initiate deposit of value ${depositValue} to satisfy 2 tx per block`, () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();
      // cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('#Bridge_amountDetails_tokenAmount').type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(30000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(50000);
      cy.get('.btn-close').click();
      cy.contains('Nightfall Assets').click();
      cy.wait(10000);
    });

    // check2
    // This case because recipient and sender both are same
    // logged in user
    it(`check token balance after transfer - after block proposed event`, () => {
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        const totalBalance = Number($div.text());
        expect(totalBalance).to.equal(currentTokenBalance + depositValue + transferValue);
        currentTokenBalance = totalBalance;
      });
    });
  });
});
