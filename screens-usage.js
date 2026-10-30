/* =============================================================================
 * screens-usage.js — S22 利用状況（管理者だけ）
 *
 * なぜ要るか（2026-10-30 要望）:
 *   ポイントの値段を決めるのに、ボタンごとの原価と、利用者ごとの使い方が要る。
 *   これまでは請求画面を人が見るか、tools/cost-report.mjs を手で走らせるしか
 *   なかった。画面から見えないと、値付けを直す判断ができない。
 *
 * 何を出すか:
 *   1. ボタン別   … 実測原価（1回あたり・合計）と、受け取ったポイント。
 *                   受け取りが原価を下回る行は赤くする（赤字のボタン）
 *   2. 利用者別   … 全期間 / 月ごと / 日ごと で、AIにかかった円と払ったポイント
 *   3. 作ったもの … その利用者のプロジェクトと生成物。中身を開いて確かめられる
 *
 * 数え方はサーバー側（056_admin_cost_views.sql）。
 *   Api.credits.costByFeature(from, to)
 *   Api.credits.usageByUser(bucket, from, to, userId)
 * どちらも RPC の中で elpiya_is_admin() を見ているので、管理者以外は空が返る。
 *
 * 画面登録   App.registerScreen('S22', { render: function (root, params) {} });
 * URL        #/S22（?user=<利用者ID> で1人に絞る）
 * ========================================================================== */
(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-usage] App.registerScreen がありません。index.html の読み込み順（app.js -> screens-usage.js）を確認してください。');
    return;
  }

  var LOCAL = {
    'u.title': ['利用状況', 'Usage', '이용 현황'],
    'u.lead': ['AIにいくらかかって、ポイントをいくら受け取ったかを並べます。ポイントの値段を決めるための画面です。',
      'What the AI cost and what we received in points, side by side. This is the screen for setting prices.',
      'AI에 든 비용과 받은 포인트를 나란히 봅니다.'],
    'u.byFeature': ['ボタン別の原価と受け取り', 'Cost and income per button', '버튼별 원가와 수입'],
    'u.byFeatureDesc': ['1回あたりの原価より受け取りが少ない行は赤く出ます。赤い行は値段を上げるか、使うモデルを変えてください。',
      'Rows where income is below the per-run cost are shown in red.',
      '1회 원가보다 수입이 적은 행은 빨갛게 나옵니다.'],
    'u.byUser': ['利用者ごとの使い方', 'Usage per user', '이용자별 사용'],
    'u.byUserDesc': ['全期間・月ごと・日ごとで切り替えられます。', 'Switch between all time, monthly and daily.', '전체·월별·일별로 바꿀 수 있습니다.'],
    'u.works': ['利用者が作っているもの', 'What users are making', '이용자가 만들고 있는 것'],
    'u.worksDesc': ['プロジェクトを選ぶと、入れた商品情報と作った生成物を確かめられます。',
      'Pick a project to see the product details and what was generated.',
      '프로젝트를 고르면 상품 정보와 생성물을 확인할 수 있습니다.'],
    'u.all': ['全期間', 'All time', '전체'],
    'u.month': ['月ごと', 'Monthly', '월별'],
    'u.day': ['日ごと', 'Daily', '일별'],
    'u.feature': ['ボタン', 'Button', '버튼'],
    'u.runs': ['回数', 'Runs', '횟수'],
    'u.costEach': ['原価/回', 'Cost each', '원가/회'],
    'u.costTotal': ['原価 合計', 'Cost total', '원가 합계'],
    'u.pointsEach': ['受け取り/回', 'Income each', '수입/회'],
    'u.points': ['受け取り ポイント', 'Points received', '받은 포인트'],
    'u.user': ['利用者', 'User', '이용자'],
    'u.period': ['期間', 'Period', '기간'],
    'u.cost': ['AI原価', 'AI cost', 'AI 원가'],
    'u.margin': ['差引', 'Margin', '차액'],
    'u.empty': ['まだ記録がありません。', 'Nothing recorded yet.', '아직 기록이 없습니다.'],
    'u.project': ['プロジェクト', 'Project', '프로젝트'],
    'u.made': ['作った数', 'Generated', '생성 수'],
    'u.open': ['中身を見る', 'Open', '내용 보기'],
    'u.back': ['管理画面へ戻る', 'Back to admin', '관리 화면으로'],
    'u.notAdmin': ['管理者だけが見られる画面です。', 'Admins only.', '관리자만 볼 수 있습니다.'],
    'u.yen': ['円', 'JPY', '원'],
    'u.loadFailed': ['読み込めませんでした。', 'Could not load.', '불러오지 못했습니다.'],
    'u.pickUser': ['（全員）', '(everyone)', '(전체)']
  };

  function localeIndex() {
    var code = (window.I18N && typeof window.I18N.locale === 'function') ? window.I18N.locale() : 'ja';
    return ['ja', 'en', 'ko'].indexOf(code) === -1 ? 0 : ['ja', 'en', 'ko'].indexOf(code);
  }

  function t(key) {
    var row = LOCAL[key];
    if (!row) {
      console.error('[screens-usage] 辞書に ' + key + ' がありません');
      return key;
    }
    return row[localeIndex()] || row[0];
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }
  function add(parent, child) { if (parent && child) { parent.appendChild(child); } return child; }
  function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }
  function button(cls, label, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    if (onClick) { b.addEventListener('click', onClick); }
    return b;
  }
  function num(v) {
    var n = Number(v) || 0;
    return n.toLocaleString('ja-JP');
  }
  function yen(v) { return '¥' + num(Math.round(Number(v) || 0)); }

  function cell(row, text, cls) { return add(row, el('td', cls || '', text)); }

  App.registerScreen('S22', {
    render: function (root, params) {
      params = params || {};
      clear(root);

      var state = { bucket: 'all', user: params.user || '', features: [], usage: [], projects: [] };

      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('u.title')));
      add(head, el('p', 'screen__lead', t('u.lead')));
      add(screen, head);

      var featureBox = add(screen, el('section', 'section'));
      var userBox = add(screen, el('section', 'section'));
      var workBox = add(screen, el('section', 'section'));

      add(screen, button('btn btn--text btn--block', t('u.back'), function () {
        location.hash = '#/S18';
      }));
      add(root, screen);

      load();

      function api() {
        return window.Api && window.Api.credits ? window.Api.credits : null;
      }

      function load() {
        var c = api();
        if (!c || typeof c.costByFeature !== 'function') {
          console.error('[screens-usage] Api.credits.costByFeature がありません。api.js を確認してください。');
          add(featureBox, el('p', 'empty', t('u.loadFailed')));
          return;
        }
        Promise.all([
          c.costByFeature().catch(function (err) {
            console.error('[screens-usage] ボタン別の原価を読めませんでした', err);
            return [];
          }),
          c.usageByUser(state.bucket, null, null, state.user || null).catch(function (err) {
            console.error('[screens-usage] 利用者ごとの使い方を読めませんでした', err);
            return [];
          })
        ]).then(function (got) {
          state.features = got[0] || [];
          state.usage = got[1] || [];
          paintFeatures();
          paintUsers();
        });
        loadWorks();
      }

      /* ---- 1. ボタン別 ---- */
      function paintFeatures() {
        clear(featureBox);
        add(featureBox, el('h3', 'section__title', t('u.byFeature')));
        add(featureBox, el('p', 'section__desc', t('u.byFeatureDesc')));
        if (!state.features.length) {
          add(featureBox, el('p', 'empty', t('u.empty')));
          return;
        }
        var wrap = add(featureBox, el('div', 'usage-wrap'));
        var table = add(wrap, el('table', 'usage-table'));
        var hr = add(add(table, el('thead')), el('tr'));
        [['u.feature', ''], ['u.runs', 'num'], ['u.costEach', 'num'],
         ['u.costTotal', 'num'], ['u.pointsEach', 'num'], ['u.points', 'num']]
          .forEach(function (h) { add(hr, el('th', h[1], t(h[0]))); });
        var tbody = add(table, el('tbody'));
        state.features.forEach(function (r) {
          var each = r.cost_yen_each === null || r.cost_yen_each === undefined
            ? null : Number(r.cost_yen_each);
          var inEach = r.points_each === null || r.points_each === undefined
            ? null : Number(r.points_each);
          /* 受け取りは円に直して比べる。ポイントの単価は credit_unit_price */
          var gotYen = inEach === null ? null : inEach * unitPrice();
          var loss = each !== null && gotYen !== null && gotYen < each;
          var tr = add(tbody, el('tr', loss ? 'is-loss' : ''));
          cell(tr, String(r.feature_key || ''));
          cell(tr, num(r.jobs || r.calls), 'num');
          cell(tr, each === null ? '—' : yen(each), 'num');
          cell(tr, yen(r.cost_yen), 'num');
          cell(tr, gotYen === null ? '—' : yen(gotYen), 'num');
          cell(tr, num(r.points) + 'P', 'num');
        });
      }

      /* ポイント1点が何円か。読めないあいだは10円（000 の初期値） */
      var unit = 10;
      function unitPrice() { return unit; }
      if (window.Api && window.Api.credits && typeof window.Api.credits.costOf === 'function') {
        window.Api.credits.costOf('credit_unit_price').then(function (v) {
          if (v) { unit = Number(v) || 10; paintFeatures(); }
        }).catch(function () {});
      }

      /* ---- 2. 利用者ごと ---- */
      function paintUsers() {
        clear(userBox);
        add(userBox, el('h3', 'section__title', t('u.byUser')));
        add(userBox, el('p', 'section__desc', t('u.byUserDesc')));

        var tabs = add(userBox, el('div', 'usage-tabs'));
        [['all', 'u.all'], ['month', 'u.month'], ['day', 'u.day']].forEach(function (one) {
          var on = state.bucket === one[0];
          var b = button('btn btn--sm ' + (on ? 'btn--primary' : 'btn--secondary'), t(one[1]), function () {
            if (state.bucket === one[0]) { return; }
            state.bucket = one[0];
            load();
          });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(tabs, b);
        });

        if (!state.usage.length) {
          add(userBox, el('p', 'empty', t('u.empty')));
          return;
        }
        var wrap = add(userBox, el('div', 'usage-wrap'));
        var table = add(wrap, el('table', 'usage-table'));
        var hr = add(add(table, el('thead')), el('tr'));
        var cols = [['u.user', '']];
        if (state.bucket !== 'all') { cols.push(['u.period', '']); }
        cols = cols.concat([['u.runs', 'num'], ['u.cost', 'num'], ['u.points', 'num'], ['u.margin', 'num']]);
        cols.forEach(function (h) { add(hr, el('th', h[1], t(h[0]))); });

        var tbody = add(table, el('tbody'));
        state.usage.forEach(function (r) {
          var cost = Number(r.cost_yen) || 0;
          var got = (Number(r.points) || 0) * unitPrice();
          var tr = add(tbody, el('tr', got < cost ? 'is-loss' : ''));
          var who = r.display_name || r.email || String(r.users_id || '').slice(0, 8);
          var td = cell(tr, who);
          td.appendChild(el('div', 'list-row__sub clamp-1', r.email || ''));
          if (state.bucket !== 'all') { cell(tr, r.bucket ? String(r.bucket) : '—'); }
          cell(tr, num(r.jobs), 'num');
          cell(tr, yen(cost), 'num');
          cell(tr, num(r.points) + 'P', 'num');
          cell(tr, yen(got - cost), 'num');
        });
      }

      /* ---- 3. 作っているもの ----
         管理者は projects / generations をそのまま読める（001 の RLS）。
         件数だけ数えて並べ、押したらいつもの画面で開く */
      function loadWorks() {
        clear(workBox);
        add(workBox, el('h3', 'section__title', t('u.works')));
        add(workBox, el('p', 'section__desc', t('u.worksDesc')));
        if (!window.Api || !window.Api.projects) {
          add(workBox, el('p', 'empty', t('u.loadFailed')));
          return;
        }
        var q = { order: 'created_at.desc', limit: 50 };
        if (state.user) { q.eq = { users_id: state.user }; }
        window.Api.projects.list(q).then(function (rows) {
          state.projects = rows || [];
          paintWorks();
        }).catch(function (err) {
          console.error('[screens-usage] プロジェクトを読めませんでした', err);
          add(workBox, el('p', 'empty', t('u.loadFailed')));
        });
      }

      function paintWorks() {
        if (!state.projects.length) {
          add(workBox, el('p', 'empty', t('u.empty')));
          return;
        }
        var wrap = add(workBox, el('div', 'usage-wrap'));
        var table = add(wrap, el('table', 'usage-table'));
        var hr = add(add(table, el('thead')), el('tr'));
        [['u.project', ''], ['u.user', ''], ['u.period', ''], ['u.open', 'num']]
          .forEach(function (h) { add(hr, el('th', h[1], t(h[0]))); });
        var tbody = add(table, el('tbody'));
        state.projects.forEach(function (p) {
          var tr = add(tbody, el('tr'));
          var name = p.project_name || p.product_name || p.name || String(p.id).slice(0, 8);
          var td = cell(tr, name);
          td.appendChild(el('div', 'list-row__sub clamp-1', p.product_name || ''));
          cell(tr, String(p.users_id || '').slice(0, 8));
          cell(tr, String(p.created_at || '').slice(0, 10));
          var act = add(tr, el('td', 'num'));
          add(act, button('btn btn--secondary btn--sm', t('u.open'), function () {
            location.hash = '#/S8?id=' + encodeURIComponent(p.id);
          }));
        });
      }
    }
  });
})(window, document);
