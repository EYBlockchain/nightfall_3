/* eslint-disable cypress/no-unnecessary-waiting */

/*
 * This is the e2e test for nightfall browser
 * Note: to run it locally
 *  1. start all the containers from scratch.
 *  2. start wallet/nightfall_browser app (follow readme.md)
 *  3. In different terminal in wallet/ dir, run `npm run e2e-test`
 */

describe('End to End tests', () => {
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
      cy.get('button').contains('Generate Mnemonic').should('not.exist');
    });
  });
  context('Deposit', () => {
    const depositValue = 4;

    it('initial deposit with approve to spend', () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.url().should('include', '/bridge');
      cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(20000);
      cy.confirmMetamaskPermissionToSpend().then(approved => expect(approved).to.be.true);
      cy.wait(10000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(10000);
      cy.get('.btn-close').click();
    });

    it('second deposit which will create a new block', () => {
      cy.wait(10000);
      cy.url().should('include', '/bridge');
      cy.get('#Bridge_amountDetails_tokenAmount').clear().type(depositValue);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(20000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.wait(10000);
      cy.get('.btn-close').click();
    });

    it('check token balance after deposit', () => {
      cy.contains('Nightfall Assets').click();
      cy.url().should('include', '/wallet');
      cy.wait(20000);
      cy.get('#TokenItem_tokenBalanceMATIC').should($div => {
        cy.log($div.text());
        const totalBalance = Number($div.text());
        cy.log(totalBalance);
        cy.log(depositValue * 3);
        expect(totalBalance).to.equal(depositValue * 3);
        cy.log('after expect');
      });
    });
  });
});
