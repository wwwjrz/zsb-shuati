/* 本地学习记录存储 */
'use strict';

const Store = {
  KEY: 'scft.v1',
  data: null,

  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch (e) { this.data = {}; }
    if (!this.data.rec) this.data.rec = {};
    if (!this.data.hist) this.data.hist = [];
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn('存储失败', e); }
  },

  rec(qid) { return this.data.rec[qid]; },

  /* 客观题作答记录 */
  recordObj(qid, ok) {
    const r = this.data.rec[qid] || (this.data.rec[qid] = { c: 0, w: 0 });
    if (ok) r.c++; else r.w++;
    r.r = ok ? 1 : 0;
    r.t = Date.now();
    this.save();
  },

  /* 主观题/背诵自评：know=1 会  0 不会 */
  recordSubj(qid, know) {
    const r = this.data.rec[qid] || (this.data.rec[qid] = { c: 0, w: 0 });
    r.sr = know ? 1 : 0;
    r.st = Date.now();
    this.save();
  },

  addHist(h) {
    this.data.hist.unshift(h);
    if (this.data.hist.length > 80) this.data.hist.length = 80;
    this.save();
  },

  /* 错题本：最近一次做错的客观题 */
  wrongIds() {
    const out = [];
    for (const qid in this.data.rec) {
      if (IDX[qid] && this.data.rec[qid].r === 0) out.push(qid);
    }
    return out;
  }
};
