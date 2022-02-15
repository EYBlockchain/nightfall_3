/* eslint-disable cypress/no-unnecessary-waiting */

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
      cy.get('#generateMnemonic').contains('Generate Mnemonic');
      cy.get('#generateMnemonic').click();
      cy.get('#createWallet').click();
      cy.confirmMetamaskSignatureRequest().then(confirmed => expect(confirmed).to.be.true);
      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.url().should('include', '/bridge');
      cy.contains('Nightfall Assets').click();
      cy.get('#generateMnemonic').should('not.exist');
    });
  });
  context('Deposit', () => {
    it('initial deposit with approve', () => {
      cy.get('#TokenItem_tokenDepositMATIC').click();
      cy.url().should('include', '/bridge');
      cy.get('#Bridge_amountDetails_tokenAmount').clear().type(4);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(10000);
      cy.confirmMetamaskPermissionToSpend().then(approved => expect(approved).to.be.true);
      cy.wait(10000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close', { timeout: 10000 }).click();
    });

    it('second deposit which will create a new block', () => {
      cy.get('#Bridge_amountDetails_tokenAmount').clear().type(4);
      cy.get('button').contains('Transfer').click();
      cy.get('button').contains('Create Transaction').click();
      cy.get('#Bridge_modal_continueTransferButton').click();
      cy.wait(10000);
      cy.confirmMetamaskTransaction().then(confirmed => expect(confirmed).to.be.true);
      cy.get('.btn-close', { timeout: 10000 }).click();
      cy.contains('Nightfall Assets').click();
      cy.url().should('include', '/wallet');
      cy.get('#TokenItem_tokenBalanceMATIC').invoke('value').should('8.0011');
    });
  });
});
