/* Mack Living commercial cards. Values are copied from the loaded files. Missing terms stay not stated or to confirm. */
(function (root) {
  'use strict';
  const REGION = {GM: 'Greater Manchester', BRS: 'Bristol / West', GLOS: 'Gloucestershire'};
  const NOT_STATED = 'not stated';
  const TO_CONFIRM = 'to confirm';

  function plain(value) {
    return String(value ?? '').replace(/\s*;\s*/g, '. ').replace(/[\u2014\u2013]/g, ', ').replace(/\s+/g, ' ').trim();
  }
  function stated(value) {
    const text = plain(value);
    if (!text) return '';
    if (/^(not published|not captured|not stated|none|n\/a)$/i.test(text)) return '';
    if (/^not published\b/i.test(text)) return '';
    return text;
  }
  function leaseType(text) {
    const source = String(text || '');
    if (/nightly/i.test(source)) return 'Nightly paid';
    if (/full repairing|\bFRI\b/i.test(source)) return 'Full repairing lease';
    if (/management agreement/i.test(source)) return 'Management agreement';
    if (/guaranteed rent/i.test(source)) return 'Guaranteed rent';
    if (/call-off|open framework|\bframework\b/i.test(source)) return 'Framework call-off';
    return TO_CONFIRM;
  }
  function bucket(status) {
    const source = String(status || '').toLowerCase();
    if (/historical|paused|superseded/.test(source)) return 'Historical';
    if (/to verify|unverified/.test(source)) return 'To confirm';
    if (/forthcoming|upcoming|expected/.test(source)) return 'Forthcoming';
    if (/deadline/.test(source)) return 'Deadline';
    if (/appointed/.test(source)) return 'Appointed';
    return 'Open';
  }
  function blank() {
    return {
      leaseType: TO_CONFIRM,
      length: NOT_STATED,
      termMonths: null,
      start: NOT_STATED,
      end: NOT_STATED,
      breaks: NOT_STATED,
      rentBasis: NOT_STATED,
      rentLevel: NOT_STATED,
      voids: NOT_STATED,
      repairs: NOT_STATED,
      buyer: NOT_STATED,
      region: NOT_STATED,
      regions: [],
      units: NOT_STATED,
      unitsNumber: null,
      deadline: '',
      deadlineLabel: NOT_STATED,
      next: NOT_STATED,
      status: TO_CONFIRM,
      bip: [],
      evidence: ''
    };
  }
  function card(partial) {
    const row = Object.assign(blank(), partial);
    row.bucket = bucket(row.status);
    row.leaseType = row.leaseType || TO_CONFIRM;
    return row;
  }
  function regionLabel(codes) {
    const names = (codes || []).map((code) => REGION[code] || code).filter(Boolean);
    return names.length ? names.join(', ') : NOT_STATED;
  }
  function frameworkOf(route, frameworks) {
    const items = (frameworks && frameworks.items) || [];
    const index = route.frameworkIndex;
    return Number.isInteger(index) && items[index] ? items[index] : null;
  }

  function routeCard(route, frameworks) {
    const framework = frameworkOf(route, frameworks);
    const lease = (framework && framework.lease_terms) || {};
    const id = route.id;
    const base = {
      id: id,
      source: 'Route file',
      name: route.shortName || route.name,
      regions: route.regions || [],
      region: regionLabel(route.regions),
      status: plain(route.statusLabel || route.status || TO_CONFIRM),
      next: plain(route.nextAction) || NOT_STATED,
      buyer: route.contacts && route.contacts[0] ? plain([route.contacts[0].organisation, route.contacts[0].name].filter(Boolean).join(', ')) : (framework && framework.buyer ? plain(framework.buyer) : NOT_STATED),
      evidence: plain(route.termEvidence || '')
    };
    if (id === 'bristol-private-renting') {
      return card(Object.assign(base, {
        length: '2-year contracts',
        termMonths: 24,
        rentBasis: 'Leasing rent is not published. It is discussed at a property visit.',
        rentLevel: NOT_STATED,
        voids: 'No published leasing void guarantee.',
        repairs: NOT_STATED
      }));
    }
    if (id === 'manchester-long-term-ta') {
      return card(Object.assign(base, {
        length: '10 years plus 1 day in the 15 March 2024 decision. The current empty-property page does not state a length.',
        start: '23 March 2024 (decision effective date)',
        rentBasis: 'No amount, indexation or minimum rent is published on the current page.',
        rentLevel: NOT_STATED,
        voids: 'No current void indemnity found.'
      }));
    }
    if (id === 'gm-empty-homes-leasing') {
      return card(Object.assign(base, {
        rentBasis: 'The report covers incentives and lease costs. It is not a landlord rent schedule.',
        voids: 'No standard void terms published.',
        evidence: plain(route.scaleEvidence || '')
      }));
    }
    if (id === 'aasc-landlord-supply') {
      return card(Object.assign(base, {
        leaseType: 'Guaranteed rent',
        rentBasis: 'Guaranteed rent is marketed. No amount or indexation is published.',
        rentLevel: NOT_STATED,
        voids: NOT_STATED,
        evidence: 'Ready Homes states long-term contracts with no number. Mears 3 or 5 year wording is generic and is not this route\'s term.'
      }));
    }
    if (id === 'cas3-incumbent-property-supply') {
      return card(Object.assign(base, {
        length: 'Not confirmed for an owner lease. THN service contract runs 19 April 2023 to 19 April 2028.',
        start: '19 April 2023 (THN service contract)',
        end: '19 April 2028 (THN service contract)',
        rentBasis: 'Framework record: provider nightly or bedspace model. Landlord pages market guaranteed rent. No programme rent was retrieved.',
        rentLevel: NOT_STATED,
        voids: 'Mears marketing says no voids. THN void clauses were not inspected. This is not a landlord guarantee.'
      }));
    }
    if (id === 'glos-cheltenham-p3-council') {
      return card(Object.assign(base, {
        leaseType: 'Guaranteed rent',
        length: '6 to 12 months. P3 becomes the tenant.',
        termMonths: 12,
        rentBasis: 'Guaranteed rental income is advertised. The amount is not verified.',
        rentLevel: NOT_STATED,
        voids: NOT_STATED
      }));
    }
    if (id === 'bristol-ea-dn677298') {
      return card(Object.assign(base, {
        leaseType: 'Framework call-off',
        length: 'Framework register runs to 3 Dec 2027. That is not a landlord lease length.',
        end: '3 Dec 2027 (register)',
        breaks: 'Initial 48 months plus up to 24-month options. None of those options are recorded as taken.',
        rentBasis: 'The £96m figure is a framework envelope, not owner rent.',
        rentLevel: NOT_STATED,
        voids: 'No guaranteed placement or void payment found.',
        repairs: stated(lease.repairs) || NOT_STATED
      }));
    }
    if (id === 'gmca1769-supported-16plus') {
      return card(Object.assign(base, {
        leaseType: 'Framework call-off',
        length: 'Estimated service dates 1 April 2027 to 31 March 2035. Not an owner lease.',
        start: '1 April 2027',
        end: '31 March 2035',
        rentBasis: 'Lot figures are service budgets, not asset rent.',
        rentLevel: NOT_STATED,
        voids: 'No owner void or rent guarantee is in the notice.',
        deadline: '2026-11-20',
        deadlineLabel: 'Submission 20 Nov 2026. Clarification was 10 Nov 2026.',
        buyer: framework && framework.buyer ? plain(framework.buyer) : 'GMCA'
      }));
    }
    return card(base);
  }

  function appointmentCard(row) {
    return card({
      id: 'mack-appointment',
      source: 'Mack appointment',
      name: 'MoJ CAS framework appointment',
      regions: ['National'],
      region: 'England and Wales',
      leaseType: 'Framework call-off',
      length: plain(row.term) || NOT_STATED,
      start: '2 Nov 2026',
      end: '1 Nov 2034',
      buyer: 'MoJ',
      status: plain(row.status) || TO_CONFIRM,
      next: 'Confirm the Mack Opco lots before treating a call-off as agreed.',
      bip: row.evidence || [],
      evidence: plain(row.lots || '')
    });
  }

  function tenderCard(row) {
    const notes = plain(row.notes || '');
    const base = {
      id: row.id,
      source: 'Recorded notice',
      name: row.name,
      regions: row.regions || [],
      region: regionLabel(row.regions),
      buyer: plain(row.buyer) || NOT_STATED,
      status: plain(row.status) || TO_CONFIRM,
      start: plain(row.start) || NOT_STATED,
      end: plain(row.end) || NOT_STATED,
      bip: (row.v4 && row.v4.bip) || [],
      evidence: notes
    };
    if (row.id === 'NEW-CAS3-P1476') {
      return card(Object.assign(base, {
        length: 'Estimated 1 April 2027 to 23 December 2027.',
        termMonths: 9,
        repairs: 'The notice says the provider covers repairs, utilities and council tax.',
        units: 'Minimum 66',
        unitsNumber: 66,
        rentLevel: NOT_STATED
      }));
    }
    if (row.id === 'NEW-MCC-P1218') {
      return card(Object.assign(base, {
        length: 'Estimated 1 April 2027 to 1 April 2031. The note says this is services, not property.',
        termMonths: 48,
        deadline: '2026-11-19',
        deadlineLabel: 'Contract notice expected 19 Nov 2026.',
        rentLevel: NOT_STATED
      }));
    }
    if (row.id === 'NEW-GLOS-TREVONE') {
      return card(Object.assign(base, {
        length: '1 April 2027 to 1 April 2030. The note says this is a care service, not a leasing route.',
        termMonths: 36,
        units: 'Up to 19 young people. Not stated as leased homes.',
        deadline: '2026-11-16',
        deadlineLabel: 'Tender deadline 16 Nov 2026.',
        rentLevel: NOT_STATED
      }));
    }
    return card(base);
  }

  function regionsForTerm(row, opps) {
    const codes = [];
    const add = (code) => { if (code && !codes.includes(code)) codes.push(code); };
    for (const id of row.opps || []) {
      const region = (opps[id] && opps[id].region) || '';
      if (/manchester/i.test(region)) add('GM');
      if (/bristol/i.test(region)) add('BRS');
      if (/gloucester/i.test(region)) add('GLOS');
      if (/england and wales/i.test(region)) add('National');
    }
    return codes;
  }
  function termCard(row, opps) {
    const length = stated(row['Lease term']);
    const rent = stated(row['Rent basis']);
    let termMonths = null;
    if (/10 years/i.test(length)) termMonths = 120;
    else if (/6 yr 11/i.test(length)) termMonths = 83;
    else if (/3 or 5|3-5|3 to 5/i.test(length)) termMonths = 60;
    else if (/usually 3|3 years/i.test(length)) termMonths = 36;
    else if (/2 years/i.test(length)) termMonths = 24;
    const rentLevel = /£\s?\d/.test(rent) ? rent : NOT_STATED;
    const regions = regionsForTerm(row, opps || {});
    return card({
      id: row.k,
      source: 'Partner terms',
      name: plain(row.partner + ' ' + (row.Programme || '')),
      regions: regions,
      region: regionLabel(regions),
      leaseType: leaseType([length, rent, row.Voids, row['Repairs / damage']].join(' ')),
      length: length || NOT_STATED,
      termMonths: termMonths,
      breaks: /renew/i.test(length) ? 'Renewable, as stated on the term row.' : NOT_STATED,
      rentBasis: rentLevel === NOT_STATED ? (rent || NOT_STATED) : 'A rent range is stated on the term row.',
      rentLevel: rentLevel,
      voids: stated(row.Voids) || NOT_STATED,
      repairs: stated(row['Repairs / damage']) || NOT_STATED,
      buyer: plain(row.partner) || NOT_STATED,
      status: plain(row['v3 status']) || TO_CONFIRM,
      next: stated(row['Submission route']) || NOT_STATED,
      evidence: 'Term row ' + row.k + ', as at ' + plain(row['As at'] || NOT_STATED) + '.'
    });
  }

  function manchesterCard(row) {
    return card({
      id: 'manchester-cas',
      source: 'Monday card',
      name: (row && row.name) || 'Manchester CAS',
      status: (row && row.status) || 'to verify with Chris and bid contacts',
      region: TO_CONFIRM,
      evidence: 'Details were left blank on purpose.'
    });
  }

  function build(input) {
    const routes = (input.living && input.living.contracts) || [];
    const v4 = input.v4 || {};
    const cards = routes.map((route) => routeCard(route, input.frameworks));
    const appointment = (v4.mack && v4.mack.appointments && v4.mack.appointments[0]) || null;
    if (appointment) cards.push(appointmentCard(appointment));
    const tenderIds = new Set((v4.mack && v4.mack.tenders) || []);
    for (const item of v4.newItems || []) if (tenderIds.has(item.id)) cards.push(tenderCard(item));
    const opps = Object.fromEntries((v4.opps || []).map((row) => [row.id, row]));
    for (const term of v4.terms || []) cards.push(termCard(term, opps));
    cards.push(manchesterCard(input.manchester));
    return {cards: cards, summary: summarise(cards, input.today || '2026-11-10')};
  }

  function summarise(cards, today) {
    const live = cards.filter((row) => row.bucket === 'Open' && row.id !== 'manchester-cas').length;
    const deadlines = cards.map((row) => row.deadline).filter((day) => day && day >= today).sort();
    const units = cards.reduce((total, row) => total + (row.unitsNumber || 0), 0);
    const longest = cards.reduce((best, row) => row.termMonths != null && (best == null || row.termMonths > best.months) ? {months: row.termMonths, name: row.name} : best, null);
    let longestLabel = NOT_STATED;
    if (longest) {
      const years = Math.floor(longest.months / 12);
      const months = longest.months % 12;
      longestLabel = (years ? years + ' years' : '') + (months ? (years ? ' ' : '') + months + ' months' : '');
    }
    return {
      live: live,
      nearest: deadlines[0] || '',
      units: units || null,
      longest: longestLabel
    };
  }

  function filterCards(cards, query) {
    const region = query.region || '';
    const lease = query.lease || '';
    const status = query.status || '';
    return cards.filter((row) => (!region || row.regions.includes(region) || row.region === region) && (!lease || row.leaseType === lease) && (!status || row.bucket === status));
  }

  function sortCards(cards, mode) {
    const copy = cards.slice();
    if (mode === 'term') {
      copy.sort((a, b) => (b.termMonths == null) - (a.termMonths == null) || ((b.termMonths || 0) - (a.termMonths || 0)) || a.name.localeCompare(b.name));
    } else {
      copy.sort((a, b) => (!a.deadline - !b.deadline) || String(a.deadline).localeCompare(String(b.deadline)) || a.name.localeCompare(b.name));
    }
    return copy;
  }

  root.MlCommercial = Object.freeze({
    NOT_STATED: NOT_STATED,
    TO_CONFIRM: TO_CONFIRM,
    REGION: REGION,
    plain: plain,
    leaseType: leaseType,
    build: build,
    summarise: summarise,
    filterCards: filterCards,
    sortCards: sortCards
  });
})(typeof window !== 'undefined' ? window : globalThis);
