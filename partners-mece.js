/* Partners MECE model and tool-using agent.
 * Pure: no network, DOM, clock or storage. Pass today explicitly.
 * Does not invent names, financials or scores. Blank stays blank.
 */
(function (root) {
  'use strict';
  const SEGMENTS = ['rp', 'operator', 'other'];
  const SEGMENT_LABEL = {
    rp: 'Registered providers and charities',
    operator: 'Commercial operators',
    other: 'Other counterparties'
  };
  const ROUTE_ORDER = {'Published landlord route': 0, 'Partnership enquiry only': 1, 'No route verified': 2};
  const SCREEN_ORDER = {'Meets screen': 0, 'Review evidence': 1, 'Hold for review': 2};
  const SIZE_ORDER = {PASS: 0, CHECK: 1, FAIL: 2};
  const SIZE_TURNOVER = 20000000;
  const SIZE_ASSETS = 5000000;
  const RP_FORMS = new Set(['charity', 'registered provider (rsh)', 'cio', 'registered society']);
  const DISCLAIMER = 'Screening research, not an investment recommendation or credit approval.';
  const VIEWS = [
    {id: 'who', label: 'Counterparties', owns: 'Who we might work with. One directory. Segments are registered providers and charities, commercial operators, and other. Top 10 is a sort of that directory.'},
    {id: 'opportunities', label: 'Opportunities', owns: 'What we might pursue. Workbook opportunities joined by opportunity ID, plus a rent reference and a return check. Core scores are not recalculated here.'},
    {id: 'frameworks', label: 'Frameworks', owns: 'How councils and government buy or lease accommodation. Not a second list of counterparties or opportunities.'},
    {id: 'workbook', label: 'Workbook', owns: 'Imported sheet evidence. The rows behind Opportunities. Not a second directory.'}
  ];

  function normNo(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return raw.replace(/^0+/, '') || '0';
    return raw;
  }
  function canonKeys(value) {
    const keys = new Set();
    const add = (item) => {
      const n = normNo(item);
      if (!n) return;
      keys.add(n);
      const wrapped = n.match(/^(?:IP|RS)0*(\d+)R?$/);
      if (wrapped) keys.add(wrapped[1]);
      const society = n.match(/^0*(\d+)R$/);
      if (society) keys.add(society[1]);
    };
    add(value);
    return keys;
  }
  function addKeys(set, value) { for (const key of canonKeys(value)) set.add(key); }
  function normName(value) {
    return String(value || '').toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(limited|ltd|plc|llp)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function slug(value) {
    return normName(value).replace(/\s+/g, '-').slice(0, 80) || 'record';
  }
  function plain(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(plain).filter(Boolean).join('; ');
    if (typeof value === 'object') return Object.entries(value).filter(([, item]) => item != null && item !== '').map(([key, item]) => key.replace(/_/g, ' ') + ': ' + plain(item)).join('; ');
    return String(value);
  }
  function money(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const sign = value < 0 ? '-' : '';
    const amount = Math.abs(value);
    if (amount >= 1e6) return sign + '£' + (amount / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
    if (amount >= 1e3) return sign + '£' + Math.round(amount / 1e3) + 'k';
    return sign + '£' + Math.round(amount);
  }
  function shownMoney(value) { return money(value) || 'Not disclosed'; }
  function extractIds(text) {
    const found = [];
    const source = String(text || '');
    const push = (item) => { const n = normNo(item); if (n && !found.includes(n)) found.push(n); };
    for (const match of source.matchAll(/\b((?:IP|RS)\d+R?)\b/gi)) push(match[1]);
    for (const match of source.matchAll(/\bcompany\b[^.]{0,48}?(\d{6,8}|IP\d+R)\b/gi)) push(match[1]);
    for (const match of source.matchAll(/\bsociet(?:y|ies)\s+(\d{3,8}R?)\b/gi)) push(match[1]);
    for (const match of source.matchAll(/\bolder Companies House company\s+(\d{6,8})\b/gi)) push(match[1]);
    return found;
  }
  function primaryLegal(text) {
    return String(text || '').split(/\b(?:sole member|parent is|within the|part of)\b/i)[0];
  }
  function sizeTest(operator) {
    if (!operator) return null;
    const turnover = typeof operator.to === 'number' && Number.isFinite(operator.to) ? operator.to : null;
    const assets = typeof operator.na === 'number' && Number.isFinite(operator.na) ? operator.na : null;
    const turnoverMark = turnover == null ? '?' : (turnover >= SIZE_TURNOVER ? 'Y' : 'N');
    const assetsMark = assets == null ? '?' : (assets >= SIZE_ASSETS ? 'Y' : 'N');
    const result = turnoverMark === 'Y' && assetsMark === 'Y' ? 'PASS' : (turnoverMark === 'N' || assetsMark === 'N' ? 'FAIL' : 'CHECK');
    return {turnover: turnoverMark, assets: assetsMark, result};
  }
  function commercial(entity) {
    const category = entity.operator && entity.operator.cat || '';
    const kind = entity.partner && entity.partner.kind || '';
    if (/council-owned|asylum contractor/i.test(category) || kind === 'National contractor') return false;
    return /guaranteed-rent|social lettings|lettings firm|lettings group|franchis/i.test(category) || kind === 'Lettings / leasing firm';
  }
  function segmentOf(entity) {
    if (entity.scheme) return 'other';
    if (entity.rp) return 'rp';
    const form = String(entity.partner && entity.partner.form || '').toLowerCase();
    if (RP_FORMS.has(form)) return 'rp';
    if (entity.operator && /charity/i.test(entity.operator.cat || '')) return 'rp';
    if (commercial(entity)) return 'operator';
    return 'other';
  }
  function subtypeOf(entity) {
    if (entity.scheme) return 'Council scheme';
    if (entity.rp && entity.rp.route_status) return entity.rp.route_status;
    if (entity.partner && entity.partner.form && segmentOf(entity) === 'rp') return entity.partner.form;
    if (entity.operator && entity.operator.cat) return entity.operator.cat;
    if (entity.partner && entity.partner.kind) return entity.partner.kind;
    return 'Counterparty';
  }
  function citiesOf(entity) {
    const cities = new Set();
    for (const city of (entity.partner && entity.partner.cities) || []) if (city) cities.add(city);
    for (const city of (entity.rp && entity.rp.cities) || []) if (city) cities.add(city);
    for (const city of Object.keys((entity.operator && entity.operator.coverage) || {})) cities.add(city);
    return [...cities];
  }
  function displayName(entity) {
    return (entity.rp && entity.rp.name) || (entity.partner && entity.partner.name) || (entity.operator && (entity.operator.short || entity.operator.name)) || (entity.scheme && entity.scheme.name) || 'Unnamed record';
  }

  function classify(data, options) {
    if (!data || typeof data !== 'object') throw new TypeError('Expected partner datasets');
    const partnerFile = data.partners || {};
    const rpFile = data.rp || {};
    const operatorFile = data.operators || {};
    const partners = partnerFile.partners || [];
    const rpRows = rpFile.partners || [];
    const operators = operatorFile.operators || [];
    const schemes = operatorFile.schemes || [];
    const evaluate = options && options.evaluate;
    const today = options && options.today;
    const entities = [];
    const byKey = new Map();

    function blank() {
      return {keys: new Set(), aliases: [], ids: [], rp: null, partner: null, operator: null, scheme: null, absorbed: []};
    }
    function remember(row) {
      entities.push(row);
      for (const key of row.keys) if (key && !byKey.has(key)) byKey.set(key, row);
    }
    function addId(row, value) {
      for (const key of canonKeys(value)) row.keys.add(key);
      const n = normNo(value);
      if (n && !row.ids.includes(n)) row.ids.push(n);
      for (const key of canonKeys(value)) if (!byKey.has(key)) byKey.set(key, row);
    }
    function find(values) {
      for (const value of values) for (const key of canonKeys(value)) if (byKey.has(key)) return byKey.get(key);
      return null;
    }

    for (const rp of rpRows) {
      const row = blank();
      row.rp = rp;
      row.aliases.push(rp.name);
      const legal = plain(rp.legal_entity);
      const older = legal.match(/older Companies House company\s+\d{6,8}/ig) || [];
      for (const id of extractIds(primaryLegal(legal) + ' ' + older.join(' '))) addId(row, id);
      remember(row);
    }

    const superseded = [];
    for (const partner of partners) {
      if (partner.superseded_by) { superseded.push(partner); continue; }
      let row = find([partner.no]);
      if (!row) {
        const named = normName(partner.name);
        row = entities.find((item) => item.rp && normName(item.rp.name) === named);
      }
      if (!row) row = blank();
      row.partner = partner;
      row.aliases.push(partner.name);
      if (partner.legal) row.aliases.push(partner.legal);
      addId(row, partner.no);
      if (!entities.includes(row)) remember(row);
      else rememberKeysOnly(row);
      if (evaluate && today) {
        try { row.screen = evaluate(partner, {today}); }
        catch (error) { row.screen = null; }
      }
    }
    function rememberKeysOnly(row) {
      for (const key of row.keys) if (key && !byKey.has(key)) byKey.set(key, row);
    }
    for (const operator of operators) {
      if (superseded.some((partner) => partner.no && normNo(partner.no) === normNo(operator.no))) continue;
      let row = find([operator.no]);
      if (!row) {
        const named = normName(operator.name);
        if (named.length > 5) row = entities.find((item) => [item.rp && item.rp.name, item.partner && item.partner.name].some((name) => normName(name) === named));
      }
      if (!row) row = blank();
      if (!row.operator) row.operator = operator;
      row.aliases.push(operator.name);
      if (operator.short) row.aliases.push(operator.short);
      if (operator.entity) row.aliases.push(operator.entity);
      addId(row, operator.no);
      if (!entities.includes(row)) remember(row);
      else rememberKeysOnly(row);
    }
    for (const partner of superseded) {
      const targetName = normName(partner.superseded_by);
      const successor = entities.find((item) => {
        const names = [item.rp && item.rp.name, item.partner && item.partner.name].map(normName).filter(Boolean);
        return names.some((name) => name === targetName || name.includes(targetName));
      });
      const note = {name: partner.name, no: partner.no || '', successor: partner.superseded_by};
      if (successor) successor.absorbed.push(note);
    }
    for (const scheme of schemes) {
      const row = blank();
      row.scheme = scheme;
      row.aliases.push(scheme.name);
      if (scheme.council) row.aliases.push(scheme.council);
      remember(row);
    }

    const used = new Map();
    return entities.map((row) => {
      const name = displayName(row);
      const segment = segmentOf(row);
      let id = (row.ids[0] ? 'reg-' + slug(row.ids[0]) : 'name-' + slug(name)) + (row.scheme ? '-scheme' : '');
      used.set(id, (used.get(id) || 0) + 1);
      if (used.get(id) > 1) id += '-' + used.get(id);
      return {
        id,
        name,
        aliases: [...new Set(row.aliases.map((item) => String(item || '').trim()).filter(Boolean))],
        segment,
        segmentLabel: SEGMENT_LABEL[segment],
        subtype: subtypeOf(row),
        ids: row.ids.filter(Boolean),
        cities: citiesOf(row),
        rp: row.rp,
        partner: row.partner,
        operator: row.operator,
        scheme: row.scheme,
        screen: row.screen || null,
        size: sizeTest(row.operator),
        turnover: {
          accounts: row.partner && typeof row.partner.turnover === 'number' ? row.partner.turnover : null,
          operator: row.operator && typeof row.operator.to === 'number' ? row.operator.to : null
        },
        assets: {
          accounts: row.partner && typeof row.partner.net_assets === 'number' ? row.partner.net_assets : null,
          operator: row.operator && typeof row.operator.na === 'number' ? row.operator.na : null
        },
        absorbed: row.absorbed,
        sources: [
          row.rp ? {file: 'rp_charities.json', label: 'RP and charity research', asOf: row.rp.checked_date || rpFile.updated || ''} : null,
          row.partner ? {file: 'partners.json', label: 'Accounts screen file', asOf: partnerFile.research_reviewed || partnerFile.updated || ''} : null,
          row.operator ? {file: 'operators.json', label: 'Operator file', asOf: operatorFile.updated || ''} : null,
          row.scheme ? {file: 'operators.json', label: 'Council scheme', asOf: operatorFile.updated || ''} : null
        ].filter(Boolean)
      };
    });
  }

  function coverage(data, entities) {
    const errors = [];
    const owner = new Map();
    function claim(kind, key, id) {
      if (!key) return;
      const token = kind + ':' + key;
      if (owner.has(token) && owner.get(token) !== id) errors.push('Two records claim ' + token + ': ' + owner.get(token) + ' and ' + id);
      else owner.set(token, id);
    }
    for (const entity of entities) {
      if (!SEGMENTS.includes(entity.segment)) errors.push('Bad segment ' + entity.segment + ' on ' + entity.name);
      for (const id of entity.ids) for (const key of canonKeys(id)) claim('reg', key, entity.id);
      if (entity.rp) claim('rp', entity.rp.name, entity.id);
      if (entity.scheme) claim('scheme', entity.scheme.name, entity.id);
    }
    const superseded = new Set((data.partners.partners || []).filter((row) => row.superseded_by).map((row) => normNo(row.no)));
    for (const row of data.partners.partners || []) {
      if (row.superseded_by) continue;
      if (row.no && ![...canonKeys(row.no)].some((key) => owner.get('reg:' + key))) errors.push('Accounts record not listed: ' + row.name);
      if (!row.no && !entities.some((entity) => entity.partner === row)) errors.push('Accounts record without number not listed: ' + row.name);
    }
    for (const row of data.operators.operators || []) {
      if (superseded.has(normNo(row.no))) continue;
      if (row.no && ![...canonKeys(row.no)].some((key) => owner.get('reg:' + key))) errors.push('Operator not listed: ' + row.name);
    }
    for (const row of data.rp.partners || []) if (owner.get('rp:' + row.name) == null) errors.push('RP research not listed: ' + row.name);
    for (const row of data.operators.schemes || []) if (owner.get('scheme:' + row.name) == null) errors.push('Scheme not listed: ' + row.name);
    for (const row of data.partners.partners || []) {
      if (!row.superseded_by) continue;
      if (entities.some((entity) => entity.partner === row || (entity.operator && normNo(entity.operator.no) === normNo(row.no)))) errors.push('Superseded record still listed: ' + row.name);
    }
    const counts = Object.fromEntries(SEGMENTS.map((segment) => [segment, entities.filter((entity) => entity.segment === segment).length]));
    if (SEGMENTS.reduce((sum, segment) => sum + counts[segment], 0) !== entities.length) errors.push('Segment counts do not partition the directory');
    return {errors, counts, total: entities.length};
  }

  function turnoverOf(entity) {
    if (entity.turnover.accounts != null) return entity.turnover.accounts;
    return entity.turnover.operator;
  }
  function compareRank(a, b) {
    if (a.segment === 'rp' && b.segment === 'rp') {
      const ar = ROUTE_ORDER[a.subtype];
      const br = ROUTE_ORDER[b.subtype];
      const route = (ar == null ? 9 : ar) - (br == null ? 9 : br);
      if (route) return route;
    } else if (a.segment === 'operator' && b.segment === 'operator') {
      const size = (SIZE_ORDER[a.size && a.size.result] ?? 9) - (SIZE_ORDER[b.size && b.size.result] ?? 9);
      if (size) return size;
      const at = turnoverOf(a), bt = turnoverOf(b);
      if (at == null && bt != null) return 1;
      if (bt == null && at != null) return -1;
      if (at != null && bt != null && at !== bt) return bt - at;
    } else if (a.segment === 'other' && b.segment === 'other') {
      const as = a.screen && a.screen.status, bs = b.screen && b.screen.status;
      const screen = (SCREEN_ORDER[as] ?? 9) - (SCREEN_ORDER[bs] ?? 9);
      if (screen) return screen;
      const at = turnoverOf(a), bt = turnoverOf(b);
      if (at == null && bt != null) return 1;
      if (bt == null && at != null) return -1;
      if (at != null && bt != null && at !== bt) return bt - at;
    }
    return a.name.localeCompare(b.name, 'en');
  }
  function rankRule(segment) {
    if (segment === 'rp') return 'Published landlord route first, then partnership enquiry, then no verified route, then name. This is outreach order from the RP research file, not a credit score.';
    if (segment === 'operator') return 'Size test first (recorded turnover at least £20m and recorded net assets at least £5m). Undisclosed is a check, not a fail and not a zero. Then recorded turnover. This is not a credit score.';
    if (segment === 'other') return 'Accounts screen status first (meets screen, then review, then hold). No accounts screen sorts last. Then recorded turnover. Points are the existing accounts screen, not a core investibility score.';
    return 'Choose one segment. Top 10 is not calculated across mixed segments.';
  }
  function filterEntities(entities, query) {
    const segment = query && query.segment || 'all';
    const city = normName(query && query.city || '');
    const text = normName(query && query.q || '');
    let rows = entities.filter((entity) => segment === 'all' || entity.segment === segment);
    if (city) rows = rows.filter((entity) => entity.cities.some((item) => normName(item).includes(city) || city.includes(normName(item))));
    if (text) rows = rows.filter((entity) => normName([entity.name, entity.subtype, entity.ids.join(' '), entity.cities.join(' '), entity.aliases.join(' ')].join(' ')).includes(text));
    rows = [...rows].sort(compareRank);
    if (query && query.top) {
      if (segment === 'all') rows = [...entities].filter((entity) => entity.segment === 'rp').sort(compareRank).slice(0, 10);
      else rows = rows.slice(0, 10);
    }
    return rows;
  }

  function moneyLine(label, pair) {
    if (!pair || (pair.accounts == null && pair.operator == null)) return label + ': Not disclosed';
    if (pair.accounts != null && pair.operator != null && pair.accounts !== pair.operator) return label + ': accounts file ' + shownMoney(pair.accounts) + '; operator file ' + shownMoney(pair.operator);
    return label + ': ' + shownMoney(pair.accounts != null ? pair.accounts : pair.operator) + (pair.accounts != null ? ' (accounts file)' : ' (operator file)');
  }
  function facts(entity) {
    const rows = [];
    const add = (label, value) => { const text = plain(value); if (text) rows.push({label, value: text}); };
    add('Segment', entity.segmentLabel);
    add('Recorded role', entity.subtype);
    add('Registration', entity.ids.join(', '));
    add('Areas', entity.cities.join(', '));
    if (entity.rp) {
      add('Published route', entity.rp.route_status);
      add('Published terms', entity.rp.summary_terms);
      add('Main caution', entity.rp.summary_risk);
      add('Legal entity', entity.rp.legal_entity);
      add('Next step', entity.rp.next_step);
    }
    if (entity.partner) {
      add('Legal name on accounts file', entity.partner.legal || entity.partner.name);
      add('Accounts period', entity.partner.period_end);
      add('Filing', [entity.partner.acc_type, entity.partner.acc_format].filter(Boolean).join(', '));
      if (entity.screen) {
        add('Accounts screen', entity.screen.status + ' (' + entity.screen.score + '/100 recorded points, ' + entity.screen.coverage + '% of tests known)');
        add('Screen gaps', [...entity.screen.failed.map((key) => key + ' below test'), ...entity.screen.unknown.map((key) => key + ' unknown')].join(', '));
        if (entity.screen.hardStops.length) add('Hold reasons', entity.screen.hardStops.join(' '));
      }
    }
    rows.push({label: 'Turnover', value: moneyLine('Turnover', entity.turnover).replace(/^Turnover: /, '')});
    rows.push({label: 'Net assets', value: moneyLine('Net assets', entity.assets).replace(/^Net assets: /, '')});
    if (entity.size) add('Size test', entity.size.result + ' (turnover ' + entity.size.turnover + ', net assets ' + entity.size.assets + ')');
    if (entity.operator) add('Operator offer', entity.operator.offer || 'Not published');
    if (entity.scheme) add('Scheme', entity.scheme.offer || entity.scheme.council);
    if (entity.absorbed.length) add('Not a separate current counterparty', entity.absorbed.map((item) => item.name + (item.no ? ' (' + item.no + ')' : '') + ' recorded as superseded by ' + item.successor).join('; '));
    add('Sources', entity.sources.map((item) => item.label + ' ' + item.file + (item.asOf ? ' ' + item.asOf : '')).join('; '));
    return rows;
  }

  function opportunityReturn(values) {
    const capital = values.price + values.fees + values.works;
    const gross = values.units * values.rent;
    const effective = gross * (1 - values.loss / 100);
    const noi = effective - values.costs - values.reserve;
    const service = values.debt * values.interest / 100 + values.principal + values.finance;
    const equity = capital - values.debt;
    const cash = noi - service;
    return {
      capital, gross, effective, noi, service, equity, cash,
      grossYield: capital > 0 ? gross / capital : null,
      netYield: capital > 0 ? noi / capital : null,
      cashYield: equity > 0 ? cash / equity : null,
      dscr: service > 0 ? noi / service : null,
      breakeven: values.units > 0 && values.loss < 100 ? (values.costs + values.reserve + service) / (values.units * (1 - values.loss / 100)) : null
    };
  }

  function findEntities(question, entities, limit) {
    const haystack = ' ' + normName(question) + ' ';
    const upper = question.toUpperCase();
    const hits = [];
    for (const entity of entities) {
      let score = 0;
      for (const alias of entity.aliases) {
        const name = normName(alias);
        if (name.length > 4 && haystack.includes(' ' + name + ' ')) score = Math.max(score, name.length + 20);
        else if (name.length > 4 && haystack.includes(name)) score = Math.max(score, name.length);
        const short = String(alias).split(/[/(]/)[0].trim();
        if (short.length >= 3 && short.length <= 24) {
          const pattern = new RegExp('\\b' + short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          if (pattern.test(question)) score = Math.max(score, 18 + short.length);
        }
      }
      for (const id of entity.ids) if (id.length >= 4 && upper.includes(String(id).toUpperCase())) score = Math.max(score, 30 + id.length);
      const tokens = normName(entity.name).split(' ').filter((token) => token.length > 3 && !/^(housing|homes|support|services|charity|group|people|living|lettings|property|limited|association|community|care|independent|residential)$/.test(token));
      if (tokens.length && tokens.every((token) => haystack.includes(token)) && tokens.join(' ').length > 5) score = Math.max(score, 12 + tokens.join(' ').length);
      if (score) hits.push({entity, score});
    }
    hits.sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
    const chosen = [];
    for (const hit of hits) {
      if (chosen.some((item) => item.entity.id === hit.entity.id)) continue;
      if (chosen.some((item) => item.score > hit.score + 8 && normName(item.entity.name).includes(normName(hit.entity.name)))) continue;
      chosen.push(hit);
      if (chosen.length >= (limit || 5)) break;
    }
    return chosen.map((hit) => hit.entity);
  }
  function segmentFromQuestion(question) {
    const text = question.toLowerCase();
    if (/commercial operator|\boperators?\b|\blettings\b|guaranteed rent/.test(text)) return 'operator';
    if (/registered provider|\bcharit|\brps\b|\brp\b/.test(text)) return 'rp';
    if (/\bother\b|support provider|council scheme|national contractor/.test(text)) return 'other';
    return 'all';
  }
  function cityFromQuestion(question) {
    const text = question.toLowerCase();
    if (/bristol/.test(text)) return 'Bristol';
    if (/cheltenham|gloucester/.test(text)) return 'Cheltenham';
    if (/manchester|\bgm\b/.test(text)) return 'Manchester';
    return '';
  }
  function oppIds(question) {
    return [...new Set((question.toUpperCase().match(/\b(?:GM|BR|GL)-\d{3,}\b/g) || []))];
  }
  function findOpps(question, opportunities, limit) {
    const ids = new Set(oppIds(question));
    const hits = [];
    for (const opp of opportunities || []) {
      if (ids.has(String(opp.id || '').toUpperCase())) hits.push({opp, score: 100});
      else {
        const name = normName(opp.name);
        if (name.length > 4 && normName(question).includes(name)) hits.push({opp, score: name.length});
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit || 5).map((hit) => hit.opp);
  }
  function citeEntity(entity) {
    return {view: 'who', id: entity.id, label: entity.name, segment: entity.segment, source: entity.sources.map((item) => item.file + (item.asOf ? ' ' + item.asOf : '')).join('; ')};
  }
  function citeOpp(opp) {
    return {view: 'opportunities', id: opp.id, label: opp.id + ' ' + (opp.name || ''), source: 'sheets_public.json Opportunities' + (opp.source && opp.source.row != null ? ' row ' + opp.source.row : '')};
  }
  function pack(text, citations, actions, trace) {
    return {text: text.replace(/[—–]/g, ', '), citations: citations || [], actions: actions || [], trace: trace || [], disclaimer: DISCLAIMER};
  }
  function coreSentence(opp) {
    if (opp.coreScore == null) return 'Core score: not calculated. Score Breakdown does not have one complete row of 12 numeric dimensions, so no core total is shown. Historical seed: ' + (opp.seedScore == null ? 'not scored' : opp.seedScore + '/100, the saved workbook total, not recomputed from parts') + '.';
    return 'Core score from a complete Score Breakdown row: ' + opp.coreScore + '/100. Historical seed: ' + (opp.seedScore == null ? 'not scored' : opp.seedScore + '/100') + '.';
  }
  function explainOpp(opp) {
    const gates = (opp.gates || []).map((gate) => gate.name + ': ' + gate.status + (gate.reasons && gate.reasons.length ? ' (' + gate.reasons.join(' ') + ')' : '')).join('\n');
    return [
      opp.id + ' ' + (opp.name || 'Unnamed') + (opp.region ? ' (' + opp.region + ')' : ''),
      'Evidence readiness: ' + opp.readiness + '/100 from recorded gates (10 per PASS, 5 per CONDITIONAL). This is not a credit score.',
      coreSentence(opp),
      'Demand links: ' + (opp.demands || []).length + '. Term links: ' + (opp.terms || []).length + '. Contact links: ' + (opp.contacts || []).length + '. Evidence links: ' + (opp.evidence || []).length + '.',
      gates ? 'Gates:\n' + gates : 'No gate rows on this opportunity.',
      'Next action: ' + (opp.nextAction || 'None recorded') + (opp.nextDue ? ' (due ' + opp.nextDue + ')' : '')
    ].join('\n');
  }
  function searchSheets(sheets, needle, limit) {
    const query = normName(needle);
    if (!sheets || query.length < 3) return [];
    const hits = [];
    for (const book of sheets.books || []) for (const sheet of book.sheets || []) {
      for (const row of sheet.rows || []) {
        const text = row.map((value) => value == null ? '' : String(value)).join(' | ');
        if (normName(text).includes(query)) {
          hits.push({bookId: book.id, book: book.title, sheet: sheet.name, row: row[0], text: text.slice(0, 220)});
          if (hits.length >= (limit || 6)) return hits;
        }
      }
    }
    return hits;
  }
  function searchFrameworks(items, question) {
    const query = normName(question).replace(/\b(frameworks?|open|show|which|what|are|the|in|for)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const city = cityFromQuestion(question);
    return (items || []).filter((item) => {
      const blob = normName([item.name, item.buyer, item.accom_type, item.geography, (item.regions || []).join(' '), item.status, item.investor_route].join(' '));
      if (query.length > 3 && !blob.includes(query) && !query.split(' ').filter((word) => word.length > 3).every((word) => blob.includes(word))) return false;
      if (city && blob.indexOf(normName(city)) < 0 && !(city === 'Manchester' && /\bgm\b|greater manchester/.test(blob))) return false;
      return true;
    }).slice(0, 8);
  }

  function answer(question, ctx) {
    const q = String(question || '').trim();
    const entities = ctx && ctx.entities || [];
    const opportunities = ctx && ctx.opportunities || [];
    const trace = [];
    if (!q) return pack('Ask about a counterparty, an opportunity, a framework, or a workbook row.', [], [], ['none']);
    const low = q.toLowerCase();
    if (/\bmp-\d+/.test(low)) return pack('MP ids belong to the retired Mack pipeline chat. This Partners agent uses GM, BR and GL opportunity ids and the counterparty directory.', [], [], ['reject_mack_ids']);
    if (/\b(bip|refresh|sync)\b/.test(low) && /\b(5 nov|5 november|this morning|today|latest|fresh)\b/.test(low)) {
      trace.push('freshness');
      return pack('No BiP sync dated 5 Nov 2026 is recorded on this page. The workbook snapshot was imported 2026-10-20. The v4 file records its own build on 2026-11-03, including that file\'s note of a 3 Nov 2026 BiP check. Seed scores remain historical. Core scores are not recalculated while Score Breakdown dimensions are empty.', [], [], trace);
    }
    if (/\b(which view|what view|where (do|should)|mece|information architecture)\b/.test(low)) {
      trace.push('list_views');
      return pack(VIEWS.map((view) => view.label + ': ' + view.owns).join('\n'), VIEWS.map((view) => ({view: view.id, label: view.label})), [], trace);
    }
    if (/\bhow many\b|\bcounts?\b/.test(low)) {
      trace.push('count_directory');
      const counts = Object.fromEntries(SEGMENTS.map((segment) => [segment, entities.filter((entity) => entity.segment === segment).length]));
      const scored = opportunities.filter((opp) => opp.coreScore != null).length;
      return pack('Counterparties: ' + entities.length + ' (' + counts.rp + ' registered providers and charities, ' + counts.operator + ' commercial operators, ' + counts.other + ' other).\nOpportunities: ' + opportunities.length + '. Core scores calculated from Score Breakdown: ' + scored + '. The rest keep a historical seed only, or are unscored.', [], [{type: 'navigate', view: 'who', auto: false}], trace);
    }
    if (/\b(return check|yield|cash on equity|all-in cost)\b/.test(low)) {
      trace.push('explain_return_check');
      return pack('The return check only calculates from figures you type: units, agreed annual rent per unit, purchase price, taxes and fees, works, landlord costs, repairs reserve, rent loss, debt, interest, principal and other financing fees. Blank is not zero. No partner revenue or framework ceiling is used as rent. Open the calculator on Opportunities. ' + DISCLAIMER, [], [{type: 'navigate', view: 'opportunities', mode: 'return', auto: true}], trace);
    }
    if (/\b(lha|local housing allowance|rent reference)\b/.test(low)) {
      trace.push('open_rent_reference');
      return pack('Rent reference is the official LHA table already loaded with Opportunities. It is a benefit ceiling, not an offered rent and not a core score.', [], [{type: 'navigate', view: 'opportunities', mode: 'rent', auto: true}], trace);
    }
    if (/\btop\s*10\b|\brank/.test(low)) {
      const segment = segmentFromQuestion(q);
      const used = segment === 'all' ? 'rp' : segment;
      trace.push('rank_counterparties:' + used);
      const rows = filterEntities(entities, {segment: used, city: cityFromQuestion(q), top: true});
      const lines = rows.map((entity, index) => (index + 1) + '. ' + entity.name + ' (' + entity.subtype + ')');
      return pack('Top ' + rows.length + ' in ' + SEGMENT_LABEL[used] + '.\n' + rankRule(used) + '\n' + (lines.join('\n') || 'No records.') + (segment === 'all' ? '\nNo segment was named, so this is the registered provider and charity order. Ask for operators or other if you want that sort.' : ''), rows.map(citeEntity), [{type: 'navigate', view: 'who', segment: used, top: true, city: cityFromQuestion(q), auto: true}], trace);
    }
    if (/\bdraft\b/.test(low) && /\b(note|screen|memo)\b/.test(low)) {
      trace.push('draft_screening_note');
      const opps = findOpps(q, opportunities, 1);
      const found = findEntities(q, entities, 1);
      if (opps.length && /\b(opportunit|gm-|br-|gl-)/.test(low)) {
        const opp = opps[0];
        return pack('Screening note\n' + DISCLAIMER + '\n\n' + explainOpp(opp) + '\n\nNot established: signed rent, the rent-paying entity, or credit approval.', [citeOpp(opp)], [{type: 'navigate', view: 'opportunities', id: opp.id, auto: true}], trace);
      }
      if (!found.length) return pack('Name the counterparty or opportunity id to draft from. I will not invent one.', [], [], trace);
      const entity = found[0];
      const body = facts(entity).map((row) => row.label + ': ' + row.value).join('\n');
      return pack('Screening note\n' + DISCLAIMER + '\n\n' + entity.name + '\n' + body + '\n\nNot established: current intake, a parent guarantee, or a signed rent.', [citeEntity(entity)], [{type: 'navigate', view: 'who', id: entity.id, segment: entity.segment, auto: true}], trace);
    }
    if (/\b(missing|without|unlinked|no linked|not linked)\b/.test(low)) {
      trace.push('missing_links');
      const wantDemand = /demand/.test(low) || !/term/.test(low);
      const wantTerms = /term/.test(low) || !/demand/.test(low);
      let rows = opportunities.filter((opp) => (wantDemand && !(opp.demands || []).length) || (wantTerms && !(opp.terms || []).length));
      const named = findOpps(q, opportunities, 1);
      if (named.length) rows = named.filter((opp) => (wantDemand && !(opp.demands || []).length) || (wantTerms && !(opp.terms || []).length));
      const lines = rows.slice(0, 12).map((opp) => opp.id + ' ' + (opp.name || '') + ': demand ' + (opp.demands || []).length + ', terms ' + (opp.terms || []).length);
      return pack((rows.length ? rows.length + ' opportunities with a missing link. Showing ' + lines.length + '.\n' : 'No matching gap.\n') + lines.join('\n') + '\nA missing link is a workbook join gap, not proof that no commercial conversation exists.', rows.slice(0, 12).map(citeOpp), [], trace);
    }
    if (/\b(core score|investib|score breakdown)\b/.test(low) || (/\bwhy\b/.test(low) && /\b(gate|fail|readiness|rank)\b/.test(low))) {
      const opps = findOpps(q, opportunities, 3);
      if (opps.length) {
        trace.push('explain_opportunity');
        return pack(opps.map(explainOpp).join('\n\n'), opps.map(citeOpp), [{type: 'navigate', view: 'opportunities', id: opps[0].id, auto: /\b(open|show)\b/.test(low)}], trace);
      }
      if (/\b(core score|investib|score breakdown)\b/.test(low)) {
        trace.push('explain_core_score');
        const calculated = opportunities.filter((opp) => opp.coreScore != null).length;
        return pack(calculated + ' of ' + opportunities.length + ' core scores are calculated from a complete Score Breakdown. The rest are not calculated: blank dimensions are not zero and are not filled in. Any Core score (/100) on the opportunity row is a historical seed. Evidence readiness is a separate gate count, not a credit score. Workbook imported 2026-10-20. v4 file built 2026-11-03. No 5 Nov 2026 BiP refresh is recorded here.', [], [{type: 'navigate', view: 'opportunities', auto: false}], trace);
      }
      const found = findEntities(q, entities, 1);
      if (found.length && /\brank|why\b/.test(low)) {
        trace.push('explain_rank');
        const entity = found[0];
        const list = filterEntities(entities, {segment: entity.segment});
        const index = list.findIndex((item) => item.id === entity.id);
        return pack(entity.name + ' is ' + (index + 1) + ' of ' + list.length + ' in ' + entity.segmentLabel + '.\n' + rankRule(entity.segment) + '\n' + facts(entity).slice(0, 8).map((row) => row.label + ': ' + row.value).join('\n'), [citeEntity(entity)], [{type: 'navigate', view: 'who', id: entity.id, segment: entity.segment, auto: false}], trace);
      }
    }
    if (/\b(compare|versus|\bvs\b)\b/.test(low)) {
      trace.push('compare_counterparties');
      const found = findEntities(q, entities, 4);
      if (found.length < 2) return pack(found.length === 1 ? 'I only found ' + found[0].name + '. Name the second counterparty. I will not pick one.' : 'Name two counterparties to compare. I will not invent a pair.', found.map(citeEntity), [], trace);
      const pair = found.slice(0, 2);
      const labels = [...new Set(pair.flatMap((entity) => facts(entity).map((row) => row.label)))];
      const lines = [pair.map((entity) => entity.name).join(' compared with ') + '.', DISCLAIMER];
      for (const label of labels) {
        lines.push(label + ': ' + pair.map((entity) => {
          const row = facts(entity).find((item) => item.label === label);
          return (row && row.value) || 'Not recorded';
        }).join(' | '));
      }
      return pack(lines.join('\n'), pair.map(citeEntity), [], trace);
    }
    if (/^(open|show|go to|take me)\b/.test(low)) {
      trace.push('navigate');
      if (/opportunit/.test(low)) {
        const opp = findOpps(q, opportunities, 1)[0];
        return pack(opp ? 'Opening ' + opp.id + ' ' + (opp.name || '') + '.' : 'Opening Opportunities.', opp ? [citeOpp(opp)] : [], [{type: 'navigate', view: 'opportunities', id: opp && opp.id, auto: true}]);
      }
      if (/framework/.test(low)) return pack('Opening Frameworks.', [], [{type: 'navigate', view: 'frameworks', auto: true}], trace);
      if (/workbook|sheet/.test(low)) return pack('Opening the workbook.', [], [{type: 'navigate', view: 'workbook', auto: true}], trace);
      const segment = segmentFromQuestion(q);
      const found = findEntities(q, entities, 1)[0];
      return pack('Opening Counterparties' + (found ? ': ' + found.name : segment !== 'all' ? ': ' + SEGMENT_LABEL[segment] : '') + '.', found ? [citeEntity(found)] : [], [{type: 'navigate', view: 'who', segment: found ? found.segment : segment, id: found && found.id, auto: true}], trace);
    }
    if (/\bframework/.test(low)) {
      trace.push('search_frameworks');
      const rows = searchFrameworks(ctx.frameworks || [], q);
      const lines = rows.map((item) => item.name + ' (' + (item.buyer || 'buyer not recorded') + ', ' + (item.status || item.status_n || 'status not recorded') + ')');
      return pack((lines.length ? lines.join('\n') : 'No framework record matched.') + '\nFramework values are not landlord rent.', rows.map((item) => ({view: 'frameworks', label: item.name, source: 'frameworks.json'})), [{type: 'navigate', view: 'frameworks', auto: false}], trace);
    }
    if (/\b(workbook|worksheet|sheets?\b|score breakdown)\b/.test(low)) {
      trace.push('search_workbook');
      const named = findEntities(q, entities, 1)[0];
      const id = oppIds(q)[0];
      const needle = id || (named && named.name) || q.replace(/\b(workbook|worksheet|sheets?|search|find|show|row|about)\b/gi, ' ');
      const hits = searchSheets(ctx.sheets, needle, 6);
      const lines = hits.map((hit) => hit.book + ' / ' + hit.sheet + ' / source row ' + hit.row + ': ' + hit.text);
      return pack(lines.length ? lines.join('\n') : 'No workbook row matched "' + String(needle).trim() + '".', hits.map((hit) => ({view: 'workbook', label: hit.sheet + ' row ' + hit.row, source: hit.book})), hits[0] ? [{type: 'sheet', bookId: hits[0].bookId, sheet: hits[0].sheet, row: hits[0].row, auto: false}] : [], trace);
    }
    const opps = findOpps(q, opportunities, 5);
    if (opps.length && (oppIds(q).length || /\bopportunit/.test(low))) {
      trace.push('search_opportunities');
      return pack(opps.map(explainOpp).join('\n\n'), opps.map(citeOpp), [{type: 'navigate', view: 'opportunities', id: opps[0].id, auto: false}], trace);
    }
    trace.push('search_counterparties');
    const direct = findEntities(q, entities, 8);
    const segment = segmentFromQuestion(q);
    const city = cityFromQuestion(q);
    const route = /published landlord route/.test(low) ? 'Published landlord route' : /partnership enquiry/.test(low) ? 'Partnership enquiry only' : /no route verified|no verified route/.test(low) ? 'No route verified' : '';
    let rows = direct;
    if (route || city || /\bhold\b/.test(low) || segment !== 'all') {
      rows = filterEntities(entities, {segment, city});
      if (route) rows = rows.filter((entity) => entity.subtype === route || (entity.rp && entity.rp.route_status === route));
      if (/\bhold for review\b|\bon hold\b/.test(low)) rows = rows.filter((entity) => entity.screen && entity.screen.status === 'Hold for review');
      if (direct.length && !route) {
        const ids = new Set(direct.map((entity) => entity.id));
        const narrowed = rows.filter((entity) => ids.has(entity.id));
        if (narrowed.length) rows = narrowed;
      }
    }
    rows = rows.slice(0, 8);
    if (!rows.length) return pack('Nothing in the loaded counterparty, opportunity, framework or workbook data matched that. I have not guessed a name.', [], [], trace);
    const lines = rows.map((entity) => entity.name + ': ' + entity.segmentLabel + ', ' + entity.subtype + '. ' + moneyLine('Turnover', entity.turnover) + '.');
    const note = rows.length === 8 ? '\nShowing 8 matches. Open Counterparties for the full segment.' : '';
    return pack(lines.join('\n') + note + '\n' + DISCLAIMER, rows.map(citeEntity), [{type: 'navigate', view: 'who', id: rows[0].id, segment: rows[0].segment === segment || segment === 'all' ? rows[0].segment : segment, city, auto: false}], trace);
  }

  root.PartnersMece = Object.freeze({
    SEGMENTS, SEGMENT_LABEL, DISCLAIMER, VIEWS, SIZE_TURNOVER, SIZE_ASSETS,
    classify, coverage, filterEntities, rankRule, facts, money: shownMoney,
    opportunityReturn, answer, findEntities, searchSheets
  });
})(typeof window !== 'undefined' ? window : globalThis);
