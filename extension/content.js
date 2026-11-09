"use strict";
/* えごさ拡張: 開いているページに「タップで訳が出る」読み方を重ねる。
   Webアプリ版えごさが CAPTCHA やログインで取り込めないページでも、
   自分で開けるページならその場で読めるようにするための拡張です。 */
const PHRASES = ["look forward to","take into account","in other words","on the other hand","as a result","in addition","in particular","in general","for example","according to","in order to","because of","instead of","rather than","as well as","as long as","as soon as","even though","whether or not","not only","first of all","in the end","in short","to begin with","in conclusion","little by little","step by step","one by one","when it comes to","in terms of","come up with","get rid of","find out","look into","point out","bring up","carry out","end up","run into","deal with","focus on","depend on","based on","lead to","result in","consist of","check out","look up","give up","take up","put off","call off","break down","figure out","work out","make sure","turn on","turn off","set up","such as","due to","at least","at most","more than","less than","a lot of","kind of","sort of","used to","be able to","have to","at all","by the way","so far","even if","but also","each other","one another","no longer","on average","per day","go on","keep on","come back"].sort((a,b)=>b.length-a.length);
const SKIP_TAGS = new Set(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA","INPUT","SELECT","OPTION","IFRAME","SVG","CANVAS"]);
let dict = {}, glossCache = {}, activated = false;
let currentKey = "", currentGloss = "", currentIsUnit = false;
let currentSentence = "";

function pickTranslation(j, src, wantJa){
  const norm = s => (s || "").trim().toLowerCase().replace(/[.\u3002!?,;:]+$/,"");
  const isBad = s => { const t = (s || "").trim(); return !t || t === "\uFF08\u7A7A\u6B04\uFF09" || norm(t) === norm(src); };
  const top = j.responseData && j.responseData.translatedText;
  if(!isBad(top)) return top;
  let ms = (j.matches || []).filter(m => m.translation && !isBad(m.translation));
  if(wantJa) ms = ms.filter(m => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(m.translation));
  ms.sort((a,b) => ((b.match||0) - (a.match||0)) || ((b.quality||0) - (a.quality||0)));
  return ms.length ? ms[0].translation : "";
}

async function jishoGloss(word){
  try{
    const r = await fetch("https://jisho.org/api/v1/search/words?keyword=" + encodeURIComponent(word));
    const j = await r.json();
    const w = word.toLowerCase();
    for(const e of (j.data || [])){
      const defs = [];
      (e.senses || []).forEach(s => (s.english_definitions || []).forEach(d => defs.push(d.toLowerCase())));
      if(!defs.some(d => d.split(/[^a-z]+/).includes(w))) continue;
      const jp = (e.japanese || [])[0] || {};
      if(jp.word || jp.reading) return jp.word || jp.reading;
    }
  }catch(_){ }
  return "";
}

async function translate(text){
  const q = text.replace(/([A-Za-z])-(?=[A-Za-z])/g, "$1 ");
  const u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q) + "&langpair=en|ja";
  const r = await fetch(u);
  const j = await r.json();
  let out = pickTranslation(j, q, true);
  if(!out && !q.includes(" ")) out = await jishoGloss(q);
  return out;
}

/* ---------- UI ---------- */
const style = document.createElement("style");
style.textContent =
  ".egosa-w{cursor:pointer;border-radius:3px}.egosa-w:active{background:#ccfbf1}" +
  ".egosa-ph{border-bottom:2px dotted #0f766e}" +
  ".egosa-s{cursor:pointer}" +
  ".egosa-w rt{font-size:9px;color:#0f766e}";
document.documentElement.appendChild(style);

const launch = document.createElement("button");
launch.setAttribute("data-egosa-ui","1");
launch.textContent = "えごさ";
launch.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0f766e;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-size:14px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer";
function isEnglishPage(){
  const lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
  if(lang.indexOf("en") === 0) return true;
  if(lang.indexOf("ja") === 0) return false;
  const t = ((document.title || "") + " " + (document.body ? document.body.innerText || "" : "")).slice(0, 4000);
  let latin = 0, jp = 0;
  for(const ch of t){
    if(/[A-Za-z]/.test(ch)) latin++;
    else if(/[\u3040-\u30FF\u4E00-\u9FFF]/.test(ch)) jp++;
  }
  if(latin + jp < 40) return false;
  return latin > jp;
}
let launchShown = false;
let launchObserver = null;
let lastSampleLen = -1;
function tryShowLaunch(){
  if(launchShown) return;
  if(!isEnglishPage()) return;
  launchShown = true;
  document.documentElement.appendChild(launch);
  if(launchObserver){ launchObserver.disconnect(); launchObserver = null; }
}
tryShowLaunch();
if(!launchShown && (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("ja") !== 0){
  // 本文が後から描画されるページ（記事ページ等）では、読み込み直後の判定材料が足りない。
  // 少しの間だけ本文の変化を待って、材料が増えたら判定し直す
  launchObserver = new MutationObserver(() => {
    const len = document.body ? (document.body.innerText || "").length : 0;
    if(Math.abs(len - lastSampleLen) < 200) return;
    lastSampleLen = len;
    tryShowLaunch();
  });
  launchObserver.observe(document.documentElement, {childList: true, subtree: true});
  setTimeout(() => { tryShowLaunch(); if(launchObserver){ launchObserver.disconnect(); launchObserver = null; } }, 8000);
}

const bar = document.createElement("div");
bar.setAttribute("data-egosa-ui","1");
bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#111827;color:#fff;padding:12px 16px;font-family:sans-serif;transform:translateY(110%);transition:transform .18s";
const barWord = document.createElement("span");
barWord.style.cssText = "font-size:17px;font-weight:700";
const barGloss = document.createElement("span");
barGloss.style.cssText = "font-size:14px;opacity:.92;margin-left:10px";
const barActs = document.createElement("div");
barActs.style.cssText = "margin-top:8px;display:flex;gap:8px";
const saveBtn = document.createElement("button");
saveBtn.textContent = "ふりがなに貯める";
saveBtn.style.cssText = "background:#0f766e;color:#fff;border:0;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer";
const sentBtn = document.createElement("button");
sentBtn.textContent = "文の訳";
sentBtn.style.cssText = "background:#e7e5e4;color:#1f2937;border:0;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer;display:none";
const closeBtn = document.createElement("button");
closeBtn.textContent = "閉じる";
closeBtn.style.cssText = "background:#e7e5e4;color:#1f2937;border:0;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer";
barActs.appendChild(saveBtn); barActs.appendChild(sentBtn); barActs.appendChild(closeBtn);
bar.appendChild(barWord); bar.appendChild(barGloss); bar.appendChild(barActs);
document.documentElement.appendChild(bar);

function showBar(){ bar.style.transform = "none"; }
function hideBar(){ bar.style.transform = "translateY(110%)"; }
sentBtn.addEventListener("click", () => { if(currentSentence) showSentence(currentSentence); });
closeBtn.addEventListener("click", hideBar);
saveBtn.addEventListener("click", () => {
  if(currentKey && currentGloss){
    dict[currentKey] = currentGloss;
    try{ chrome.storage.local.set({egosa_dict: dict}); }catch(e){}
    applyRubyAll();
  }
  hideBar();
});

/* ---------- reading layer ---------- */
function splitSentences(text){
  const m = text.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g);
  return (m || [text]).map(x => x.trim()).filter(Boolean);
}
function wrapUnits(text){
  const frag = document.createDocumentFragment();
  let rest = text;
  while(rest.length){
    let hit = null, hitIdx = -1;
    const lower = rest.toLowerCase();
    for(const ph of PHRASES){
      const idx = lower.indexOf(ph);
      if(idx >= 0 && (hitIdx < 0 || idx < hitIdx || (idx === hitIdx && ph.length > hit.length))){ hit = ph; hitIdx = idx; }
    }
    const upto = hit ? hitIdx : rest.length;
    rest.slice(0, upto).split(/([A-Za-z][A-Za-z'’-]*)/).forEach(part => {
      if(/^[A-Za-z]/.test(part)){
        const span = document.createElement("span");
        span.className = "egosa-w"; span.dataset.w = part.toLowerCase(); span.textContent = part;
        span.addEventListener("click", ev => { ev.stopPropagation(); tapUnit(span, false); });
        frag.appendChild(span);
      } else { frag.appendChild(document.createTextNode(part)); }
    });
    if(hit){
      const span = document.createElement("span");
      span.className = "egosa-w egosa-ph"; span.dataset.w = hit; span.textContent = rest.slice(hitIdx, hitIdx + hit.length);
      span.addEventListener("click", ev => { ev.stopPropagation(); tapUnit(span, true); });
      frag.appendChild(span);
      rest = rest.slice(hitIdx + hit.length);
    } else break;
  }
  return frag;
}
function wrapTextNode(node){
  const frag = document.createDocumentFragment();
  splitSentences(node.nodeValue).forEach(sent => {
    const sEl = document.createElement("span");
    sEl.className = "egosa-s"; sEl.dataset.sent = sent;
    sEl.appendChild(wrapUnits(sent));
    sEl.addEventListener("click", () => tapSentence(sEl));
    frag.appendChild(sEl);
    frag.appendChild(document.createTextNode(" "));
  });
  node.parentNode.replaceChild(frag, node);
}
function isSkippable(node){
  let el = node.parentElement;
  while(el){
    if(el.hasAttribute && el.hasAttribute("data-egosa-ui")) return true;
    if(SKIP_TAGS.has(el.tagName)) return true;
    if(el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}
function applyRubyEl(el){
  const key = el.dataset.w;
  if(key && dict[key] && !el.querySelector("ruby")){
    const ruby = document.createElement("ruby");
    ruby.textContent = el.textContent;
    const rt = document.createElement("rt"); rt.textContent = dict[key];
    ruby.appendChild(rt);
    el.textContent = ""; el.appendChild(ruby);
  }
}
function applyRubyAll(){ document.querySelectorAll(".egosa-w").forEach(applyRubyEl); }

async function tapUnit(el, isPhrase){
  const key = el.dataset.w;
  currentKey = key; currentIsUnit = true;
  const sEl = el.closest(".egosa-s");
  currentSentence = sEl ? (sEl.dataset.sent || "") : "";
  sentBtn.style.display = currentSentence ? "" : "none";
  barWord.textContent = el.textContent.replace(/\s+/g, " ").trim();
  saveBtn.style.display = "";
  showBar();
  if(dict[key]){ currentGloss = dict[key]; barGloss.textContent = dict[key]; return; }
  if(glossCache[key]){ currentGloss = glossCache[key]; barGloss.textContent = currentGloss; return; }
  barGloss.textContent = "調べ中…";
  try{ currentGloss = await translate(key); }catch(e){ currentGloss = ""; }
  if(currentGloss) glossCache[key] = currentGloss;
  barGloss.textContent = currentGloss || "（訳が取れませんでした）";
}
async function tapSentence(el){
  const sent = el.dataset.sent || "";
  if(!sent) return;
  showSentence(sent);
}
async function showSentence(sent){
  currentKey = ""; currentIsUnit = false;
  sentBtn.style.display = "none";
  barWord.textContent = sent.length > 42 ? sent.slice(0, 42) + "…" : sent;
  saveBtn.style.display = "none";
  showBar();
  let t = glossCache["s:" + sent];
  if(!t){
    barGloss.textContent = "翻訳中…";
    try{ t = await translate(sent); }catch(e){ t = ""; }
    if(t) glossCache["s:" + sent] = t;
  }
  currentGloss = t;
  barGloss.textContent = t || "（訳が取れませんでした）";
}

function activate(){
  if(activated) return;
  activated = true;
  launch.textContent = "えごさON";
  launch.style.opacity = ".65";
  const start = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!/[A-Za-z]{2,}/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if(isSkippable(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { if(n.parentNode) wrapTextNode(n); });
    applyRubyAll();
  };
  try{
    chrome.storage.local.get({egosa_dict: {}}, res => { dict = (res && res.egosa_dict) || {}; start(); });
  }catch(e){ start(); }
}
launch.addEventListener("click", activate);
