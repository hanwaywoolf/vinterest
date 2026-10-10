/* Vinterest — DetailLevel: how much detail the app shows someone, so a casual drinker isn't met
   with a wall of text and an enthusiast still gets the depth.

   Three levels, read by every screen that scales (WineDNA, the scan result, the post-scan cards):
   simple → more → everything. Where someone starts is their onboarding experience answer
   (UserPrefs.experience: just getting started or "I know what I like" → simple, pretty into it →
   more, borderline obsessed → everything). From there it grows, led by learning: More at MORE_AT
   (25%) Mastery, with wines they've scanned adding up to WINE_PTS_MAX points (one per
   WINES_PER_PT), so someone who only scans and scores stays simple; Everything at ALL_MASTERY
   (50%) Mastery with ALL_SCORED (15) scored wines, so the deeper sections have something to show.

   A level once reached never goes down (Mastery fades; what they could see doesn't). It's kept per
   experience answer, so changing the answer on Profile changes the level straight away, and
   "Show all details" on Profile overrides everything. Matching never changes by level: only how
   much is shown. A rise becomes a moment card (XPSystem.present) saying what's new. */
const DetailLevel = {
  KEY:'vinterest_detail_level',        // progress: {by:{<experience>: rank}} — combines by max
  ALL_KEY:'vinterest_detail_all',      // setting: '1' when "Show all details" is on
  INTRO_KEY:'vinterest_detail_intro',  // progress: the one-time "WineDNA fits you now" card was shown
  LEVELS:['simple','more','everything'],
  MORE_AT:25, WINE_PTS_MAX:10, WINES_PER_PT:2, ALL_MASTERY:50, ALL_SCORED:15,

  _exp(){ return (typeof UserPrefs!=='undefined'&&UserPrefs.experience())||'none'; },
  /* Where an experience answer starts. */
  base(exp){ return exp==='expert'?2:exp==='enthusiast'?1:0; },
  _earned(){ const d=Store.getJSON(this.KEY,null); return (d&&d.by&&d.by[this._exp()])||0; },

  // Tests see every screen in full unless they test the levels themselves (helpers.stubNetwork).
  _testAll(){ return typeof window!=='undefined'&&window.VINTEREST_DETAIL==='all'; },
  showAll(){ return this._testAll()||Store.get(this.ALL_KEY)==='1'; },
  setShowAll(on){ if(on) Store.set(this.ALL_KEY,'1'); else Store.remove(this.ALL_KEY); this._changed(); },

  /* What they've reached on their own (never the Show all switch): 0, 1 or 2. */
  reached(){ return Math.max(this.base(this._exp()),this._earned()); },
  rank(){ return this.showAll()?2:this.reached(); },
  level(){ return this.LEVELS[this.rank()]; },
  /* True when the level is at least `name`: DetailLevel.at('more'). */
  at(name){ return this.rank()>=Math.max(0,this.LEVELS.indexOf(name)); },

  /* The level their learning and wines have earned right now (before "never down"). */
  earnedNow(wines,overall){
    wines=wines||WineHistory.getAll();
    if(overall==null){ try{ overall=KnowledgeMap.compute(wines).overall; }catch(e){ overall=0; } }
    const scored=wines.filter(w=>w.rating>0).length;
    const winePts=Math.min(this.WINE_PTS_MAX,Math.floor(wines.length/this.WINES_PER_PT));
    if(overall>=this.ALL_MASTERY&&scored>=this.ALL_SCORED) return 2;
    if(overall+winePts>=this.MORE_AT) return 1;
    return 0;
  },

  /* Keeps the level up to date (on calm screens, from pwa-app.jsx). Returns the new rank when it
     rose, else null. Someone who already used the app before levels existed gets the one-time
     intro card instead of a rise; a new user saw the levels previewed at onboarding. */
  check(wines,overall){
    if(this._testAll()) return null;
    const exp=this._exp(), before=this.reached();
    const now=this.earnedNow(wines,overall);
    if(now>this._earned()){
      const d=Store.getJSON(this.KEY,null)||{}; d.by={...(d.by||{}),[exp]:now}; Store.setJSON(this.KEY,d);
    }
    const after=this.reached();
    if(!this.introSeen()){ this.markIntro(); this._toast({detailIntro:this.LEVELS[after]}); this._changed(); return null; }
    if(after>before){ if(!this.showAll()) this._toast({detailLevel:this.LEVELS[after]}); this._changed(); return after; }
    return null;
  },
  introSeen(){ return !!Store.get(this.INTRO_KEY); },
  markIntro(){ Store.set(this.INTRO_KEY,'1'); },

  /* What each level adds, in words, for the moment card. */
  ADDS:{
    more:'Your WineDNA now shows how your taste has moved over time and how well we can predict your scores, and every scan explains its match in full.',
    everything:'Your WineDNA now shows everything: your best value, the flavours you keep coming back to, and what lifts and holds back your scores.',
  },
  _toast(award){ try{ XPSystem.toast([award]); }catch(e){} },
  _changed(){ try{ window.dispatchEvent(new CustomEvent('vinterest:detail')); }catch(e){} },
};
