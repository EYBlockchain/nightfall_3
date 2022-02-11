describe('Metamask', () => {
  it(`getNetwork should return network by default`, () => {
    cy.getNetwork().then(network => {
      console.log(network.networkName);
      expect(network.networkName).to.be.equal('ganache-nightfall');
      expect(network.networkId).to.be.equal(1337);
    });
  });

  it(`getMetamaskWalletAddress should return wallet address of current metamask account`, () => {
    cy.getMetamaskWalletAddress().then(address => {
      expect(address).to.be.equal(
        '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
      );
    });
  });

  it('acceptMetamaskAccess should accept connection request to metamask', () => {
    cy.visit('/');
    cy.acceptMetamaskAccess().then(connected => {
      expect(connected).to.be.true;
    });
  });

  it('generate Mnemonic and set state', () => {
    cy.visit('/wallet');
    cy.get('#generateMnemonic').contains('Generate Mnemonic');
    cy.get('#generateMnemonic').click();
    cy.get('#createWallet').click();
    cy.confirmMetamaskSignatureRequest().then(confirmed => {
      expect(confirmed).to.be.true;
    });
    cy.get('#TokenItem_tokenDepositMATIC').click();
    cy.url().should('include', '/bridge');
    cy.visit('/wallet');
    cy.get('#generateMnemonic').should('not.exist');
  });
});