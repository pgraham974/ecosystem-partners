/* Acquisition channels for one area. Counts come from supplied files. No invented listings. */
(function (root) {
  'use strict';
  const SOURCE = 'https://raw.githubusercontent.com/pgrahamLC/ecosystem-deals/main/blocks_for_sale.json';
  const PAGE = 'https://pgrahamlc.github.io/ecosystem-deals/blocks_for_sale.json';
  const CITY = Object.freeze({
    Manchester: 'GM',
    Liverpool: 'LIV',
    Cheshire: 'CHS',
    Birmingham: 'BIR',
    Bristol: 'BRS',
    'City Of Bristol': 'BRS',
    'City of Bristol': 'BRS',
    Glasgow: 'GLA',
    Edinburgh: 'EDI',
    Cheltenham: 'GLOS'
  });
  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  function num(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function checkedLabel(value) {
    const iso = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = iso.split('-');
    return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1] + ' ' + parts[0];
  }
  function isAuctionSale(row) {
    return /auction/i.test(String((row && (row.sale_method || row.saleMethod)) || ''));
  }
  function normaliseListing(row) {
    if (!row || isAuctionSale(row)) return null;
    const region = clean(row.region) || CITY[clean(row.city)] || '';
    if (!region) return null;
    const address = clean(row.address || row.title);
    const url = String(row.url || '');
    return {
      id: String(row.id || address),
      region,
      city: clean(row.city),
      address: address.length > 90 ? address.slice(0, 88) + '...' : address,
      price: num(row.price != null ? row.price : row.price_gbp),
      income: num(row.income != null ? row.income : row.income_pa),
      url: /^https:\/\//i.test(url) ? url : '',
      homes: num(row.homes)
    };
  }
  function listingsFrom(file) {
    const rows = Array.isArray(file) ? file : ((file && (file.listings || file.items)) || []);
    return rows.map(normaliseListing).filter(Boolean);
  }
  function assessIncome(items, hurdle) {
    const rows = (items || []).map((item) => {
      if (item.price == null || item.income == null || !(hurdle > 0)) {
        return Object.assign({}, item, {result: 'not testable', threshold: null, headroom: null});
      }
      const threshold = Math.round(item.income / hurdle);
      const headroom = threshold - item.price;
      return Object.assign({}, item, {
        threshold,
        headroom,
        result: item.price <= threshold ? 'below' : 'above'
      });
    });
    const tested = rows.filter((row) => row.result !== 'not testable');
    const below = tested.filter((row) => row.result === 'below').length;
    return {rows, tested: tested.length, below, above: tested.length - below, untested: rows.length - tested.length};
  }
  function onNote(known, count, updated) {
    const when = checkedLabel(updated);
    const checked = when ? ' Checked ' + when + '.' : '';
    const base = 'Private treaty listings from the Ecosystem Deals blocks file.' + checked + ' The file covers Manchester, Cheltenham and Bristol only. Auction rows in that file are not counted here.';
    if (!known) return 'The on-market file has not loaded yet.';
    if (!count) return 'No on-market listing is recorded for this area. ' + base;
    return base;
  }
  function auctionNote(loaded, count) {
    if (!loaded) return 'The auction lots file has not loaded yet.';
    if (!count) return 'No current auction lot is recorded for this area. Counts come from Ecosystem Deals. Allsop is excluded.';
    return 'Current upcoming lots from Ecosystem Deals. Allsop is excluded.';
  }
  function build(input) {
    const region = input && input.region;
    const loaded = !!(input && input.auctionsLoaded);
    const lots = ((input && input.lots) || []).filter((lot) => !region || lot.region === region);
    const onKnown = input && Object.prototype.hasOwnProperty.call(input, 'onMarket') && input.onMarket != null;
    const onItems = (onKnown ? listingsFrom(input.onMarket) : []).filter((row) => !region || row.region === region);
    const updated = (input && (input.onMarketUpdated || (input.onMarket && (input.onMarket.updated || input.onMarket.updated_at)))) || '';
    return {
      offMarket: {id: 'off-market', label: 'Off-market', count: 0, feed: false, loaded: false, note: 'no feed yet', items: []},
      auction: {id: 'auction', label: 'Auction', count: loaded ? lots.length : null, feed: true, loaded, note: auctionNote(loaded, lots.length), items: loaded ? lots : []},
      onMarket: {id: 'on-market', label: 'On-market', count: onKnown ? onItems.length : null, feed: true, loaded: !!onKnown, note: onNote(!!onKnown, onItems.length, updated), items: onKnown ? onItems : [], source: SOURCE, page: PAGE, updated}
    };
  }
  root.AcquisitionChannels = Object.freeze({SOURCE, PAGE, CITY, checkedLabel, isAuctionSale, normaliseListing, listingsFrom, assessIncome, build});
})(typeof window !== 'undefined' ? window : globalThis);
