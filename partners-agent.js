/* Ask Partners: one tool-using agent over the loaded MECE data. No second chat, no invented facts. */
(function () {
  'use strict';
  const KEY = 'partnersAgentHistory';
  const SUGGESTIONS = [
    'Who has a published landlord route in Manchester?',
    'Compare Stepping Stone Projects and CCP',
    'Which opportunities have no linked demand?',
    'Why is the core score not calculated?',
    'Draft a screening note for Salix Homes',
    'Top 10 commercial operators'
  ];
  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (error) { history = []; }
  const fab = document.createElement('button');
  fab.id = 'ask-fab';
  fab.type = 'button';
  fab.textContent = 'Ask Partners';
  const pane = document.createElement('div');
  pane.id = 'ask-pane';
  pane.className = 'hidden';
  pane.innerHTML = '<div id="ask-hd"><b>Ask Partners</b><span><button type="button" id="ask-clear">Clear</button> <button type="button" id="ask-x">Close</button></span></div><div id="ask-log"></div><form id="ask-f"><textarea id="ask-q" maxlength="1400" placeholder="Ask about a counterparty, opportunity, framework or sheet"></textarea><button type="submit" id="ask-go">Ask</button></form><p class="foot" style="padding:0 12px 8px">Screening research, not an investment recommendation or credit approval. Answers use the loaded files only.</p>';
  document.body.append(fab, pane);
  const log = pane.querySelector('#ask-log');
  const input = pane.querySelector('#ask-q');
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-16))); } catch (error) {} }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function draw(extra) {
    log.innerHTML = '';
    if (!history.length && !extra) {
      log.innerHTML = '<div class="ask-m ask-a"><div class="ask-tools">Tools search the counterparties, opportunities, frameworks and workbook already on this page.</div>Ask a question. I will cite the record and I will not fill a blank score, rent or name.</div><div class="ask-sug">' + SUGGESTIONS.map((item) => '<button type="button" class="ask-cite">' + esc(item) + '</button>').join('') + '</div>';
      log.querySelectorAll('.ask-sug button').forEach((button) => button.onclick = () => ask(button.textContent));
      return;
    }
    for (const message of history) {
      const block = document.createElement('div');
      block.className = 'ask-m ' + (message.role === 'user' ? 'ask-u' : 'ask-a');
      if (message.role === 'user') block.textContent = message.content;
      else {
        block.innerHTML = (message.trace ? '<div class="ask-tools">Used: ' + esc(message.trace.join(', ')) + '</div>' : '') + esc(message.content) + (message.citations || []).map((cite, index) => '<button type="button" class="ask-cite" data-i="' + index + '">' + esc(cite.label || cite.view) + '</button>').join('') + (message.actions || []).filter((action) => !action.auto).map((action, index) => '<button type="button" class="ask-cite" data-a="' + index + '">Open ' + esc(action.view || 'record') + '</button>').join('');
        block.querySelectorAll('[data-i]').forEach((button) => button.onclick = () => apply(Object.assign({auto:true}, message.citations[button.dataset.i] || {})));
        block.querySelectorAll('[data-a]').forEach((button) => button.onclick = () => apply(message.actions[button.dataset.a]));
      }
      log.appendChild(block);
    }
    if (extra) { const wait = document.createElement('div'); wait.className = 'ask-m ask-a'; wait.textContent = extra; log.appendChild(wait); }
    log.scrollTop = log.scrollHeight;
  }
  function apply(action) {
    if (!action || !window.PartnersHub) return;
    PartnersHub.open(action);
  }
  async function ask(text) {
    text = String(text || '').trim();
    if (!text) return;
    history.push({role:'user', content:text});
    draw('Checking the loaded records...');
    pane.querySelector('#ask-go').disabled = true;
    try {
      await PartnersHub.ensure();
      const result = PartnersMece.answer(text, PartnersHub.context());
      history.push({role:'assistant', content:result.text, trace:result.trace, citations:result.citations, actions:result.actions});
      for (const action of result.actions || []) if (action.auto) apply(action);
    } catch (error) {
      history.push({role:'assistant', content:'The records could not be read: ' + error.message, trace:['error'], citations:[], actions:[]});
    }
    pane.querySelector('#ask-go').disabled = false;
    save();
    draw();
  }
  fab.onclick = () => { pane.classList.toggle('hidden'); if (!pane.classList.contains('hidden')) { draw(); input.focus(); } };
  pane.querySelector('#ask-x').onclick = () => pane.classList.add('hidden');
  pane.querySelector('#ask-clear').onclick = () => { history = []; save(); draw(); };
  pane.querySelector('#ask-f').onsubmit = (event) => { event.preventDefault(); const text = input.value; input.value = ''; ask(text); };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); pane.querySelector('#ask-f').requestSubmit(); } });
  window.AskPartners = {ask, open() { pane.classList.remove('hidden'); draw(); }};
})();
