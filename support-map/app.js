(() => {
  const D=window.SUPPORT_MAP_DATA, app=document.querySelector('#app');
  const state={step:0,selected:{},other:''};
  const groups=Object.fromEntries(D.steps.flatMap(s=>s.groups).map(g=>[g.key,g]));
  const allOptions=D.steps.flatMap(s=>s.groups.flatMap(g=>g.options));
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const picked=key=>groups[key].options.filter(o=>state.selected[o.id]);
  const labels=key=>picked(key).map(o=>o.label==='その他'&&state.other?`その他（${state.other}）`:o.label);
  const quote=(items,max=2)=>items.slice(0,max).map(x=>`「${x}」`).join('、');

  function intro(){return `<section class="intro"><span class="eyebrow">RELAY MINI TOOL</span><h1>支援の手がかりマップ</h1><p>支援を考えたいことを入口に、今見えている姿、背景、強み、力を発揮しやすい条件を整理し、明日試せそうな手がかりにつなげます。診断ではなく、支援を考えるための整理に活用してください。</p><aside class="prototype-notice"><b>試作版について</b><span>これは試作版です。診断や正解を出すものではなく、支援を考えるための整理ツールです。入力内容は保存されません。児童生徒の氏名など、個人が特定される情報は入力しないでください。</span></aside></section>`}
  function stepper(active){const items=[...D.steps.map(s=>({name:s.short,icon:s.icon})),{name:'支援の手がかり',icon:'🔎'}];return `<nav class="stepper" aria-label="5段階の進み具合">${items.map((item,i)=>`<div class="step-item ${i===active?'active':''} ${i<active?'done':''}" ${i===active?'aria-current="step"':''}><span>${i<active?'✓':i+1}</span><b>${item.name}</b>${i===active?'<em>現在</em>':''}</div>`).join('')}</nav>`}
  function progress(n){return `<div class="progress-meta"><span>${n===4?'ここまでの整理ができました':`ステップ ${n+1} / 5`}</span><span>${n===4?'支援の手がかり':D.steps[n].short}</span></div>`}
  function choices(options){return `<div class="choices">${options.map(o=>`<div class="choice ${o.special?'special':''} ${o.description?'has-description':''}"><input type="checkbox" id="${o.id}" data-id="${o.id}" ${state.selected[o.id]?'checked':''}><label for="${o.id}"><span class="check"></span><span><b class="choice-label">${esc(o.label)}</b>${o.description?`<small class="choice-description">${esc(o.description)}</small>`:''}</span></label>${o.label==='その他'?`<div class="other-field"><label for="otherText">その他の姿を入力してください</label><textarea class="other-input" id="otherText" rows="3" placeholder="例：机の下に入る、耳をふさいで廊下に出ようとする、同じ質問を繰り返す など">${esc(state.other)}</textarea></div>`:''}</div>`).join('')}</div>`}
  function groupBlock(g){const optionArea=g.sections?g.sections.map(s=>`<div class="choice-category"><h4>${esc(s.title)}</h4>${choices(g.options.slice(s.start,s.start+s.count))}</div>`).join(''):choices(g.options);return `<section class="section-block" data-group="${g.key}">${g.title?`<div class="question-head"><span class="substep">${g.icon||g.number}</span><div><h3>${esc(g.title)}</h3><p class="question">${esc(g.question)}</p>${g.helper?`<p class="group-helper">${esc(g.helper)}</p>`:''}</div></div>`:''}${optionArea}<div class="group-warning" data-warning="${g.key}" aria-live="polite"></div></section>`}
  function scrollToCurrentStep(){requestAnimationFrame(()=>document.querySelector('#current-step')?.scrollIntoView({behavior:'smooth',block:'start'}))}
  function renderStep(shouldScroll=true){const s=D.steps[state.step],previous=state.step?D.steps[state.step-1].short:'';app.innerHTML=intro()+stepper(state.step)+progress(state.step)+`<section class="card step-card step-theme-${state.step+1}" id="current-step"><div class="step-heading"><span class="step-icon" aria-hidden="true">${s.icon}</span><div><span class="step-kicker">STEP ${state.step+1}</span><h2>${esc(s.title)}</h2></div></div><p class="now-doing">${esc(s.instruction)}</p><p class="lead">${esc(s.lead)}</p>${s.groups.map(groupBlock).join('')}<div class="action-status">ステップ ${state.step+1} / 5</div><div class="actions">${state.step?`<button class="btn btn-secondary" id="prev">前へ：${esc(previous)}に戻る</button>`:''}<span class="hint">当てはまるものを複数選べます。</span><button class="btn btn-primary" id="next">次へ：${esc(s.nextLabel)}</button></div></section>`;bind();if(shouldScroll)scrollToCurrentStep()}
  function bind(){document.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('change',e=>{state.selected[e.target.dataset.id]=e.target.checked;e.target.closest('.section-block').querySelector('.group-warning').textContent=''}));document.querySelector('#otherText')?.addEventListener('input',e=>state.other=e.target.value);document.querySelector('#prev')?.addEventListener('click',()=>{state.step--;renderStep(true)});document.querySelector('#next').addEventListener('click',()=>{const missing=D.steps[state.step].groups.filter(g=>!g.options.some(o=>state.selected[o.id]));if(missing.length){missing.forEach(g=>document.querySelector(`[data-warning="${g.key}"]`).textContent='この問いで当てはまるものを1つ以上選んでください。');document.querySelector(`[data-group="${missing[0].key}"]`).scrollIntoView({behavior:'smooth',block:'center'});return}state.step++;state.step===4?renderResult():renderStep(true)})}

  function resultData(){
    const scores={},weights={entrance:2,visible:3,before:4,after:3,lessLikely:4,strengths:2,conditions:3};
    Object.entries(groups).forEach(([key,g])=>g.options.filter(o=>state.selected[o.id]).forEach(o=>o.categories.forEach((c,i)=>{const base=weights[key]-(i*.6),multiplier=o.categoryWeights?.[c]||1;scores[c]=(scores[c]||0)+(base*multiplier)})));
    const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const count=ranked.length<=2?ranked.length:(ranked[2][1]>=ranked[0][1]*.58?3:2);
    const top=ranked.slice(0,Math.min(4,count||3)).map(x=>x[0]);
    const safeTop=top.length?top:['outlook','communication'];
    const relay=[...new Set(safeTop.flatMap(k=>D.categories[k].relay))];
    const jiritsu=[...new Set(safeTop.flatMap(k=>D.categories[k].jiritsu))];
    const supports=buildSupports(safeTop);
    return{top:safeTop,relay,jiritsu,supports,memo:buildMemo(safeTop),thinkingMemo:buildThinkingMemo()};
  }
  function useful(key){return labels(key).filter(x=>!/(まだ|思い当たらない|変化は見られない)/.test(x))}
  function functionHint(){const funcs=[...new Set(picked('after').map(o=>o.behaviorFunction).filter(x=>x&&x!=='unknown'))];const hints={avoidance:'その姿のあとに活動や負担から離れたり、待ってもらえたりする流れがあります。今の要求が大きすぎないか、休憩や助けを早めに選べるかを見るとよさそうです。',attention:'その姿をきっかけに人との関わりが増える流れがあります。関わりを求める別の伝え方や、落ち着いた場面で関われる機会が手がかりになりそうです。',access:'その姿のあとに、希望するものや助けにつながる流れがあります。要求や「分からない」を、本人が使いやすい方法で早めに伝えられるようにすることが役立ちそうです。',sensory:'その姿自体が、本人なりに刺激や気持ちを整えることにつながっている可能性もあります。安全に調整できる別の方法や環境を一緒に探せそうです。'};return funcs.slice(0,2).map(f=>hints[f]).join(' ')}
  function situationHint(){return [state.selected.a12?'この姿は、伝えたいことがうまく伝わらない負担の表れとして捉えることもできそうです。':'',state.selected.a7?'待つ時間の長さや見通しのもちにくさが、気持ちの高まりにつながっている可能性があります。':'',state.selected.a5?'取り組みにくさの背景には、課題の量や難しさ、始め方の分かりにくさが関係しているかもしれません。':'',state.selected.a14?'周囲の刺激の多さが、本人にとって大きな負担になっていた可能性があります。':''].filter(Boolean).join(' ')}
  function buildMemo(top){
    const entrance=useful('entrance'),visible=useful('visible'),before=useful('before'),after=useful('after'),less=useful('lessLikely'),strength=useful('strengths'),condition=useful('conditions');
    const evidence=[...visible.slice(0,2),...before.slice(0,1),...after.slice(0,1)];
    const lead=evidence.length?`${quote(evidence,4)}が選ばれています。`:'まだ分からないところを含めて、現時点で見えていることから整理しました。';
    const flow=before.length&&visible.length?`${quote(before)} → ${quote(visible)}${after.length?` → ${quote(after)}`:''}という流れが見えています。`:visible.length?`${quote(visible)}について、前後の状況をもう少し観察すると、流れが見えやすくなりそうです。`:'分からない項目は、次に似た場面が起きたときの観察ポイントとして残しておけます。';
    const background=before.length&&visible.length?'行動だけを見るのではなく、その前後の状況と合わせることで、場面の分かりにくさや負担を伝えるサインとして捉えることもできそうです。':'その場の姿だけで判断せず、場所・人・課題・刺激・体調などを少しずつ確かめると、支援の方向が見えやすくなります。';
    const contrast=less.length?`一方、${quote(less)}にはその姿が見られにくいとのことです。困る場面との違いは、本人が力を発揮するための条件を考える大切な手がかりです。`:'';
    const resource=strength.length?`${quote(strength)}という本人の強みを、${condition.length?quote(condition):'取り組みやすい環境'}と組み合わせて生かすことができそうです。`:condition.length?`${quote(condition)}をまず一つ整え、変化を確かめることから始められそうです。`:'';
    const distinction=state.selected.b0&&state.selected.b1?'「活動の場に入ること」と「活動に入った後に取りかかること」の両方に時間が必要なようです。入口の安心や環境を整える支援と、始め方や課題量を分かりやすくする支援を分けて試すと、どこで負担が高まるかを確かめやすくなりそうです。':state.selected.b0?'「活動の場に入りにくい」という姿は、課題を始める前の参加の入口で見られています。取りかかりだけを促すより、活動場所への入り方、安心できる導入、刺激量、安心できる人との関わりを整えることが手がかりになりそうです。':state.selected.b1?'「活動に入っても始めにくい」という姿は、参加できていないのではなく、取りかかるまでの段階で見られています。最初の手順や見本、課題量、終わりの見通し、興味とのつながりを調整すると動き出しやすくなる可能性があります。':'';
    const specificViews=[state.selected.b9?'「固まる」姿は、動きが止まるだけでなく、声かけに反応しにくくなる状態として見られることもあります。言葉を重ねるより、短い言葉や見える手がかりに切り替えることが支援につながりそうです。':'',state.selected.b23?'「手が出る」姿については、人との距離や関わり方、気持ちの高まり、要求や拒否の伝え方を前後の状況と合わせて見ると、より安全な伝え方を考える手がかりになりそうです。':'',state.selected.b24?'「物を投げる」姿については、物の扱いと安全を整えながら、活動から離れたいときや刺激を調整したいときに使える別の方法を用意することが手がかりになりそうです。':''].filter(Boolean).join(' ');
    const view=D.categories[top[0]].interpretation;
    const start=entrance.length?`${quote(entrance,1)}を入口に整理しました。`:'';
    const other=state.selected.b34&&state.other.trim()?`その他として「${state.other.trim()}」という姿も挙げられています。この姿は選択肢だけでは整理しきれない可能性があるため、前後の状況や、見られにくい場面と合わせて考えていきましょう。`:'';
    const paragraph1=[start,lead].filter(Boolean).join(' ');
    const paragraph2=[flow,distinction,specificViews].filter(Boolean).join(' ');
    const paragraph3=[background,situationHint(),functionHint(),view].filter(Boolean).join(' ');
    const paragraph4=contrast||'「その姿が見られにくい場面」は、今後の観察で見つけていけます。困る場面との違いが、支援の手がかりになります。';
    const paragraph5=[resource,other].filter(Boolean).join(' ')||'本人の強みと、力を発揮しやすい条件を一つずつ確かめながら支援につなげていきます。';
    return [paragraph1,paragraph2,paragraph3,paragraph4,paragraph5].filter(Boolean);
  }
  function buildThinkingMemo(){return{paragraphs:['同じ姿でも、背景は一人ひとり違います。この整理は、正解や診断を示すものではありません。','一度に多くを変えず、まず一つの支援を試します。実際の姿を見ながら、続けること・変えることを少しずつ考えてください。'],bullets:['支援を試した場面と時間','その前後で見られた変化','本人が落ち着いた、伝えられた、参加できた場面']}}
  function buildSupports(top){
    const condition=useful('conditions')[0],strength=useful('strengths')[0],less=useful('lessLikely')[0];
    const base=[...new Set(top.flatMap(k=>D.categories[k].supports.slice(0,2)))].slice(0,5);
    if(condition)base.unshift(`まず「${condition}」を一つの場面で整え、姿の変化を比べてみる`);
    if(strength)base.push(`「${strength}」を活動の入口や声かけに生かす`);
    if(less)base.push(`「${less}」と困りやすい場面の違いを短く記録する`);
    return [...new Set(base)].slice(0,7);
  }
  const summaryLabels={entrance:'支援を考えたいこと',visible:'今見えている姿',before:'その前のきっかけ・状況',after:'その後に起きていること',lessLikely:'その姿が見られにくい場面',strengths:'生かせそうな強み',conditions:'力を発揮しやすい条件'};
  function summaryRows(){return Object.entries(summaryLabels).map(([key,label])=>`<div class="summary-row"><b>${label}</b><span>${labels(key).map(esc).join('／')}</span></div>`).join('')}
  function needsBodyNote(r){return state.selected.s1_10||state.selected.b31||state.selected.b32||state.selected.b33||r.top.includes('body')}
  const resultUsage='この結果は、選択内容をもとにした支援の手がかりです。診断や決めつけではありません。校内で話し合うときや、明日試す支援を考えるときの整理メモとして使ってください。';
  function copyText(r){const summary=Object.entries(summaryLabels).flatMap(([key,label])=>[`${label}：`,...labels(key).map(x=>'・'+x),'']);const lines=['支援の手がかりマップ','','【この結果の使い方】',resultUsage,'','【ここまでの整理】',...summary,'【見立てメモ】',r.memo.join('\n\n'),'','【支援の手がかり】',...r.top.map(k=>'・'+D.categories[k].label),'','【明日試せそうな支援】',...r.supports.map(x=>'・'+x),'','【関連するRELAY実践タグ】',...r.relay.map(x=>'・'+x),'','【関連しやすい自立活動6区分】',...r.jiritsu.map(x=>'・'+x),'','【支援を考えるときのメモ】',r.thinkingMemo.paragraphs.join('\n\n'),'','確認しておきたいこと',...r.thinkingMemo.bullets.map(x=>'・'+x)];if(needsBodyNote(r))lines.push('',D.bodyNotice);return lines.join('\n')}
  function renderResult(){
    const r=resultData(),bodyNote=needsBodyNote(r);
    const otherNote=state.selected.b34&&state.other.trim()?`<aside class="other-note"><b>その他として入力された姿</b><blockquote>「${esc(state.other.trim())}」</blockquote><p>この姿については、選択肢だけでは整理しきれない可能性があります。前後の状況や、見られにくい場面と合わせて、支援の手がかりを考えていきましょう。</p></aside>`:'';
    app.innerHTML=intro()+stepper(4)+progress(4)+`<section class="card result-card step-card step-theme-5" id="current-step"><div class="step-heading"><span class="step-icon" aria-hidden="true">🔎</span><div><span class="step-kicker">STEP 5</span><h2>ここまでの整理から、支援の手がかりへ</h2></div></div><p class="now-doing">ここまでの整理から、明日試せそうな支援の手がかりを確認します。</p><div class="results-grid"><aside class="usage-note result-block"><h3>この結果の使い方</h3><p>${esc(resultUsage)}</p></aside><section class="result-section"><h3><span>📋</span>ここまでの整理</h3><div class="summary-list">${summaryRows()}</div></section><section class="result-section memo-section"><h3><span>📝</span>見立てメモ</h3><div class="memo-paragraphs">${r.memo.map(p=>`<p>${esc(p)}</p>`).join('')}</div></section>${otherNote}<section class="result-section"><h3><span>🔎</span>支援の手がかり</h3><p class="block-role">支援の方向として、次の手がかりが考えられます。</p><ul class="category-list">${r.top.map(k=>`<li><b>${esc(D.categories[k].label)}</b></li>`).join('')}</ul></section><section class="result-section tomorrow-section"><div class="goal-label">このマップのゴール</div><h3><span>🌱</span>明日試せそうな支援</h3><p class="block-role">まず一つ、取り入れやすいものから試してみます。</p><ul class="support-list">${r.supports.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="result-section"><h3><span>🏷</span>関連するRELAY実践タグ</h3><div class="tags">${r.relay.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div></section><section class="result-section"><h3><span>📘</span>関連しやすい自立活動6区分</h3><div class="tags">${r.jiritsu.map(x=>`<span class="tag jiritsu">${esc(x)}</span>`).join('')}</div></section>${bodyNote?`<aside class="expert-note"><b>姿勢・移動・体の使い方に関する確認</b><p>${esc(D.bodyNotice)}</p></aside>`:''}<section class="notice thinking-note"><b>💬　支援を考えるときのメモ</b>${r.thinkingMemo.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<p class="note-label">確認しておきたいこと</p><ul>${r.thinkingMemo.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div><div class="copy-panel"><div><b>校内の記録や共有に</b><small>画面と同じ段落・箇条書きでコピーします。</small></div><button class="btn btn-copy" id="copy">結果をコピー</button></div><div class="copy-status" id="copyStatus" aria-live="polite"></div><div class="action-status">ステップ 5 / 5</div><div class="actions"><button class="btn btn-secondary" id="back">前へ：条件に戻る</button><button class="btn btn-secondary" id="restart">はじめから整理する</button></div></section>`;
    document.querySelector('#back').onclick=()=>{state.step=3;renderStep(true)};document.querySelector('#restart').onclick=()=>{state.step=0;state.selected={};state.other='';renderStep(true)};document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(copyText(r))}catch{const ta=document.createElement('textarea');ta.value=copyText(r);document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}document.querySelector('#copyStatus').textContent='結果をコピーしました。記録や校内共有に貼り付けられます。'};scrollToCurrentStep();
  }
  if(window.__SUPPORT_MAP_TEST_MODE__){window.SUPPORT_MAP_TEST={generate(selected={},other=''){state.selected={...selected};state.other=other;const result=resultData();return{result,copy:copyText(result)}}}}else{renderStep(false)}
})();
