(() => {
  const D = window.SUPPORT_MAP_DATA;
  const app = document.querySelector('#app');
  const state = { step: 0, selected: {}, other: '', deepOpen: false };
  const groups = Object.fromEntries([...D.steps, ...D.deepDive].map(group => [group.key, group]));
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const picked = key => groups[key].options.filter(option => state.selected[option.id]);
  const labels = key => picked(key).map(option => option.label === 'その他' && state.other.trim() ? `その他（${state.other.trim()}）` : option.label);
  const useful = key => labels(key).filter(label => !/(まだ|思い当たらない|変化は見られない)/.test(label));
  const hasDeepData = () => D.deepDive.some(group => picked(group.key).length > 0);

  function intro() {
    return `<section class="intro"><span class="eyebrow">RELAY MINI TOOL</span><h1>支援の手がかりマップ</h1><p>このツールは、支援の正解を出すものではありません。児童生徒の姿を、前後の状況と合わせて整理し、先生同士で支援の方向を話し合うための整理ツールです。まずは4つの視点から、支援につながりそうな流れを見ていきます。必要に応じて、本人の強みや力を発揮しやすい条件まで詳しく整理できます。</p><aside class="value-note"><b>経験にかかわらず、話し合いの共通言語に</b><span>支援を考える順番を確かめたいときにも、ケース会議で見立てを共有したいときにも使えます。</span></aside><aside class="prototype-notice"><b>試作版について</b><span>これは試作版です。診断や正解を出すものではなく、支援を考えるための整理ツールです。入力内容は保存されません。児童生徒の氏名など、個人が特定される情報は入力しないでください。</span></aside></section>`;
  }

  function stepper(active) {
    const items = ['支援の入口', '今見えている姿', 'きっかけ', 'その後', '結果'];
    return `<nav class="stepper simple-stepper" aria-label="かんたん整理の進み具合">${items.map((name, index) => `<div class="step-item ${index === active ? 'active' : ''} ${index < active ? 'done' : ''}" ${index === active ? 'aria-current="step"' : ''}><span>${index < active ? '✓' : index + 1}</span><b>${esc(name)}</b>${index === active ? '<em>現在</em>' : ''}</div>`).join('')}</nav>`;
  }

  function choices(options) {
    return `<div class="choices">${options.map(option => `<div class="choice ${option.special ? 'special' : ''} ${option.description ? 'has-description' : ''}"><input type="checkbox" id="${option.id}" data-id="${option.id}" ${state.selected[option.id] ? 'checked' : ''}><label for="${option.id}"><span class="check"></span><span><b class="choice-label">${esc(option.label)}</b>${option.description ? `<small class="choice-description">${esc(option.description)}</small>` : ''}</span></label>${option.label === 'その他' ? `<div class="other-field"><label for="otherText">その他の姿を入力してください</label><textarea class="other-input" id="otherText" rows="3" placeholder="個人が特定される情報は入力しないでください">${esc(state.other)}</textarea></div>` : ''}</div>`).join('')}</div>`;
  }

  function optionArea(group) {
    return group.sections
      ? group.sections.map(section => `<div class="choice-category"><h4>${esc(section.title)}</h4>${choices(group.options.slice(section.start, section.start + section.count))}</div>`).join('')
      : choices(group.options);
  }

  function scrollToCurrentStep() {
    requestAnimationFrame(() => document.querySelector('#current-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function renderStep(shouldScroll = true) {
    const step = D.steps[state.step];
    const previous = state.step ? D.steps[state.step - 1].short : '';
    const next = state.step === D.steps.length - 1 ? '結果を見る' : `次へ：${D.steps[state.step + 1].short}`;
    app.innerHTML = intro() + stepper(state.step) + `<section class="card step-card step-theme-${state.step + 1}" id="current-step"><div class="step-heading"><span class="step-icon" aria-hidden="true">${step.icon}</span><div><span class="step-kicker">かんたん整理 ${state.step + 1} / 4</span><h2>${esc(step.title)}</h2></div></div><p class="now-doing">${esc(step.lead)}</p>${optionArea(step)}<div class="group-warning" id="stepWarning" aria-live="polite"></div><div class="action-status">かんたん整理 ${state.step + 1} / 4</div><div class="actions">${state.step ? `<button class="btn btn-secondary" id="prev">前へ：${esc(previous)}</button>` : ''}<span class="hint">当てはまるものを複数選べます。</span><button class="btn btn-primary" id="next">${esc(next)}</button></div></section>`;
    bindStep();
    if (shouldScroll) scrollToCurrentStep();
  }

  function bindChoices(root = document) {
    root.querySelectorAll('[data-id]').forEach(input => input.addEventListener('change', event => {
      state.selected[event.target.dataset.id] = event.target.checked;
      document.querySelector('#stepWarning')?.replaceChildren();
    }));
    root.querySelector('#otherText')?.addEventListener('input', event => { state.other = event.target.value; });
  }

  function bindStep() {
    bindChoices();
    document.querySelector('#prev')?.addEventListener('click', () => { state.step -= 1; renderStep(true); });
    document.querySelector('#next').addEventListener('click', () => {
      const step = D.steps[state.step];
      if (!picked(step.key).length) {
        const warning = document.querySelector('#stepWarning');
        warning.textContent = '当てはまるものを1つ以上選んでください。';
        warning.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (state.step === D.steps.length - 1) renderResult();
      else { state.step += 1; renderStep(true); }
    });
  }

  function resultData() {
    const scores = {};
    const weights = { entrance: 2, visible: 3, before: 4, after: 3, strengths: 2, conditions: 3 };
    Object.entries(groups).forEach(([key]) => picked(key).forEach(option => option.categories.forEach((category, index) => {
      const multiplier = option.categoryWeights?.[category] || 1;
      scores[category] = (scores[category] || 0) + ((weights[key] - index * .55) * multiplier);
    })));
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topCount = ranked[2] && ranked[2][1] >= ranked[0][1] * .62 ? 3 : 2;
    const top = ranked.slice(0, Math.min(4, topCount)).map(([key]) => key);
    const safeTop = top.length ? top : ['outlook', 'communication'];
    const reasons = Object.fromEntries(safeTop.map(key => [key, reasonFor(key)]));
    const primary = buildPrimarySupport(safeTop);
    return { top: safeTop, reasons, primary, relay: [...new Set(safeTop.flatMap(key => D.categories[key].relay))], jiritsu: [...new Set(safeTop.flatMap(key => D.categories[key].jiritsu))] };
  }

  function evidenceFor(category) {
    return ['before', 'visible', 'after', 'entrance'].flatMap(key => picked(key).filter(option => option.categories.includes(category)).map(option => ({ key, label: option.label })));
  }

  function reasonFor(category) {
    const evidence = evidenceFor(category);
    const before = evidence.find(item => item.key === 'before');
    const visible = evidence.find(item => item.key === 'visible');
    const after = evidence.find(item => item.key === 'after');
    if (before) return `「${before.label}」が、その前のきっかけ・状況として選ばれているため。`;
    if (visible) return `「${visible.label}」という姿から、この方向を確かめる価値がありそうなため。`;
    if (after) return `その後に「${after.label}」が起きる流れが選ばれているため。`;
    return `入口として選んだ「${labels('entrance')[0]}」と関係が深い方向のため。`;
  }

  function selectedSupport(category) {
    const specific = [
      [state.selected.a12 && category === 'communication', '困ったときに使える伝え方カードを1つ用意する。'],
      [state.selected.a14 && category === 'environment', '刺激が少ない場所を一つ決め、活動前に本人と確認する。'],
      [(state.selected.a0 || state.selected.a2 || state.selected.a3) && category === 'outlook', '「今すること」と「次にすること」を、一枚のカードで見えるようにする。'],
      [(state.selected.a5 || state.selected.a6) && category === 'difficulty', '課題をまず終えられる一まとまりに減らし、終わりを見えるようにする。'],
      [state.selected.b0 && category === 'relation', '慣れた人と活動場所の入口まで行き、参加の最初の一歩を一緒に決める。'],
      [state.selected.b1 && category === 'difficulty', '最初の一つだけ手本を示し、取りかかれたら支援を減らす。'],
      [state.selected.b23 && category === 'communication', '距離を取りたいときや「やめたい」ときに使える伝え方を一つ決める。'],
      [state.selected.b24 && category === 'safety', '投げても安全な物と、活動から離れる合図をあらかじめ決める。']
    ];
    return specific.find(([match]) => match)?.[1] || `${D.categories[category].supports[0]}。`;
  }

  function buildPrimarySupport(top) {
    const category = top[0];
    const action = selectedSupport(category).replace('。。', '。');
    const before = useful('before')[0];
    const visible = useful('visible')[0];
    const after = useful('after')[0];
    const parts = [];
    if (before) parts.push(`「${before}」のあとに`);
    if (visible) parts.push(`「${visible}」が見られ`);
    if (after) parts.push(`その後「${after}」という流れがあるため`);
    return { category, action, reason: `${parts.join('、')}、${D.categories[category].label}を一つの場面で試すことが手がかりになりそうです。` };
  }

  function flowHtml() {
    const blocks = [['その前のきっかけ・状況', useful('before')], ['今見えている姿', useful('visible')], ['その後に起きていること', useful('after')]];
    return blocks.map(([title, items], index) => `${index ? '<div class="flow-arrow" aria-hidden="true">↓</div>' : ''}<div class="flow-block"><b>${title}</b><p>${items.length ? items.map(item => `「${esc(item)}」`).join('、') : 'まだよく分からない'}</p></div>`).join('');
  }

  function observationPoints(result) {
    const points = ['どの場面で試したか', '支援の前後で本人の姿にどんな変化があったか'];
    if (result.primary.category === 'communication') points.push('気持ちが高まる前に、本人なりの方法で伝えられる場面があったか');
    else if (result.primary.category === 'outlook') points.push('次にすることを自分で確認して動ける場面が増えたか');
    else if (result.primary.category === 'environment') points.push('刺激や場所を変えたとき、参加や落ち着き方に違いがあったか');
    else if (result.primary.category === 'difficulty') points.push('量や始め方を変えたとき、取りかかりや続き方に違いがあったか');
    else points.push('支援を入れた場面と入れない場面で、本人の姿にどんな違いがあったか');
    points.push('うまくいった場面があれば、困りやすい場面と何が違っていたか');
    return points;
  }

  function deepDiveHtml(result) {
    const strengths = useful('strengths'), conditions = useful('conditions');
    if (!hasDeepData()) return '';
    return `<section class="result-section detailed-result"><h3><span>🌿</span>詳しく整理して見えたこと</h3>${strengths.length ? `<div class="detail-item"><b>本人の強みを生かした支援</b><p>${strengths.map(item => `「${esc(item)}」`).join('、')}を、活動の入口や伝え方に生かせそうです。</p></div>` : ''}${conditions.length ? `<div class="detail-item"><b>力を発揮しやすい条件を取り入れた支援</b><p>まず「${esc(conditions[0])}」を一つの場面で整え、姿の変化を比べます。</p></div>` : ''}</section><section class="result-section"><h3><span>🏷</span>関連するRELAY実践タグ</h3><div class="tags">${result.relay.map(item => `<span class="tag">${esc(item)}</span>`).join('')}</div></section><section class="result-section"><h3><span>📘</span>関連しやすい自立活動6区分</h3><div class="tags">${result.jiritsu.map(item => `<span class="tag jiritsu">${esc(item)}</span>`).join('')}</div></section>`;
  }

  function needsBodyNote(result) {
    return state.selected.s1_10 || state.selected.b31 || state.selected.b32 || state.selected.b33 || result.top.includes('body');
  }

  function deepDiveForm() {
    return `<section class="deep-dive ${state.deepOpen ? 'is-open' : ''}" id="deepDive"><div class="deep-dive-intro"><span class="deep-kicker">もっと詳しく整理する</span><h3>強みや条件も整理する</h3><p>本人の強みや、うまくいきやすい条件まで整理すると、支援の方向をより具体的にできます。分かる範囲で追加してみましょう。</p><button class="btn btn-secondary" id="toggleDeep" aria-expanded="${state.deepOpen}">${state.deepOpen ? '深掘り項目を閉じる' : '強みや条件も整理する'}</button></div>${state.deepOpen ? `<div class="deep-fields">${D.deepDive.map((group, index) => `<section class="deep-group"><div class="deep-heading"><span class="deep-number">${index + 5}</span><div><h4>${esc(group.title)}</h4><p>${esc(group.lead)}</p></div></div>${optionArea(group)}</section>`).join('')}<button class="btn btn-primary update-result" id="updateResult">詳しい結果に更新する</button></div>` : ''}</section>`;
  }

  function copyText(result) {
    const lines = ['【支援の手がかりマップ】', '', '【この結果の使い方】', 'この結果は、選択内容をもとにした支援の手がかりです。', '診断や決めつけではありません。', '校内で話し合うときや、明日試す支援を考えるときの整理メモとして使ってください。', '', '【ここまでの整理】', `支援を考えたいこと：${labels('entrance').join('、')}`, '', '【今回見えている流れ】', useful('before').join('、') || 'まだよく分からない', '↓', useful('visible').join('、') || 'まだよく分からない', '↓', useful('after').join('、') || 'まだよく分からない', '', '【支援の手がかり】'];
    result.top.forEach(key => lines.push(`・${D.categories[key].label}`, `理由：${result.reasons[key]}`, ''));
    lines.push('【まず試すなら】', result.primary.action, '', '理由：', result.primary.reason, '', '【試したあとに見るポイント】', ...observationPoints(result).map(point => `・${point}`));
    if (hasDeepData()) {
      lines.push('', '【もっと詳しく整理した内容】');
      if (useful('strengths').length) lines.push(`本人の強み：${useful('strengths').join('、')}`);
      if (useful('conditions').length) lines.push(`力を発揮しやすい条件：${useful('conditions').join('、')}`);
      lines.push('', '【関連するRELAY実践タグ】', ...result.relay.map(item => `・${item}`), '', '【関連しやすい自立活動6区分】', ...result.jiritsu.map(item => `・${item}`));
    }
    if (needsBodyNote(result)) lines.push('', '【姿勢・移動・体の使い方に関する確認】', D.bodyNotice);
    return lines.join('\n');
  }

  function bindResult(result) {
    document.querySelector('#back').addEventListener('click', () => { state.step = 3; renderStep(true); });
    document.querySelector('#restart').addEventListener('click', () => { state.step = 0; state.selected = {}; state.other = ''; state.deepOpen = false; renderStep(true); });
    document.querySelector('#toggleDeep').addEventListener('click', () => { state.deepOpen = !state.deepOpen; renderResult('#deepDive'); });
    bindChoices(document.querySelector('#deepDive'));
    document.querySelector('#updateResult')?.addEventListener('click', () => renderResult('#current-step'));
    document.querySelector('#copy').addEventListener('click', async () => {
      const text = copyText(result);
      try { await navigator.clipboard.writeText(text); }
      catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      document.querySelector('#copyStatus').textContent = '結果をコピーしました。記録や校内共有に貼り付けられます。';
    });
  }

  function renderResult(scrollTarget = '#current-step') {
    const result = resultData();
    const points = observationPoints(result);
    app.innerHTML = intro() + `<section class="card result-card step-card step-theme-5" id="current-step"><div class="step-heading"><span class="step-icon" aria-hidden="true">🔎</span><div><span class="step-kicker">かんたん整理の結果</span><h2>支援の手がかり</h2></div></div><p class="now-doing">答えを決めるのではなく、この流れを先生同士で見ながら、まず一つ試す支援を考えます。</p><div class="results-grid"><aside class="usage-note"><h3>この結果の使い方</h3><p>この結果は、選択内容をもとにした支援の手がかりです。診断や決めつけではありません。校内で話し合うときや、明日試す支援を考えるときの整理メモとして使ってください。</p></aside><section class="result-section flow-section"><h3><span>↳</span>今回見えている流れ</h3><p class="block-role">前後の状況を一緒に見ることが、このツールの中心です。</p><div class="flow">${flowHtml()}</div></section><section class="result-section"><h3><span>🔎</span>支援の手がかり</h3><ul class="category-list reason-list">${result.top.map(key => `<li><b>${esc(D.categories[key].label)}</b><small>理由：${esc(result.reasons[key])}</small></li>`).join('')}</ul></section><section class="result-section tomorrow-section"><div class="goal-label">まず一つから</div><h3><span>🌱</span>まず試すなら</h3><p class="primary-action">${esc(result.primary.action)}</p><div class="support-reason"><b>理由</b><p>${esc(result.primary.reason)}</p></div></section><section class="result-section"><h3><span>👀</span>試したあとに見るポイント</h3><ul class="observation-list">${points.map(point => `<li>${esc(point)}</li>`).join('')}</ul></section>${deepDiveHtml(result)}${needsBodyNote(result) ? `<aside class="expert-note"><b>姿勢・移動・体の使い方に関する確認</b><p>${esc(D.bodyNotice)}</p></aside>` : ''}</div>${deepDiveForm()}<div class="copy-panel"><div><b>校内の記録や共有に</b><small>画面と同じ流れ・改行でコピーします。</small></div><button class="btn btn-copy" id="copy">結果をコピー</button></div><div class="copy-status" id="copyStatus" aria-live="polite"></div><div class="actions"><button class="btn btn-secondary" id="back">前へ：その後のこと</button><button class="btn btn-secondary" id="restart">はじめから整理する</button></div></section>`;
    document.querySelector('#current-step').insertAdjacentHTML('beforebegin', stepper(4));
    bindResult(result);
    requestAnimationFrame(() => document.querySelector(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  if (window.__SUPPORT_MAP_TEST_MODE__) {
    window.SUPPORT_MAP_TEST = { generate(selected = {}, other = '') { state.selected = { ...selected }; state.other = other; const result = resultData(); return { result, copy: copyText(result) }; } };
  } else renderStep(false);
})();
