commitment = H(tokenId, value, Pk, salt)

- tokenId == null, value != null => call ERC20 transferFrom;
- tokenId !=null, value == null => call ERC721 safeTransferFrom;
- tokenID != null, value !=null => call ERC1155 safeTransferFrom;

ERCInterface.sol
