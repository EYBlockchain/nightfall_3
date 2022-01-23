import React from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/tokens.module.scss';
import TokenItem from '../TokenItem/index.jsx';

export default function Tokens(token) {
  console.log('Tokens in Asset', token);
  return (
    <div className={styles.maticTokensList}>
      <div className={styles.formHeader}>
        <div className={styles.leftSection}>
          <div className={styles.headerH5}>Balances on Polygon networkName</div>
          {/* <div
                    v-click-outside.stop="closeMobileFilterMenu"
                    class="mobile-filter-section"
                    @click.stop="toggleMobileFilterMenu"
                    >
                    <svg-sprite-icon
                        name="filter"
                        alt="filter-icon"
                        class="filter-icon"
                    /> */}

          {/* filter options are redundant in this file to accomodate responsive screen */}
          {/* this filter is for mobile screens */}
          {/* <div v-if="showMobileFilterMenu" class="filter-menu">
                        <div
                        class="plasma-only font-body-small light-gray-900 no-wrap"
                        @click.stop="onTogglePlasmaOnly"
                        >
                        <Checkbox
                            id="plasma-only"
                            :value="isPlasmaOnly"
                            small
                            @onChange="onTogglePlasmaOnly"
                        />
                        <label for="plasma-only" class="label font-body-small">
                            Plasma only
                        </label>
                        </div>
                        <div
                        class="hide-zero-balance font-body-small light-gray-900 no-wrap"
                        @click.stop="onToggleHideZeroBalance"
                        >
                        <Checkbox
                            id="hide-zero-balance"
                            :value="isHideZeroBalance"
                            small
                            @onChange="onToggleHideZeroBalance"
                        />
                        <label for="hide-zero-balance" class="label font-body-small">
                            Hide zero balances
                        </label>
                        </div>
                    </div>
                    </div> */}
        </div>

        {/* <div class="right-section">
                    <!-- this filter is for desktop screens -->
                    <div
                    class="plasma-only font-body-small light-gray-900 no-wrap cursor-pointer"
                    >
                    <Checkbox
                        id="plasma-only-desktop"
                        :value="isPlasmaOnly"
                        small
                        @onChange="onTogglePlasmaOnly"
                    />
                    <label for="plasma-only-desktop" class="label font-body-small">
                        Plasma only
                    </label>
                    </div>
                    <div
                    class="hide-zero-balance font-body-small light-gray-900 no-wrap cursor-pointer"
                    >
                    <Checkbox
                        id="hide-zero-balance"
                        :value="isHideZeroBalance"
                        small
                        @onChange="onToggleHideZeroBalance"
                    />
                    <label for="hide-zero-balance" class="label font-body-small">
                        Hide zero balances
                    </label>
                    </div>
                    <search-box
                    class="search-field"
                    placeholder="Search"
                    :change="val => (searchInput = val)"
                    />
                </div> */}
      </div>
      <div className={styles.seperator} />
      <div className={styles.tokenListSection}>
        <div className={styles.tokenListHeader}>
          <div className={styles.headerName}>Name</div>
          <div className={styles.headerBalance}>Balance</div>
          <div className={styles.headerActions}>Actions</div>
        </div>
        {token.tokenList.map((t, index) => (
          <TokenItem
            maticChainUsdBalance={t.maticChainUsdBalance}
            maticChainBalance={t.maticChainBalance}
            name={t.name}
            symbol={t.symbol}
            key={index}
          />
        ))}

        {/* <MaticTokensListItem
                    v-for="token in filteredTokens"
                    :key="`${token.id}-${token.isPoS}`"
                    :token="token"
                    :isFavourite="isFavouriteToken(token)"
                    :isMobileScreen="isMobileScreen"
                    @handleSendToken="handleSendToken"
                    @handleAddTokenToMetamask="handleAddTokenToMetamask"
                    @tokenClick="handleMobileTokenClick"
                    @markFavourite="handleMarkFavourite(token)"
                    @markUnfavourite="handleMarkUnfavourite(token)"
                /> */}
      </div>
      {/* <div
            v-if="formattedTokens.length !== 0"
            class="seperator footer-seperator"
            /> */}

      {/* <div v-if="formattedTokens.length !== 0" class="footer">
                <div class="pagination-summary">
                    <div>
                    Showing {{ currentItemStartCount }}-{{ currentItemEndCount }} of
                    {{ totalItems }}
                    </div>
                    <span class="desktop-only-seperator"> | </span>
                    <div class="entries-per-page-select">
                    <div class="label" for="number-of-tokens">
                        Show:
                    </div>
                    <CustomSelect
                        class="token-per-page-dropdown"
                        :options="['10', '20', '30']"
                        default="10"
                        @input="handleSelectTokenPerPage"
                    />
                    </div>
                </div>
                <div
                    v-if="isPaginationRequired"
                    class="s-pagination cursor-pointer font-body-small"
                >
                    <!-- <a
                    class="pagination-item pagination-arrow"
                    :class="{ disabled: goToPreviousDisabled }"
                    @click="setCurrentPage(1)"
                    >
                    First
                    </a> -->
                    <a
                    class="pagination-item pagination-arrow ms-r-4"
                    :class="{ disabled: goToPreviousDisabled }"
                    @click="!goToPreviousDisabled && setCurrentPage(currentPage - 1)"
                    >
                    <img :src="'chevron-left-minor.svg' | getImage" alt="previous">
                    </a>
                    <a
                    v-for="pageNo in pageList"
                    :key="pageNo"
                    class="pagination-item pagination-number"
                    :class="{ active: isActivePage(pageNo) }"
                    @click="setCurrentPage(pageNo)"
                    >{{ pageNo }}</a>
                    <a
                    class="pagination-item pagination-arrow ms-l-4"
                    :class="{
                        disabled: goToNextDisabled,
                    }"
                    @click="
                        !goToNextDisabled &&
                        (currentPage === 0
                            ? setCurrentPage(2)
                            : setCurrentPage(currentPage + 1))
                    "
                    >
                    <img :src="'chevron-right-minor.svg' | getImage" alt="next">
                    </a>
                    <!-- <a
                    class="pagination-item pagination-arrow"
                    :class="{
                        disabled: goToNextDisabled,
                    }"
                    @click="setCurrentPage(totalPages)"
                    >
                    Last
                    </a> -->
                </div>
            </div> */}
      {/* <div v-else class="no-tokens-section">
            No tokens found
            </div>
            <send-token-modal
            v-if="showSendModal"
            :cancel="toggleSendTokenModal"
            :defaultToken="selectedToken"
            /> */}
      {/* <div v-if="selectedToken && isMobileScreen" class="mobile-cta-menu">
                <Button class="close-button" @onClick="handleCloseMobileCta">
                    <img src="~/assets/svg/close-square.svg" alt="close icon">
                </Button>
                <div class="cta-main-section">
                    <div class="token-detail">
                    <img
                        v-if="!!tokenImage(selectedToken)"
                        class="token-img"
                        :src="tokenImage(selectedToken)"
                        alt="token icon"
                    >
                    <span class="header-h6">{{ selectedToken.symbol }}</span>
                    <span class="seperator-dot"> • </span>
                    <span class="font-body-small light-gray-600">
                        {{ selectedToken.name }}
                    </span>
                    </div>
                    <div class="actions-heading header-h5">
                    Actions
                    </div>
                    <Button
                    v-if="isFavouriteToken(selectedToken)"
                    class="mobile-cta-button"
                    label="Remove from favourites"
                    iconName="custom/star"
                    @onClick="handleMobileMarkUnfavouriteClick"
                    />
                    <Button
                    v-else
                    class="mobile-cta-button"
                    label="Add to favourites"
                    iconName="custom/star-filled"
                    @onClick="handleMobileMarkFavouriteClick"
                    />
                    <Button
                    class="mobile-cta-button"
                    label="Deposit"
                    :disabled="selectedToken.isDepositDisabled"
                    @onClick="handleMobileDepositClick"
                    />
                    <Button
                    class="mobile-cta-button"
                    label="Withdraw"
                    :disabled="selectedToken.isWithdrawDisabled"
                    @onClick="handleMobileWithdrawClick"
                    />
                    <Button
                    class="mobile-cta-button"
                    label="Send"
                    @onClick="handleSendToken(selectedToken)"
                    />
                    <Button
                    class="mobile-cta-button"
                    label="Metamask"
                    iconName="custom/metamask"
                    @onClick="handleAddTokenToMetamask(selectedToken)"
                    />
                </div>
            </div>
            <div v-if="selectedToken && isMobileScreen" class="s-mobile-cta-backdrop" /> */}
    </div>
  );
}

Tokens.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
