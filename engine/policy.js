/* 每天把最貴的 3C 買滿再睡覺。買不下時：拆開待拆、全選鑑定、全部掛七折，然後繼續，直到現金不夠。 */
(function () {
  const LOG_MAX = 14;
  const state = {
    bought: 0,
    spent: 0,
    days: 0,
    opened: 0,
    appraised: 0,
    listed: 0,
    done: false,
    reason: "",
    log: [],
    price: 0,
    tier: "",
  };

  function quiet() {
    try { render = function () {}; } catch (e) {}
    try { save = function () {}; } catch (e) {}
    try { toast = function () {}; } catch (e) {}
    try {
      sfx.click = sfx.coin = sfx.tear = sfx.rare = sfx.junk = sfx.tick = function () {};
    } catch (e) {}
  }

  function note(line) {
    state.log.unshift(line);
    if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
  }

  function pickTier() {
    ui.cat = "3C";
    let bi = 0;
    let bp = -1;
    for (let i = 0; i < T.length; i++) {
      if (lv() < T[i].lv) continue;
      ui.t = i;
      const p = PR(T[i]);
      if (p > bp) {
        bp = p;
        bi = i;
      }
    }
    ui.t = bi;
    state.tier = T[bi].n;
    state.price = bp;
    return bi;
  }

  function roomFor() {
    const pk = T[ui.t].pk;
    let room = 1e9;
    try {
      if (typeof X5HOLDMAX !== "undefined" && typeof x5Hold === "function") {
        room = Math.floor((X5HOLDMAX - x5Hold()) / pk);
      }
    } catch (e) {}
    return room;
  }

  function openAll() {
    const n0 = S.q.length;
    if (!n0) return 0;
    const prev = thumb;
    thumb = function () { return ""; };
    try {
      while (S.q.length) {
        const it = openCore();
        S.inv.push(it);
        const pack = S.q.shift();
        const box = S.bt[pack.b];
        if (box) {
          box.l--;
          if (box.l <= 0) {
            if (lv() > S.lvs) S.lvs = lv();
            delete S.bt[pack.b];
          }
        }
      }
    } finally {
      thumb = prev;
    }
    state.opened += n0;
    ui.mq.length = 0;
    return n0;
  }

  function appraiseAll() {
    let n = 0;
    let fee = 0;
    let real = 0;
    let fake = 0;
    for (let i = 0; i < S.inv.length; i++) {
      const it = S.inv[i];
      if (AUTH(it) !== "pend") continue;
      const cost = apFee(it);
      if (S.cash < cost) continue;
      S.cash -= cost;
      fee += cost;
      n++;
      if (Math.random() < 0.3) {
        it.au = "fake";
        it.fake = 1;
        it.p = fakeP(it);
        fake++;
      } else {
        it.au = "real";
        it.ck = 1;
        it.p = realP(it);
        real++;
      }
    }
    state.appraised += n;
    if (n) S.log.unshift("-" + mny(fee) + " 鑑定 " + n + " 件");
    return { n, fee, real, fake };
  }

  function listAll70() {
    const market = MK();
    let n = 0;
    for (let i = S.inv.length - 1; i >= 0; i--) {
      const it = S.inv[i];
      S.inv.splice(i, 1);
      market.ls.unshift({ id: market.nid++, it: it, price: R10(it.p * 0.7) });
      n++;
    }
    state.listed += n;
    if (n) S.log.unshift("上架 " + n + " 件，全部七折");
    try { ui.sel2 = new Set(); } catch (e) {}
    return n;
  }

  function clearAndList() {
    const opened = openAll();
    const ap = appraiseAll();
    const listed = listAll70();
    if (!opened && !listed) return null;
    note("滿了：拆開 " + opened + " 個，鑑定 " + ap.n + " 件（正品 " + ap.real + "／高仿 " + ap.fake + "），掛七折 " + listed + " 件");
    return listed;
  }

  function day() {
    quiet();
    if (state.done) return snap();
    const bi = pickTier();
    const price = PR(T[bi]);
    const room = roomFor();
    const qty = Math.min(S.od, Math.floor(S.cash / price), room);
    if (qty < 1) {
      if (S.cash < price) {
        if (S.q.length || S.inv.length) clearAndList();
        state.done = true;
        state.reason = "現金不夠再買一箱" + T[bi].n;
        note("停了：" + state.reason);
        return snap();
      }
      if (room < 1) {
        const listed = clearAndList();
        if (listed) return snap();
        state.done = true;
        state.reason = "背包滿了，也沒有東西可以鑑定上架";
        note("停了：" + state.reason);
        return snap();
      }
      sleepDay();
      return snap();
    }
    ui.cat = "3C";
    ui.t = bi;
    ui.qty = qty;
    const before = S.cash;
    const q0 = S.q.length;
    BUY();
    const got = (S.q.length - q0) / T[bi].pk;
    if (!(got > 0)) {
      state.done = true;
      state.reason = "這一箱買不下去了";
      note("停了：" + state.reason);
      return snap();
    }
    state.bought += got;
    state.spent += before - S.cash;
    const when = "第 " + S.mon + " 月第 " + S.day + " 天";
    const cost = before - S.cash;
    const sl = sleepDay();
    note(when + " 買滿 " + got + " 箱" + T[bi].n + " −" + mny(cost) + (sl.month ? " · 月結" : "") + "，然後睡覺");
    return snap();
  }

  function sleepDay() {
    ini();
    S.day++;
    let month = false;
    if (S.day > 10) {
      S.day = 1;
      S.mon++;
      const rent = monthly();
      S.cash = Math.max(0, S.cash + 30000 - rent);
      month = true;
    }
    const ev = EV[rnd(EV.length)];
    S.ev = ev.id ? { id: ev.id, b: ev.b } : null;
    if (ev.id === "bonus") S.cash += 1000;
    if (ev.id === "fee") S.cash = Math.max(0, S.cash - 500);
    S.od = maxOd();
    try { PNLX(); } catch (e) {}
    if (S.log && S.log.length > 40) S.log.length = 40;
    ui.mq.length = 0;
    state.days++;
    return { month };
  }

  function snap() {
    let price = state.price;
    try {
      ui.cat = "3C";
      price = PR(T[ui.t]);
    } catch (e) {}
    return {
      name: S.name,
      cash: S.cash,
      mon: S.mon,
      day: S.day,
      lv: lv(),
      exp: S.exp,
      od: S.od,
      q: S.q.length,
      inv: S.inv.length,
      listed: MK().ls.length,
      appraised: state.appraised,
      price,
      tier: state.tier,
      bought: state.bought,
      opened: state.opened,
      spent: state.spent,
      days: state.days,
      done: state.done,
      reason: state.reason,
      log: state.log.slice(),
    };
  }

  function loadCode(code) {
    quiet();
    const raw = String(code || "").trim();
    const m = raw.match(/[~～]\s*ACC\s*[~～]\s*([0-9a-f]{8,40}\.[0-9a-f]{32,64})/i);
    try {
      if (m && typeof BBS !== "undefined") {
        BBS.tok = m[1].toLowerCase();
        BBS.id = BBS.tok.split(".")[0];
      }
    } catch (e) {}
    const loaded = LOADCODE(raw);
    if (!loaded) throw new Error("這組存檔碼讀不起來");
    S = Object.assign(def(), loaded);
    ini();
    state.bought = 0;
    state.spent = 0;
    state.days = 0;
    state.opened = 0;
    state.appraised = 0;
    state.listed = 0;
    state.done = false;
    state.reason = "";
    state.log = [];
    pickTier();
    note("讀好了。每天把 3C「" + state.tier + "」買滿再睡覺。滿了就全選鑑定、掛七折，繼續買到沒錢。");
    return snap();
  }

  function exportCode() {
    quiet();
    return SAVECODE();
  }

  globalThis.TW = { loadCode, day, snap, exportCode };
})();
