/* Pure helpers for the Go / No-Go checklist. No DOM, network or storage. */
(function (root) {
  'use strict';
  const STATUSES = Object.freeze([
    {id: 'not-started', label: 'Not started'},
    {id: 'in-progress', label: 'In progress'},
    {id: 'done', label: 'Done'}
  ]);
  const STATUS_IDS = STATUSES.map((row) => row.id);
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
  const HASH_RE = /^[A-Za-z][A-Za-z0-9/_-]{0,160}$/;

  function tally(items) {
    const list = Array.isArray(items) ? items : [];
    const total = list.length;
    const done = list.filter((item) => item && item.done).length;
    return {done, total, percent: total ? Math.round((done / total) * 100) : 0};
  }
  function summarise(state) {
    const streams = ((state && state.workstreams) || []).map((ws) => Object.assign({id: ws.id, title: ws.title}, tally(ws.items)));
    const done = streams.reduce((sum, row) => sum + row.done, 0);
    const total = streams.reduce((sum, row) => sum + row.total, 0);
    return {done, total, percent: total ? Math.round((done / total) * 100) : 0, streams};
  }
  function makeId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }
  function uniqueId(id, used) {
    let next = id;
    let n = 2;
    while (used.has(next)) {
      next = id + '-' + n;
      n += 1;
    }
    used.add(next);
    return next;
  }
  function cleanId(value, fallback) {
    const id = String(value ?? '').trim();
    return ID_RE.test(id) ? id : fallback;
  }
  function safeLink(link) {
    if (!link || typeof link !== 'object' || Array.isArray(link)) return null;
    const label = String(link.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!label) return null;
    if (typeof link.hash === 'string' && HASH_RE.test(link.hash)) return {label, hash: link.hash};
    if (typeof link.href === 'string' && /^https:\/\/[^\s"'<>]+$/.test(link.href)) return {label, href: link.href};
    return null;
  }
  function align(raw) {
    let status = STATUS_IDS.includes(raw.status) ? raw.status : '';
    if (!status) status = raw.done ? 'done' : 'not-started';
    return {status, done: status === 'done'};
  }
  function normaliseItem(raw, index, used) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {error: 'Item ' + (index + 1) + ' is not a record.'};
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text) return {error: 'Item ' + (index + 1) + ' needs text.'};
    if (text.length > 500) return {error: 'Item text is too long.'};
    const flags = align(raw);
    const links = Array.isArray(raw.links) ? raw.links.map(safeLink).filter(Boolean) : [];
    return {
      item: {
        id: uniqueId(cleanId(raw.id, 'item-' + (index + 1)), used),
        text,
        done: flags.done,
        notes: String(raw.notes ?? '').replace(/\r\n/g, '\n').slice(0, 4000),
        owner: String(raw.owner ?? '').trim().slice(0, 120),
        status: flags.status,
        links
      }
    };
  }
  function normaliseWorkstream(raw, index, usedWs) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {error: 'Workstream ' + (index + 1) + ' is not a record.'};
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) return {error: 'A workstream needs a title.'};
    if (title.length > 200) return {error: 'Workstream name is too long.'};
    if (!Array.isArray(raw.items)) return {error: 'A workstream needs an items list.'};
    if (raw.items.length > 80) return {error: 'Too many items in a workstream.'};
    const used = new Set();
    const items = [];
    for (let i = 0; i < raw.items.length; i++) {
      const result = normaliseItem(raw.items[i], i, used);
      if (result.error) return result;
      items.push(result.item);
    }
    return {
      workstream: {
        id: uniqueId(cleanId(raw.id, 'ws-' + (index + 1)), usedWs),
        title,
        items
      }
    };
  }
  function parseImport(input) {
    let data = input;
    if (typeof input === 'string') {
      try { data = JSON.parse(input); }
      catch (error) { return {error: 'That file is not valid JSON.'}; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.workstreams)) {
      return {error: 'The file needs a workstreams list.'};
    }
    if (data.workstreams.length > 30) return {error: 'Too many workstreams.'};
    const usedWs = new Set();
    const workstreams = [];
    for (let i = 0; i < data.workstreams.length; i++) {
      const result = normaliseWorkstream(data.workstreams[i], i, usedWs);
      if (result.error) return {error: result.error};
      workstreams.push(result.workstream);
    }
    return {state: {workstreams}};
  }
  function fromSeed(seed) {
    const parsed = parseImport(seed);
    if (parsed.error) throw new Error(parsed.error);
    return parsed.state;
  }
  function serialise(state) {
    return JSON.stringify({version: 1, workstreams: (state && state.workstreams) || []}, null, 2);
  }
  function mapItem(state, wsId, itemId, fn) {
    return {
      workstreams: (state.workstreams || []).map((ws) => {
        if (ws.id !== wsId) return ws;
        return Object.assign({}, ws, {items: ws.items.map((item) => item.id === itemId ? fn(item) : item)});
      })
    };
  }
  function setDone(state, wsId, itemId, done) {
    return mapItem(state, wsId, itemId, (item) => {
      const next = Object.assign({}, item, {done: !!done});
      if (next.done) next.status = 'done';
      else if (next.status === 'done') next.status = 'not-started';
      return next;
    });
  }
  function setStatus(state, wsId, itemId, status) {
    if (!STATUS_IDS.includes(status)) return state;
    return mapItem(state, wsId, itemId, (item) => Object.assign({}, item, {status, done: status === 'done'}));
  }
  function setField(state, wsId, itemId, field, value) {
    if (field !== 'notes' && field !== 'owner') return state;
    const clean = field === 'notes'
      ? String(value ?? '').replace(/\r\n/g, '\n').slice(0, 4000)
      : String(value ?? '').slice(0, 120);
    return mapItem(state, wsId, itemId, (item) => Object.assign({}, item, {[field]: clean}));
  }
  function addItem(state, wsId, text, id) {
    const label = String(text ?? '').trim();
    if (!label) return {state, error: 'Add the item text first.'};
    if (label.length > 500) return {state, error: 'Item text is too long.'};
    let found = false;
    const workstreams = state.workstreams.map((ws) => {
      if (ws.id !== wsId) return ws;
      found = true;
      const used = new Set(ws.items.map((item) => item.id));
      const item = {
        id: uniqueId(cleanId(id, makeId('item')), used),
        text: label,
        done: false,
        notes: '',
        owner: '',
        status: 'not-started',
        links: []
      };
      return Object.assign({}, ws, {items: ws.items.concat([item])});
    });
    if (!found) return {state, error: 'That workstream is not on the list.'};
    return {state: {workstreams}, error: ''};
  }
  function deleteItem(state, wsId, itemId) {
    return {
      state: {
        workstreams: state.workstreams.map((ws) => ws.id === wsId
          ? Object.assign({}, ws, {items: ws.items.filter((item) => item.id !== itemId)})
          : ws)
      },
      error: ''
    };
  }
  function addWorkstream(state, title, id) {
    const label = String(title ?? '').trim();
    if (!label) return {state, error: 'Add a workstream name first.'};
    if (label.length > 200) return {state, error: 'Workstream name is too long.'};
    if (state.workstreams.length >= 30) return {state, error: 'Too many workstreams.'};
    const used = new Set(state.workstreams.map((ws) => ws.id));
    const workstream = {id: uniqueId(cleanId(id, makeId('ws')), used), title: label, items: []};
    return {state: {workstreams: state.workstreams.concat([workstream])}, error: ''};
  }
  function deleteWorkstream(state, wsId) {
    return {state: {workstreams: state.workstreams.filter((ws) => ws.id !== wsId)}, error: ''};
  }
  root.ChecklistModel = Object.freeze({
    STATUSES, tally, summarise, parseImport, fromSeed, serialise,
    setDone, setStatus, setField, addItem, deleteItem, addWorkstream, deleteWorkstream
  });
})(typeof window !== 'undefined' ? window : globalThis);
