/* =============================================================================
 * jobbar.js — いま走っている仕事を、工程タブの下にずっと出しておく
 *
 * なぜ要るか（2026-11-04 の見直し）:
 *   絵づくりは直近90件の平均が58.1分、最長52時間。それだけ待たせるのに、
 *   進み具合を見せているのは App.watchJob のポップアップだけで、
 *   閉じると「いま何枚できたか」「あと何分か」を見る場所がなかった。
 *   実行者は押したあと、席を立っていいのか分からない。
 *
 * 決めごと（利用者と詰めたもの）:
 *   - 置き場は工程タブの直下。全画面で同じものが出る
 *   - ブラウザの記憶ではなく **DBから組み直す**。閉じて戻っても、
 *     別のPCで開いても同じ帯が出る
 *   - まとめ生成は1回の操作で何件も積まれるので、**束で1行**にまとめる。
 *     層（A〜E）が複数走っているときだけ層ごとに分ける
 *   - 帯から中止できる。いまはポップアップを閉じると止める手段が無かった
 *   - ふだんは消える。終わった直後だけ30秒出して消える
 *   - 絵づくりだけでなく、時間のかかる仕事すべてを出す
 *
 * ブラウザ: window.LpyaJobBar.start(App) / .stop()
 * ========================================================================== */
(function (global) {
  'use strict';

  var ROOT_ID = 'jobbar-root';
  var POLL_BUSY_MS = 6000;
  var POLL_IDLE_MS = 15000;
  var DONE_SHOW_MS = 30000;
  var LIVE = ['pending', 'processing'];

  var App = null;
  var timer = null;
  var root = null;
  /* いま出している束。鍵 → { label, ids, featureKey, startedAt } */
  var groups = {};
  /* 終わった束を、消えるまでのあいだ出しておく。鍵 → { label, until, kind } */
  var finished = {};
  /* 生成物の層（A〜E）の覚え書き。generation_id → ラベル */
  var variantOf = {};
  var asking = false;
  /* 絵の作り先の状態（058 の1行）。読むだけ。10分より古ければ灰色 */
  var maker = null;
  var makerAt = 0;

  function t(key, params) {
    return (App && typeof App.t === 'function') ? App.t(key, params) : key;
  }

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function payloadOf(job) {
    var p = job && job.payload;
    if (!p) { return {}; }
    if (typeof p === 'object') { return p; }
    try { return JSON.parse(p) || {}; } catch (e) { return {}; }
  }

  /* 束の鍵。同じ案件・同じ種類・同じ層を1本にまとめる。
     層が分からないものは種類だけでまとめる */
  function keyOf(job) {
    var gen = payloadOf(job).generation_id || '';
    var label = gen ? (variantOf[gen] || '') : '';
    return [job.projects_id || '-', job.feature_key || '-', label].join('|');
  }

  function labelOf(job) {
    var gen = payloadOf(job).generation_id || '';
    var label = gen ? (variantOf[gen] || '') : '';
    var name = t('job.kind.' + String(job.feature_key || ''));
    /* 文言表に無い種類は、鍵そのものを出す（出ないよりまし） */
    if (name === 'job.kind.' + String(job.feature_key || '')) { name = String(job.feature_key || ''); }
    return label ? t('jobbar.withVariant', { v: label, name: name }) : name;
  }

  /* 層のラベルを引く。鍵が増えたときだけ取りに行く */
  function learnVariants(jobs) {
    if (asking) { return Promise.resolve(); }
    var want = [];
    jobs.forEach(function (job) {
      var gen = payloadOf(job).generation_id;
      if (gen && variantOf[gen] === undefined && want.indexOf(gen) === -1) { want.push(gen); }
    });
    if (!want.length) { return Promise.resolve(); }
    asking = true;
    return global.Api.generations.list({
      in: { id: want }, select: 'id,variant_label', order: false, limit: 50
    }).then(function (rows) {
      (rows || []).forEach(function (row) { variantOf[row.id] = String(row.variant_label || ''); });
      /* 取れなかったものも覚える。毎回聞きに行かないため */
      want.forEach(function (id) { if (variantOf[id] === undefined) { variantOf[id] = ''; } });
    }, function () {
      want.forEach(function (id) { variantOf[id] = ''; });
    }).then(function () { asking = false; }, function () { asking = false; });
  }

  function gather(jobs) {
    var out = {};
    jobs.forEach(function (job) {
      var key = keyOf(job);
      var g = out[key];
      if (!g) {
        g = out[key] = { key: key, label: labelOf(job), featureKey: job.feature_key,
          ids: [], done: 0, total: 0, note: '', startedAt: 0, running: 0 };
      }
      g.ids.push(job.id);
      g.done += Number(job.progress_done) || 0;
      g.total += Number(job.progress_total) || 0;
      if (job.status === 'processing') { g.running += 1; }
      if (job.progress_note && !g.note) { g.note = String(job.progress_note); }
      var at = job.created_at ? new Date(job.created_at).getTime() : 0;
      if (at && (!g.startedAt || at < g.startedAt)) { g.startedAt = at; }
    });
    return out;
  }

  /* 終わった束を知らせる。全部中止なら知らせない（押した人が止めたので） */
  function announce(gone) {
    var ids = gone.ids || [];
    if (!ids.length) { return; }
    global.Api.generationJobs.list({
      in: { id: ids }, select: 'id,status', order: false, limit: 50
    }).then(function (rows) {
      var list = rows || [];
      var ok = list.filter(function (r) { return r.status === 'done'; }).length;
      var ng = list.filter(function (r) { return r.status === 'failed' || r.status === 'error'; }).length;
      if (!ok && !ng) { return; }                /* 全部中止 */
      finished[gone.key] = {
        label: gone.label,
        kind: ng && !ok ? 'ng' : 'ok',
        text: ng ? t('jobbar.doneSome', { name: gone.label, n: ok, ng: ng })
          : t('jobbar.doneAll', { name: gone.label }),
        until: Date.now() + DONE_SHOW_MS
      };
      notify(ng && !ok ? t('jobbar.notifyNg', { name: gone.label })
        : t('jobbar.notifyOk', { name: gone.label }));
      paint();
    }, function () { /* 聞けなければ、黙って消える */ });
  }

  /* アプリの外への知らせ。いまはブラウザの通知だけ（メールは別の回に） */
  function notify(text) {
    try {
      if (!('Notification' in global)) { return; }
      if (global.Notification.permission === 'granted') {
        new global.Notification('エルピーヤ', { body: text, tag: 'lpya-job' });
      }
    } catch (e) { /* 通知が使えない環境では、帯だけで知らせる */ }
  }

  function askNotifyOnce() {
    try {
      if (!('Notification' in global)) { return; }
      if (global.Notification.permission === 'default') { global.Notification.requestPermission(); }
    } catch (e) { /* 無視 */ }
  }

  function elapsedMin(startedAt) {
    if (!startedAt) { return 0; }
    return Math.max(0, Math.round((Date.now() - startedAt) / 60000));
  }

  function rowFor(g) {
    var row = el('div', 'jobbar__row');
    var head = el('div', 'jobbar__head');
    head.appendChild(el('span', 'jobbar__name', g.label));
    if (g.total) {
      head.appendChild(el('span', 'jobbar__count', g.done + ' / ' + g.total));
    }
    row.appendChild(head);

    var track = el('div', 'jobbar__track');
    var fill = el('div', 'jobbar__fill');
    /* 段数が分からないうちは、割合ではなく流れる帯にする。
       0% のまま止めると、始まっていないように見える */
    if (g.total) {
      fill.style.width = Math.min(100, Math.round((g.done / g.total) * 100)) + '%';
    } else {
      fill.className += ' jobbar__fill--flow';
    }
    track.appendChild(fill);
    row.appendChild(track);

    var foot = el('div', 'jobbar__foot');
    var left = el('span', 'jobbar__note');
    var eta = (global.LpyaJobEta && g.featureKey)
      ? global.LpyaJobEta.remain(g.featureKey, elapsedMin(g.startedAt), t) : '';
    /* やり直し中などの一言があれば、そちらを優先する */
    left.textContent = g.note || eta || t('jobbar.working');
    foot.appendChild(left);

    var stop = el('button', 'jobbar__stop', t('jobbar.cancel'));
    stop.type = 'button';
    stop.addEventListener('click', function () {
      stop.disabled = true;
      stop.textContent = t('jobbar.cancelling');
      var all = g.ids.map(function (id) { return global.Api.generationJobs.cancel(id); });
      Promise.all(all).then(poll, poll);
    });
    foot.appendChild(stop);
    row.appendChild(foot);
    return row;
  }

  function doneRowFor(one) {
    var row = el('div', 'jobbar__row jobbar__row--done'
      + (one.kind === 'ng' ? ' jobbar__row--ng' : ''));
    var head = el('div', 'jobbar__head');
    head.appendChild(el('span', 'jobbar__name', one.text));
    row.appendChild(head);
    return row;
  }

  /* 絵を作れないときだけ出す（2026-11-04 指摘「この表現が何を意味しているか
     分かりずらい。何？」）。

     もとは「絵の作り先の状態が分かりません（10分以上、確認できていません）」と
     出していた。これは2つの意味でまずかった:
       ① 「作り先」はこちらの言葉で、読む人には何のことか分からない
       ② 出ていたのは **まだ一度も確かめていない** 状態で、
          悪いことは何も起きていない。知らないことを警告として出すと、
          直しようのない不安だけが画面に残る
     だから **こちらが「作れない」と知っているときだけ** 出す。
     知らないときは黙る。実際に作れなければ、押したあとに
     自動のやり直し（最大3回）とポイントの返金が受け止める。 */
  function makerRow() {
    if (!maker || maker.state !== 'ng') { return null; }
    var row = el('div', 'jobbar__row jobbar__row--maker jobbar__row--ng');
    var head = el('div', 'jobbar__head');
    head.appendChild(el('span', 'jobbar__dot jobbar__dot--ng'));
    head.appendChild(el('span', 'jobbar__name', t('jobbar.makerNg')));
    row.appendChild(head);

    var foot = el('div', 'jobbar__foot');
    /* 作り先が書いた一言（「ログインが切れています」など）。
       直す人への手がかりなので、そのまま出す */
    foot.appendChild(el('span', 'jobbar__note', String(maker.note || '')));
    var again = el('button', 'jobbar__stop', t('jobbar.recheck'));
    again.type = 'button';
    again.addEventListener('click', function () {
      again.disabled = true;
      again.textContent = t('jobbar.rechecking');
      var uid = (global.Api.auth && typeof global.Api.auth.userId === 'function')
        ? global.Api.auth.userId() : null;
      global.Api.generationJobs.insert({
        feature_key: 'worker_check', status: 'pending', users_id: uid, payload: {}
      }).then(function () { makerAt = 0; poll(); }, function () {
        again.disabled = false;
        again.textContent = t('jobbar.recheck');
      });
    });
    foot.appendChild(again);
    row.appendChild(foot);
    return row;
  }

  function loadMaker() {
    if (Date.now() - makerAt < 60000) { return Promise.resolve(); }
    makerAt = Date.now();
    return global.Api.workerStatus.list({ eq: { maker: 'chatgpt' }, order: false, limit: 1 })
      .then(function (rows) { maker = (rows && rows[0]) || null; }, function () { /* 読めなければ出さない */ });
  }

  function paint() {
    if (!root) { return; }
    var now = Date.now();
    Object.keys(finished).forEach(function (k) {
      if (finished[k].until < now) { delete finished[k]; }
    });
    var keys = Object.keys(groups);
    var dones = Object.keys(finished);
    var warn = makerRow();
    if (!keys.length && !dones.length && !warn) {
      root.hidden = true;
      root.textContent = '';
      return;
    }
    root.textContent = '';
    root.hidden = false;
    if (warn) { root.appendChild(warn); }
    keys.forEach(function (k) { root.appendChild(rowFor(groups[k])); });
    dones.forEach(function (k) { root.appendChild(doneRowFor(finished[k])); });
  }

  function poll() {
    if (!root) { return Promise.resolve(); }
    var userId = (global.Api && global.Api.auth && typeof global.Api.auth.userId === 'function')
      ? global.Api.auth.userId() : null;
    if (!userId) { groups = {}; paint(); return Promise.resolve(); }
    loadMaker();
    return global.Api.generationJobs.list({
      eq: { users_id: userId },
      in: { status: LIVE },
      select: 'id,feature_key,status,progress_done,progress_total,progress_note,created_at,projects_id,payload',
      order: 'created_at.asc',
      limit: 60
    }).then(function (rows) {
      var jobs = rows || [];
      return learnVariants(jobs).then(function () {
        var next = gather(jobs);
        /* 消えた束＝終わった束。何が起きたかを1回だけ聞きに行く */
        Object.keys(groups).forEach(function (k) {
          if (!next[k]) { announce(groups[k]); }
        });
        groups = next;
        paint();
      });
    }, function () { /* 読めない回は、前の表示のまま */ });
  }

  function tick() {
    poll().then(function () {
      var busy = Object.keys(groups).length > 0;
      timer = global.setTimeout(tick, busy ? POLL_BUSY_MS : POLL_IDLE_MS);
    }, function () {
      timer = global.setTimeout(tick, POLL_IDLE_MS);
    });
  }

  function start(app) {
    App = app || global.App || null;
    root = global.document.getElementById(ROOT_ID);
    if (!root) {
      console.error('[jobbar] #' + ROOT_ID + ' がありません。index.html を確認してください');
      return;
    }
    askNotifyOnce();
    stop();
    tick();
  }

  function stop() {
    if (timer) { global.clearTimeout(timer); timer = null; }
  }

  global.LpyaJobBar = { start: start, stop: stop, poll: poll, _groups: function () { return groups; } };
}(window));
