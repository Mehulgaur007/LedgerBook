/* ======================= data ======================= */
const KEY='pawnledger-v3';
const TPL_REM='Namaste {name} garu,\n\nYour gold/silver pledge ({no}) has interest due.\n\nPledge: {item}\nLoan Amount: {amount}\nInterest Due ({days} days): {interest}\nTotal Payable: {total}\nDue Date: {due}\n\nPlease pay the interest or renew the article at the earliest.\n\nThank you!\n{shop}';
const TPL_OFFER='Namaste {name} garu,\n\nSpecial offer from {shop}: lower interest on new gold loans this month. Visit us or call {phone}.\n\nThank you!';
const DEF={biz:'Swarna Raksha',tag:'Gold & Silver Loans',addr:'Main Bazaar Road',phone:'98480 00000',lic:'',prefix:'PL',rprefix:'R',rpprefix:'RP',
  goldRate:9500,silverRate:120,ltv:75,roi:1.5,tenure:12,minDays:30,remind:90,pin:'1234',tplRem:TPL_REM,tplOffer:TPL_OFFER,
  terms:'1. Interest is charged every month on the loan amount.\n2. Minimum interest of one month applies even if repaid early.\n3. Ornaments are returned only to the pledger on producing this estimate.\n4. If not cleared by the due date, the ornaments may be auctioned after notice.'};
let db=blank(),view='dash',arg=null,q='',fs='',ft='',cq='',aq='',dsel='',paySel='',msgTab='rem',offerSel={};
function blank(){return{settings:{...DEF},customers:[],loans:[],accounts:[{id:'cash',name:'Cash in Hand',type:'cash',num:'',open:0}],txns:[],seq:{loan:0,rcpt:0,cust:0,rp:0}}}
function load(){try{const r=localStorage.getItem(KEY);if(r){const d=JSON.parse(r),b=blank();for(const k in b)if(d[k]===undefined)d[k]=b[k];d.settings={...DEF,...d.settings};return d}}catch(e){}return blank()}
function save(){if(Store.mode==='secure'){Store.persist(db);return}try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){toast('Could not save on this device')}}

/* ======================= helpers ======================= */
const $=s=>document.querySelector(s);
function pad(n,l=2){return String(n).padStart(l,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function today(){return iso(new Date())}
function parse(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function days(a,b){return Math.round((parse(b)-parse(a))/864e5)}
function addDays(s,n){const d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function addMonths(s,n){const d=parse(s),x=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()!==x)d.setDate(0);return iso(d)}
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fdt=s=>{if(!s)return'';const[y,m,d]=s.split('-');return d+' '+MON[+m-1]+' '+y};
const fdn=s=>s?s.split('-').reverse().join('-'):'';
const f=(v,d=0)=>(+v||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const rs=v=>'₹'+f(Math.round(v||0));
const wt=v=>(+v||0).toLocaleString('en-IN',{maximumFractionDigits:3})+'g';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const L=id=>db.loans.find(l=>l.id===id), C=id=>db.customers.find(c=>c.id===id)||{name:'(deleted)',phone:''}, A=id=>db.accounts.find(a=>a.id===id)||db.accounts[0];
const tel=p=>String(p||'').replace(/\D/g,'').slice(-10);
const wa=(p,t)=>'https://wa.me/91'+tel(p)+'?text='+encodeURIComponent(t);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2600)}
const ONES=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],TENS=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const two=n=>n<20?ONES[n]:TENS[Math.floor(n/10)]+(n%10?' '+ONES[n%10]:''),three=n=>(n>=100?ONES[Math.floor(n/100)]+' Hundred'+(n%100?' ':''):'')+(n%100?two(n%100):'');
function words(n){n=Math.round(n);if(!n)return'Zero';let s='';const cr=Math.floor(n/1e7);n%=1e7;const lk=Math.floor(n/1e5);n%=1e5;const th=Math.floor(n/1000);n%=1000;if(cr)s+=words(cr)+' Crore ';if(lk)s+=two(lk)+' Lakh ';if(th)s+=two(th)+' Thousand ';if(n)s+=three(n);return s.trim()}
const PUR={gold:[['91.6','22K'],['99.9','24K'],['83.3','20K'],['75','18K']],silver:[['92.5','925'],['80','80%'],['99.9','999'],['70','70%'],['60','60%']]};
const purLabel=(m,p)=>(PUR[m].find(x=>+x[0]===+p)||[0,p+'%'])[1];

/* ======================= phone app (Android) helpers ======================= */
const NATIVE=()=>{try{return!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())}catch(e){return false}};
const CP=n=>{try{return window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins[n]}catch(e){return null}};
function openExt(u){if(NATIVE()){location.href=u}else window.open(u,'_blank','noopener')}
document.addEventListener('click',e=>{if(!NATIVE())return;const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute('href');if(/^(https?:|tel:|mailto:)/.test(h)){e.preventDefault();openExt(h)}},true);
async function shareText(t){const S=CP('Share');if(NATIVE()&&S){try{await S.share({title:db.settings.biz,text:t})}catch(e){}}else if(navigator.share){try{await navigator.share({text:t})}catch(e){}}else openExt('https://wa.me/?text='+encodeURIComponent(t))}
let shareBuf='';
/* ======================= icons ======================= */
const IC={home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',users:'<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0114 0"/><path d="M3 17a4 4 0 014-3M21 17a4 4 0 00-4-3"/>',
cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v6M18 9v6"/>',card:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
swap:'<path d="M4 8h14l-4-4M20 16H6l4 4"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
bell:'<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',ring:'<circle cx="12" cy="12" r="7"/>',phone:'<path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',pin:'<path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',id:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 016 0M14 10h4M14 13h4"/>',
up:'<path d="M12 19V5M6 11l6-6 6 6"/>',dn:'<path d="M12 5v14M6 13l6 6 6-6"/>',print:'<path d="M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2"/><rect x="7" y="14" width="10" height="6"/>',
unlock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.7"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
bank:'<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',gavel:'<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-6 6 3 3 6-6M8 13l-5 5M13 21h8"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'};
const ico=(k,c='')=>`<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const metalTag=m=>m==='gold'?`<span class="mt gold">${ico('star')}Gold</span>`:m==='silver'?`<span class="mt silver">${ico('ring')}Silver</span>`:`<span class="mt gold">${ico('star')}Mixed</span>`;

/* ======================= interest engine ======================= */
function calc(l,upto){
  upto=upto||today();const daily=l.roi/100/30;let p=l.amount,cur=l.date,acc=0,ip=0,disc=0;
  for(const x of [...l.payments].sort((a,b)=>a.date.localeCompare(b.date)||a.ts-b.ts)){if(x.date>upto)break;acc+=p*daily*Math.max(0,days(cur,x.date));cur=x.date;p-=x.principal;ip+=x.interest;disc+=x.discount||0}
  if(!(l.status!=='active'&&l.closedOn&&l.closedOn<=upto))acc+=p*daily*Math.max(0,days(cur,upto));
  const mn=l.amount*daily*(db.settings.minDays||0);if(acc<mn)acc=mn;
  const principal=Math.max(0,Math.round(p)),due=l.status==='active'?Math.max(0,Math.round(acc-ip-disc)):0;
  return{principal,due,ipaid:ip,days:Math.max(0,days(l.date,upto)),total:principal+due};
}
const status=l=>l.status==='released'?'redeemed':l.status==='auctioned'?'auctioned':(l.rp&&!l.rp.closed)?'repledged':l.due<today()?'overdue':'active';
const SL={active:'Active',repledged:'Repledged',redeemed:'Redeemed',overdue:'Overdue',auctioned:'Auctioned'};
const badge=l=>{const s=status(l);return`<span class="bdg ${s}">${SL[s]}</span>`};
const itemName=l=>l.items.length===1?l.items[0].desc:l.items[0].desc+' +'+(l.items.length-1)+' more';
const lmetal=l=>{const s=new Set(l.items.map(i=>i.metal));return s.size>1?'mixed':[...s][0]};
const lwt=l=>l.items.reduce((a,i)=>a+(+i.net||0),0);
const lastInt=l=>l.payments.reduce((a,p)=>p.date>a?p.date:a,l.date);
const sinceInt=l=>days(lastInt(l),today());
const needsRem=l=>l.status==='active'&&calc(l).due>0&&(sinceInt(l)>=db.settings.remind||l.due<today());
function fill(t,l){const c=C(l.custId),k=calc(l),s=db.settings;return t.replace(/\{(\w+)\}/g,(m,x)=>({name:c.name,no:l?l.no:'',item:l?l.items.map(i=>i.desc).join(', '):'',amount:l?rs(l.amount):'',days:l?sinceInt(l):'',interest:l?rs(k.due):'',total:l?rs(k.total):'',due:l?fdt(l.due):'',shop:s.biz,phone:s.phone}[x]??m))}
function fillC(t,c){const s=db.settings;return t.replace(/\{(\w+)\}/g,(m,x)=>({name:c.name,shop:s.biz,phone:s.phone}[x]??m))}

/* ======================= accounts & ledger ======================= */
function entries(){
  const out=[];
  db.loans.forEach(l=>{const nm=C(l.custId).name;
    out.push({date:l.date,ts:l.ts,acct:l.acct||'cash',amt:-l.amount,t:'New pledge disbursed — '+l.no,s:nm});
    l.payments.forEach(p=>out.push({date:p.date,ts:p.ts,acct:p.acct||'cash',amt:p.amount,t:(p.release?'Redeemed — ':p.principal>0?'Payment received — ':'Interest received — ')+l.no,s:nm}));
    if(l.rp){out.push({date:l.rp.date,ts:l.rp.ts||l.ts,acct:l.rp.acct||'cash',amt:l.rp.amount,t:'Repledge received from '+l.rp.firm,s:l.no});
      if(l.rp.closed)out.push({date:l.rp.closed.date,ts:l.rp.closed.ts,acct:l.rp.closed.acct||'cash',amt:-l.rp.closed.amount,t:'Repledge repaid to '+l.rp.firm,s:l.no})}
    if(l.status==='auctioned'&&l.sale)out.push({date:l.closedOn,ts:l.sale.ts,acct:l.sale.acct||'cash',amt:l.sale.amount,t:'Auction sale — '+l.no,s:nm});
  });
  db.txns.forEach(x=>out.push({date:x.date,ts:x.ts,acct:x.acct,amt:x.amt,t:x.desc,s:x.kind==='adj'?'Balance adjustment':x.kind==='tr'?'Transfer':'Manual entry',id:x.id}));
  return out.sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
}
const bal=id=>{const a=A(id);return(+a.open||0)+entries().filter(e=>e.acct===id).reduce((s,e)=>s+e.amt,0)};
const acctOpts=sel=>db.accounts.map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${E(a.name)}</option>`).join('');
const accCard=(a,btn)=>{const b=bal(a.id);return`<div class="acc ${a.type==='cash'?'cash':'bank'}"><svg class="bg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.2">${IC[a.type==='cash'?'cash':'bank']}</svg><div class="lb">${E(a.name)}</div>${a.num?`<small>XXXX-XXXX-${E(a.num)}</small>`:''}<b>${b<0?'−':''}${rs(Math.abs(b))}</b>${btn?`<button class="btn" onclick="adjModal('${a.id}')">Adjust Balance</button>`:''}</div>`};
const totCard=()=>`<div class="acc tot"><div class="lb">💰 Total Funds</div><b>${rs(db.accounts.reduce((s,a)=>s+bal(a.id),0))}</b><small>Cash + all banks</small></div>`;

/* ======================= shell ======================= */
const NAV=[['dash','Dashboard','home'],['pledges','Pledges','doc'],['customers','Customers','users'],['payments','Payments','cash'],['bank','Cash & Bank','card'],['messages','Messages','chat'],['repledges','Repledges','swap'],['daily','Daily Report','cal'],['settings','Settings','gear']];
const BNAV=[['dash','Home','home'],['pledges','Pledges','doc'],['payments','Payments','cash'],['messages','Messages','chat'],['more','More','menu']];
const navOn=v=>view===v||(view==='pledge'&&v==='pledges')||(view==='doc'&&v==='pledges');
function shell(){
  document.body.classList.remove('gated','menu');
  const rc=db.loans.filter(needsRem).length,nb=v=>v==='messages'&&rc?`<span class="nb">${rc}</span>`:'';
  $('#side').innerHTML=`<div class="brand"><b>${E(db.settings.biz)}</b><small>${E(db.settings.tag)}</small></div><nav>${NAV.map(n=>`<button class="${navOn(n[0])?'on':''}" onclick="go('${n[0]}')">${ico(n[2])}${n[1]}${nb(n[0])}</button>`).join('')}</nav>
   <div class="sfoot"><span>v${APPV}${SECURE()?'':' · preview'}</span><button onclick="lockNow()">${'Lock'}</button></div>`;
  $('#bnav').innerHTML=BNAV.map(n=>`<button class="${n[0]==='more'?'':navOn(n[0])?'on':''}" onclick="${n[0]==='more'?"document.body.classList.toggle('menu')":`go('${n[0]}')`}"><span>${ico(n[2])}</span>${n[1]}${nb(n[0])}</button>`).join('');
}
function go(v,a){view=v;arg=a??null;render();window.scrollTo(0,0)}
function render(){shell();$('#app').innerHTML=(V[view]||V.dash)();if(view==='pledges')drawPledges();if(view==='customers')drawCust();if(view==='payments')payCalc()}

/* ======================= gate (licence + password) ======================= */
const SECURE=()=>Store.mode==='secure';
const devWord=()=>Store.platform==='android'?'phone':'computer';
let adm='cp';
function showGate(m){
  document.body.classList.add('gated');
  if(!SECURE()){$('#app').innerHTML=`<div class="gate"><form class="gcard" onsubmit="unlock(event)"><h1>${E(db.settings.biz)}</h1><div class="mu">${E(db.settings.tag)}</div>
   <input id="gp" type="password" autocomplete="off" placeholder="Password"><button class="btn">${ico('unlock')}Unlock</button>${m?`<p class="rd" style="margin:12px 0 0">${m}</p>`:''}
   <p class="mu" style="font-size:13px;margin:16px 0 0">${db.settings.pin==='1234'?'Online preview – password is 1234.':'Pawn Ledger · online preview'}</p></form></div>`;setTimeout(()=>{const i=$('#gp');if(i)i.focus()},50);return}
  const g=Store.gate,lab=Store.label||'Pawn Ledger',mid=Store.machine;
  const idBox=mid?`<div class="mid"><span>Machine ID</span><input id="gmid" readonly value="${E(mid)}" onclick="this.select()"><button class="btn s sm" onclick="copyId()">${ico('copy')}Copy</button></div>`:'';
  const msg=`<div id="gmsg" class="gmsg">${m?E(m):''}</div>`,owner=`<button class="lnk" onclick="Store.gate='admin';showGate()">Owner / Admin</button>`,back=`<button class="lnk" onclick="Store.gate='login';showGate()">← Back to login</button>`;
  const P=(id,ph)=>`<input id="${id}" class="p" type="password" placeholder="${ph}" autocomplete="new-password">`;
  const body=g==='login'?`<p class="mu">Enter your password to open the ledger.</p><input id="gpw" type="password" autocomplete="current-password" placeholder="Password" onkeydown="if(event.key==='Enter')doUnlock()"><button class="btn" onclick="doUnlock()">${ico('unlock')}Unlock</button>${msg}${owner}`
   :g==='activate'||g==='wronglicense'?`<p><b>${g==='activate'?'Activate Pawn Ledger on this '+devWord():'This licence belongs to a different '+devWord()}</b></p><p class="mu">Send this Machine ID to the owner. Paste the activation code you receive.</p>${idBox}<textarea id="gcode" placeholder="Paste the activation code"></textarea><button class="btn" style="margin-top:10px" onclick="doActivate()">${ico('check')}Activate</button>${msg}`
   :g==='setpw'?`<p><b>Activated. Now choose the login password.</b></p><input id="glab" class="p" placeholder="Shop name (shown on the login screen)" value="${E(DEF.biz)}">${P('gp1','Password (min 6 characters)')}${P('gp2','Confirm password')}<button class="btn" style="margin-top:12px" onclick="doSetPw()">${ico('save')}Save and open</button>${msg}<p class="mu" style="font-size:13px">If the password is forgotten, only the owner can reset it, and the old data cannot be opened again.</p>`
   :g==='admin'?`<p><b>Owner / Admin</b></p><p class="mu">Send this Machine ID to the owner. Paste today’s admin code.</p>${idBox}<textarea id="gcode" placeholder="Paste the admin code"></textarea><button class="btn" style="margin-top:10px" onclick="doAdmin()">Continue</button>${msg}${back}`
   :g==='adminpanel'?`<div class="gseg">${[['cp','Change password'],['rp','Forgot password'],['un','Uninstall']].map(t=>`<button class="${adm===t[0]?'on':''}" onclick="adm='${t[0]}';showGate()">${t[1]}</button>`).join('')}</div>`+
     (adm==='cp'?`<p class="mu">All data is kept and re-encrypted with the new password.</p>${P('ao','Current password')}${P('a1','New password (min 6 characters)')}${P('a2','Confirm new password')}<button class="btn" style="margin-top:12px" onclick="doChangePw()">${ico('lock')}Change password</button>`
     :adm==='rp'?`<p class="mu">Use only if the password is forgotten. The old data stays locked (kept aside, encrypted) and a fresh, empty ledger starts with the new password.</p>${P('a1','New password (min 6 characters)')}${P('a2','Confirm new password')}<button class="btn x" style="margin-top:12px" onclick="doResetPw()">Reset password</button>`
     :`<p class="mu">Removes the licence and ALL data from this ${devWord()}${Store.platform==='windows'?', then starts the Windows uninstaller':''}. Take a backup first (Settings → Backup) if the data is needed.</p><input id="aer" class="p" placeholder="Type ERASE to confirm"><button class="btn x" style="margin-top:12px" onclick="doErase()">${ico('trash')}Erase and uninstall</button>`)+msg+back
   :g==='erased'?`<p><b>Pawn Ledger has been removed from this ${devWord()}.</b></p><p class="mu">${Store.platform==='android'?'Now uninstall the app: press and hold the Pawn Ledger icon → Uninstall.':'If the Windows uninstaller did not open, close this window.'}</p>`
   :'<p><b>Pawn Ledger could not read its installation.</b></p><p class="mu">Please close Pawn Ledger and open it again.</p>';
  $('#app').innerHTML=`<div class="gate"><div class="gcard${['activate','wronglicense','admin','adminpanel'].includes(g)?' wide':''}"><h1>${E(lab)}</h1><div class="mu">${E(DEF.tag)}</div>${body}<p class="mu" style="font-size:12.5px;margin:18px 0 0">Pawn Ledger · v${APPV}</p></div></div>`;
  setTimeout(()=>{const p=$('#gpw')||$('#gcode')||$('#gp1')||$('#ao')||$('#a1');if(p)p.focus()},60);
}
const APPV='1.0.0';
const gmsg=(t,ok)=>{const m=$('#gmsg');if(m){m.textContent=t;m.className='gmsg '+(ok?'ok':'bad')}};
function copyId(){const i=$('#gmid');i.select();try{navigator.clipboard.writeText(i.value).catch(()=>document.execCommand('copy'))}catch(e){document.execCommand('copy')}gmsg('Machine ID copied.',1)}
function unlock(e){e.preventDefault();if(val('gp')===db.settings.pin){try{sessionStorage.setItem(KEY+'-o','1')}catch(_){}go('dash')}else showGate('Wrong password. Try again.')}
async function doUnlock(){const pw=val('gpw');if(!pw)return;gmsg('Checking…',1);let d=null;try{d=await Store.unlock(pw,blank())}catch(e){return gmsg('Could not open the data file.')}
  if(!d){gmsg('Wrong password. Please try again.');$('#gpw').value='';return}db=fix(d);go('dash')}
async function doActivate(){gmsg('Checking…',1);if(await Store.activate(val('gcode')))showGate();else gmsg('This activation code is not valid for this Machine ID.')}
async function doSetPw(){const a=val('gp1');if(a.length<6)return gmsg('The password must be at least 6 characters.');if(a!==val('gp2'))return gmsg('The two passwords do not match.');
  gmsg('Saving…',1);const fresh=blank(),lab=val('glab').trim();if(lab)fresh.settings.biz=lab;db=await Store.setPassword(lab,a,fresh);go('dash')}
async function doAdmin(){gmsg('Checking…',1);if(await Store.adminCheck(val('gcode'))){Store.gate='adminpanel';adm='cp';showGate()}else gmsg('This admin code is not valid for this Machine ID today.')}
async function doChangePw(){const a=val('a1');if(a.length<6)return gmsg('The new password must be at least 6 characters.');if(a!==val('a2'))return gmsg('The two new passwords do not match.');
  gmsg('Working…',1);try{await Store.changePassword(val('ao'),a,blank());gmsg('Password changed. All data was kept.',1)}catch(e){gmsg(e.message)}}
async function doResetPw(){const a=val('a1');if(a.length<6)return gmsg('The new password must be at least 6 characters.');if(a!==val('a2'))return gmsg('The two new passwords do not match.');
  if(!confirm('Reset the password? The current data will stay locked and a fresh, empty ledger starts.'))return;try{await Store.resetPassword(a,blank());showGate('Password reset. Log in with the new password.');gmsg('Password reset. Log in with the new password.',1)}catch(e){gmsg(e.message)}}
async function doErase(){if(val('aer').trim().toUpperCase()!=='ERASE')return gmsg('Type ERASE to confirm.');try{await Store.eraseAll();showGate();await Store.uninstall()}catch(e){gmsg(e.message)}}
async function lockNow(){closeModal();if(SECURE()){await Store.lock();db=blank();showGate()}else{try{sessionStorage.removeItem(KEY+'-o')}catch(_){}showGate()}}
function fix(d){const b=blank();for(const k in b)if(d[k]===undefined)d[k]=b[k];d.settings={...DEF,...d.settings};return d}

/* ---------- backup / restore ---------- */
async function doBackup(){const t=await Store.backupText(db),nm='pawnledger-backup-'+today()+(SECURE()?'.enc':'.json');
  if(NATIVE()&&CP('Filesystem')&&CP('Share')){try{const r=await CP('Filesystem').writeFile({path:nm,data:t,directory:'CACHE',encoding:'utf8'});await CP('Share').share({title:'Pawn Ledger backup',text:'Pawn Ledger backup '+today(),files:[r.uri]});toast('Backup ready – save it to Drive or WhatsApp')}catch(e){if(!/cancel/i.test(String(e&&e.message)))alert('Could not create the backup: '+(e&&e.message||e))}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));a.download='pawnledger-backup-'+today()+(SECURE()?'.enc':'.json');document.body.appendChild(a);a.click();a.remove();toast('Backup saved')}
function doRestore(inp){const fl=inp.files[0];if(!fl)return;const r=new FileReader();r.onload=async()=>{try{let d;try{d=await Store.readBackup(r.result)}catch(e){const pw=prompt('This backup was made with a different password. Enter that password:');d=await Store.readBackup(r.result,pw)}
  if(!d||!d.loans||!d.customers)throw 0;if(!confirm('Replace all current data with this backup?'))return;db=fix(d);save();toast('Backup restored');go('dash')}catch(e){alert('This is not a valid Pawn Ledger backup (or the password is wrong).')}};r.readAsText(fl);inp.value=''}

/* ======================= modal ======================= */
function modal(title,body,foot){$('#modal').innerHTML=`<div class="mod"><div class="mh"><h2>${title}</h2><button onclick="closeModal()" aria-label="Close">${ico('x')}</button></div><div class="mb">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div>`;$('#modal').classList.add('open')}
function closeModal(){$('#modal').classList.remove('open')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

/* ======================= views ======================= */
const V={};
const stat=(l,v,icon,cl,sm='')=>`<div class="stat"><span>${l}</span>${ico(icon,cl)}<b class="${cl}">${v}</b>${sm?`<small>${sm}</small>`:''}</div>`;
V.dash=()=>{
  const t=today(),act=db.loans.filter(l=>l.status==='active');let out=0,due=0,g=0,s=0,mi=0;
  act.forEach(l=>{const c=calc(l);out+=c.principal;due+=c.due;l.items.forEach(i=>i.metal==='gold'?g+=+i.net:s+=+i.net)});
  db.loans.forEach(l=>l.payments.forEach(p=>{if(p.date.slice(0,7)===t.slice(0,7))mi+=Math.max(0,p.interest-(p.discount||0))}));
  const rp=act.filter(l=>l.rp&&!l.rp.closed).length,rc=db.loans.filter(needsRem).length;
  const recent=act.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts).slice(0,8);
  return`<div class="ph"><div><h1 class="pg">Dashboard</h1><div class="sub">${E(db.settings.biz)} — Money Lending Management</div></div><button class="btn" onclick="pledgeModal()">${ico('plus')}New Pledge</button></div>
  <div class="stats">${stat('Active Pledges',act.length,'doc','or')}${stat('Total Lent',rs(out),'cash','gr')}${stat('Customers',db.customers.length,'users','vi')}${stat('Repledged',rp,'swap','or')}${stat('Pending Reminders',rc,'bell','rd','Interest due >'+db.settings.remind+' days')}</div>
  <div class="accs">${db.accounts.map(a=>accCard(a)).join('')}${totCard()}</div>
  <div class="stats">${stat('Interest due till today',rs(due),'cash','int')}${stat('Interest earned this month',rs(mi),'up','gr')}${stat('Gold in locker',wt(g),'star','yl')}${stat('Silver in locker',wt(s),'ring','mu')}${stat('Overdue pledges',act.filter(l=>l.due<t).length,'bell','rd')}</div>
  <div class="panel"><div class="panel-h"><h2>Recent Active Pledges</h2><button class="btn s sm" onclick="go('pledges')">View all</button></div>
   ${recent.length?`<div class="tw"><table><thead><tr><th>Pledge No</th><th>Customer</th><th>Item</th><th>Loan</th><th>Interest (today)</th><th>Due Date</th><th>Status</th></tr></thead><tbody>
   ${recent.map(l=>`<tr style="cursor:pointer" onclick="go('pledge','${l.id}')"><td class="pno">${E(l.no)}</td><td>${E(C(l.custId).name)}</td><td>${E(itemName(l))}</td><td class="money">${rs(l.amount)}</td><td class="int b">${rs(calc(l).due)}</td><td>${fdt(l.due)}</td><td>${badge(l)}</td></tr>`).join('')}</tbody></table></div>`
   :`<div class="empty">No active pledges yet. <button class="lnk" onclick="pledgeModal()">Create the first pledge</button> or <button class="lnk" onclick="seed()">load demo data</button>.</div>`}</div>`;
};

/* ---------- pledges ---------- */
V.pledges=()=>`<div class="ph"><h1 class="pg">Pledges</h1><button class="btn" onclick="pledgeModal()">${ico('plus')}New Pledge</button></div>
 <div class="search">${ico('search')}<input placeholder="Search pledge no, customer, item…" value="${E(q)}" oninput="q=this.value;drawPledges()"></div>
 <div class="filters"><select onchange="fs=this.value;drawPledges()"><option value="">All Status</option>${Object.keys(SL).map(k=>`<option value="${k}" ${fs===k?'selected':''}>${SL[k]}</option>`).join('')}</select>
 <select onchange="ft=this.value;drawPledges()"><option value="">All Types</option><option value="gold" ${ft==='gold'?'selected':''}>Gold</option><option value="silver" ${ft==='silver'?'selected':''}>Silver</option><option value="mixed" ${ft==='mixed'?'selected':''}>Mixed</option></select></div>
 <div class="panel" id="pt"></div>`;
function drawPledges(){const s=q.trim().toLowerCase();
  const R=db.loans.filter(l=>(!fs||status(l)===fs)&&(!ft||lmetal(l)===ft)&&(!s||[l.no,C(l.custId).name,C(l.custId).phone,l.items.map(i=>i.desc).join(' ')].join(' ').toLowerCase().includes(s))).sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
  $('#pt').innerHTML=R.length?`<div class="tw"><table><thead><tr><th>Pledge No</th><th>Customer</th><th>Type</th><th>Item</th><th>Weight</th><th>Loan Amt</th><th>Rate%</th><th>Pledge Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
  ${R.map(l=>`<tr><td class="pno">${E(l.no)}</td><td>${E(C(l.custId).name)}</td><td>${metalTag(lmetal(l))}</td><td>${E(itemName(l))}</td><td>${wt(lwt(l))}</td><td class="money">${rs(l.amount)}</td><td>${l.roi}%</td><td>${fdt(l.date)}</td><td>${badge(l)}</td><td><button class="btn bl sm" onclick="go('pledge','${l.id}')">${ico('eye')}View</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No pledges match.</div>'}

/* ---------- new pledge modal ---------- */
function itemRow(first){return`<div class="irow"><div><label>Item Type *</label><select class="i-m" onchange="purOpts(this)"><option value="gold">🥇 Gold</option><option value="silver">🥈 Silver</option></select></div>
 <div class="wide"><label>Item Description *</label><input class="i-d" placeholder="e.g. Gold Necklace 22K"></div><div><label>Purity</label><select class="i-p">${PUR.gold.map(p=>`<option value="${p[0]}">${p[1]}</option>`).join('')}</select></div>
 <div><label>Weight (g) *</label><input class="i-w" type="number" inputmode="decimal" step="0.001" placeholder="25.5" oninput="pvCalc()"></div>${first?'<div></div>':`<button class="icb" title="Remove item" onclick="this.parentNode.remove();pvCalc()">${ico('trash')}</button>`}</div>`}
function purOpts(sel){const p=sel.closest('.irow').querySelector('.i-p');p.innerHTML=PUR[sel.value].map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('');pvCalc()}
function pledgeModal(custId){
  const s=db.settings,t=today();
  modal('New Pledge Entry',`<div class="fg">
   <div class="full"><label>Customer *</label><select id="p-c" onchange="$('#newc').hidden=this.value!=='new'"><option value="">— Select customer —</option><option value="new">➕ New customer…</option>${db.customers.map(c=>`<option value="${c.id}" ${c.id===custId?'selected':''}>${E(c.name)} — ${E(c.phone)}</option>`).join('')}</select></div>
   <div class="full" id="newc" hidden><div class="fg"><div><label>Name *</label><input id="nc-n"></div><div><label>Phone *</label><input id="nc-p" type="tel" inputmode="tel"></div><div class="full"><label>Address</label><input id="nc-a"></div></div></div>
  </div>
  <div id="items">${itemRow(true)}</div><button class="lnk" onclick="$('#items').insertAdjacentHTML('beforeend',itemRow(false))">+ Add another item</button>
  <div class="fg" style="margin-top:16px">
   <div><label>Loan Amount (₹) *</label><input id="p-a" type="number" inputmode="numeric" placeholder="e.g. 85000" oninput="pvCalc()"><div class="hint" id="p-hint"></div></div>
   <div><label>Interest Rate (% per month)</label><input id="p-r" type="number" inputmode="decimal" step="0.05" value="${s.roi}"></div>
   <div><label>Pledge Date</label><input id="p-d" type="date" value="${t}" oninput="if(!$('#p-due').dataset.t)$('#p-due').value=addMonths(this.value,${s.tenure})"></div>
   <div><label>Due Date (default: ${s.tenure} months)</label><input id="p-due" type="date" value="${addMonths(t,s.tenure)}" oninput="this.dataset.t=1"></div>
   <div><label>Paid From</label><select id="p-acct">${acctOpts('cash')}</select></div><div><label>Notes</label><input id="p-n" placeholder="Optional"></div>
  </div>
  <div class="chk"><label><input type="checkbox" id="p-rp" onchange="$('#rpf').hidden=!this.checked">🏦 Add Repledge to Finance Firm</label>
   <div id="rpf" hidden style="margin-top:14px">${rpFields()}</div></div>`,
  `<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="savePledge()">Save Pledge</button>`);
  pvCalc();
}
const rpFields=(r={})=>`<div class="fg"><div><label>Finance Firm / Bank *</label><input id="rp-f" value="${E(r.firm||'')}" placeholder="e.g. Punjab National Bank"></div><div><label>Serial / Ref No.</label><input id="rp-s" value="${E(r.serial||db.settings.rpprefix+'-'+pad(db.seq.rp+1,3))}"></div>
 <div><label>Amount Received (₹) *</label><input id="rp-a" type="number" inputmode="numeric" value="${r.amount||''}"></div><div><label>Repledge Date</label><input id="rp-d" type="date" value="${r.date||today()}"></div>
 <div><label>Interest at Firm (% per month)</label><input id="rp-r" type="number" step="0.05" value="${r.roi||''}" placeholder="Optional"></div><div><label>Received In</label><select id="rp-ac">${acctOpts(r.acct||'cash')}</select></div></div>`;
function readItems(){return[...document.querySelectorAll('#items .irow')].map(r=>{const m=r.querySelector('.i-m').value,w=+r.querySelector('.i-w').value||0,p=+r.querySelector('.i-p').value;return{metal:m,desc:r.querySelector('.i-d').value.trim(),purity:p,net:w,gross:w,pcs:1,value:Math.round(w*p/100*(m==='gold'?db.settings.goldRate:db.settings.silverRate))}})}
function pvCalc(){const h=$('#p-hint');if(!h)return;const it=readItems(),v=it.reduce((a,i)=>a+i.value,0),el=Math.floor(v*db.settings.ltv/10000)*100,a=+val('p-a')||0;
  h.innerHTML=v?`Ornament value ${rs(v)} · eligible ${rs(el)} at ${db.settings.ltv}%${a>el?' · <span class="rd">above eligible</span>':''}`:''}
function rpRead(){const firm=val('rp-f').trim(),amount=Math.round(+val('rp-a')||0);if(!firm||amount<=0)return null;return{firm,serial:val('rp-s').trim(),amount,date:val('rp-d')||today(),roi:+val('rp-r')||0,acct:val('rp-ac'),ts:Date.now()}}
function savePledge(){
  let cid=val('p-c');
  if(cid==='new'){const n=val('nc-n').trim(),p=val('nc-p').trim();if(!n||!p)return toast('Enter the new customer’s name and phone');cid=addCust({name:n,phone:p,addr:val('nc-a').trim()})}
  if(!cid)return toast('Select a customer');
  const items=readItems();if(items.some(i=>!i.desc||!(i.net>0)))return toast('Fill the description and weight for every item');
  const amt=Math.round(+val('p-a')||0);if(amt<=0)return toast('Enter the loan amount');
  const d=val('p-d'),due=val('p-due');if(!d||!due)return toast('Pick the pledge and due dates');
  let rp=null;if($('#p-rp').checked){rp=rpRead();if(!rp)return toast('Enter the firm name and repledge amount');db.seq.rp++}
  db.seq.loan++;const y=d.slice(0,4);
  const l={id:uid(),no:db.settings.prefix+'-'+y+'-'+pad(db.seq.loan,3),custId:cid,date:d,due,ts:Date.now(),items,amount:amt,roi:+val('p-r')||db.settings.roi,acct:val('p-acct'),notes:val('p-n').trim(),
    goldRate:db.settings.goldRate,silverRate:db.settings.silverRate,value:items.reduce((a,i)=>a+i.value,0),status:'active',payments:[],rp};
  db.loans.push(l);save();closeModal();toast('Pledge '+l.no+' saved');go('doc',{k:'loan',id:l.id});
}

/* ---------- pledge detail ---------- */
V.pledge=()=>{const l=L(arg);if(!l)return'<h1 class="pg">Pledge not found</h1>';const c=calc(l),cu=C(l.custId),open=l.status==='active',t=today(),dd=days(t,l.due);
 return`<div class="ph"><div><h1 class="pg">${E(l.no)} ${badge(l)}</h1><div class="sub">${E(cu.name)} · ${fdt(l.date)}</div></div>
  <div class="btns">${open?`<button class="btn" onclick="go('payments','${l.id}')">${ico('cash')}Record Payment</button><button class="btn s" onclick="paySel='${l.id}';go('payments','${l.id}');setTimeout(()=>{$('#py-t').value='release';payCalc(true)},0)">${ico('unlock')}Redeem</button>`:''}
  <button class="btn s" onclick="go('doc',{k:'loan',id:'${l.id}'})">${ico('print')}Estimate</button>${open&&cu.phone?`<a class="btn wa" href="${wa(cu.phone,fill(db.settings.tplRem,l))}" target="_blank" rel="noopener">${ico('chat')}WhatsApp</a>`:''}</div></div>
 <div class="side2"><div>
  <div class="panel"><div class="panel-h"><h2>Customer</h2><button class="btn s sm" onclick="custModal('${cu.id}')">${ico('edit')}Edit</button></div><div class="panel-b"><div class="kv"><span>Name</span><b>${E(cu.name)}${cu.rel?', '+E(cu.rel):''}</b><span>Phone</span><b>${cu.phone?`<a href="tel:${E(cu.phone)}">${E(cu.phone)}</a>`:'–'}</b><span>Address</span><b>${E(cu.addr)||'–'}</b><span>ID proof</span><b>${cu.idNo?E(cu.idType)+' '+E(cu.idNo):'–'}</b></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Articles Pledged</h2></div><div class="tw"><table><thead><tr><th>Item</th><th>Type</th><th>Purity</th><th>Weight</th><th class="n">Est. Value</th></tr></thead><tbody>
   ${l.items.map(i=>`<tr><td>${E(i.desc)}</td><td>${metalTag(i.metal)}</td><td>${purLabel(i.metal,i.purity)}</td><td>${wt(i.net)}</td><td class="n">${rs(i.value)}</td></tr>`).join('')}<tr class="tot"><td colspan="3">Total</td><td>${wt(lwt(l))}</td><td class="n">${rs(l.value)}</td></tr></tbody></table></div>${l.notes?`<div class="panel-b mu">Notes: ${E(l.notes)}</div>`:''}</div>
  <div class="panel"><div class="panel-h"><h2>Payments</h2></div>${l.payments.length?`<div class="tw"><table><thead><tr><th>Receipt</th><th>Date</th><th>Account</th><th class="n">Received</th><th class="n">Interest</th><th class="n">Principal</th><th class="n">Discount</th><th></th></tr></thead><tbody>
   ${[...l.payments].sort((a,b)=>a.date.localeCompare(b.date)).map(p=>`<tr><td class="pno">${E(p.rno)}${p.release?' <span class="bdg redeemed">Redeem</span>':''}</td><td>${fdt(p.date)}</td><td>${E(A(p.acct).name)}</td><td class="n money">${rs(p.amount)}</td><td class="n">${rs(p.interest)}</td><td class="n">${rs(p.principal)}</td><td class="n">${p.discount?rs(p.discount):'–'}</td><td><button class="btn s sm" onclick="go('doc',{k:'pay',id:'${l.id}',p:'${p.id}'})">${ico('print')}Receipt</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No payments yet.</div>'}</div>
  <div class="panel"><div class="panel-h"><h2>Repledge</h2>${open&&!l.rp?`<button class="btn s sm" onclick="rpModal('${l.id}')">${ico('plus')}Repledge to firm</button>`:''}</div><div class="panel-b">${l.rp?rpBox(l):'<span class="mu">This article is in our locker.</span>'}</div></div>
  <div class="btns np">${open?`<button class="btn s" onclick="auctionModal('${l.id}')">${ico('gavel')}Mark Auctioned</button>`:''}<button class="btn x" onclick="delPledge('${l.id}')">${ico('trash')}Delete Pledge</button></div>
 </div>
 <div class="panel"><div class="panel-h"><h2>Account as on today</h2></div><div class="panel-b"><div class="sumbox">
  <span>Loan amount</span><span class="n money">${rs(l.amount)}</span><span>Interest rate</span><span class="n">${l.roi}% / month</span><span>Paid from</span><span class="n">${E(A(l.acct).name)}</span><span>Days running</span><span class="n">${c.days}</span>
  <span>Principal balance</span><span class="n">${rs(c.principal)}</span><span>Interest paid</span><span class="n">${rs(c.ipaid)}</span>${open?`<span>Interest due</span><span class="n int">${rs(c.due)}</span>`:''}
  <span>Due date</span><span class="n ${open&&dd<0?'rd':''}">${fdt(l.due)}${open&&dd<0?` (${-dd} days overdue)`:''}</span>${l.closedOn?`<span>${l.status==='released'?'Redeemed on':'Auctioned on'}</span><span class="n">${fdt(l.closedOn)}</span>`:''}
  ${open?`<span class="g">Total payable</span><span class="n g or">${rs(c.total)}</span>`:''}</div>
  ${open?`<div style="margin-top:18px"><label>Check interest on a date</label><input type="date" value="${t}" oninput="chk('${l.id}',this.value)"><div class="hint" id="chk"></div></div>`:''}</div></div>
 </div>`};
const rpBox=l=>{const r=l.rp;return`<div class="rbox"><div class="cap">🏦 Repledge details</div><b class="or" style="font-size:16px">Serial: ${E(r.serial||'–')}</b><div>Firm: ${E(r.firm)}</div><div class="gr b">Amount: ${rs(r.amount)}</div><div class="mu">Date: ${fdt(r.date)}${r.roi?` · ${r.roi}%/mo`:''} · Ref: ${E(l.no)}</div>
 ${r.closed?`<div class="bl" style="margin-top:6px">Repaid ${rs(r.closed.amount)} on ${fdt(r.closed.date)} — article back in locker</div>`:''}</div>`};
function chk(id,d){const l=L(id);if(!d||d<l.date){$('#chk').textContent='Pick a date after the pledge date.';return}const c=calc(l,d);$('#chk').innerHTML=`On ${fdt(d)}: interest <b class="int">${rs(c.due)}</b> for ${c.days} days · total <b class="or">${rs(c.total)}</b>`}
function delPledge(id){if(!confirm('Delete this pledge with all its payments? This cannot be undone.'))return;db.loans=db.loans.filter(l=>l.id!==id);save();toast('Pledge deleted');go('pledges')}
function auctionModal(id){const l=L(id),c=calc(l);modal('Mark as Auctioned — '+E(l.no),`<p class="mu" style="margin-top:0">Balance due: ${rs(c.total)}. Record what the article sold for.</p><div class="fg"><div><label>Sale Amount (₹)</label><input id="au-a" type="number" inputmode="numeric" value="${c.total}"></div><div><label>Received In</label><select id="au-ac">${acctOpts('cash')}</select></div><div><label>Date</label><input id="au-d" type="date" value="${today()}"></div></div>`,
 `<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveAuction('${id}')">Save</button>`)}
function saveAuction(id){const l=L(id);l.status='auctioned';l.closedOn=val('au-d')||today();l.sale={amount:Math.round(+val('au-a')||0),acct:val('au-ac'),ts:Date.now()};save();closeModal();toast('Marked as auctioned');render()}

/* ---------- payments ---------- */
V.payments=()=>{if(arg)paySel=arg;const act=db.loans.filter(l=>l.status==='active').sort((a,b)=>a.no.localeCompare(b.no)),att=db.loans.filter(needsRem).sort((a,b)=>sinceInt(b)-sinceInt(a));
 return`<div class="ph"><h1 class="pg">Record Payment</h1></div><div class="two">
 <div class="panel"><div class="panel-b"><h2 style="font-weight:400;margin-bottom:6px">Payment Entry</h2>
  <label>Select Active Pledge</label><select id="py-l" onchange="paySel=this.value;payCalc(true)"><option value="">-- Select Pledge --</option>${act.map(l=>`<option value="${l.id}" ${l.id===paySel?'selected':''}>${E(l.no)} — ${E(C(l.custId).name)} — ${E(itemName(l))}</option>`).join('')}</select>
  <div id="py-sum" style="margin:16px 0"></div>
  <div class="fg"><div><label>Payment Type</label><select id="py-t" onchange="payCalc(true)"><option value="pay">Interest / part payment</option><option value="release">Redeem & close (return article)</option></select></div>
   <div><label>Date</label><input id="py-d" type="date" value="${today()}" oninput="payCalc(true)"></div>
   <div><label>Payment Amount (₹)</label><input id="py-a" type="number" inputmode="numeric" placeholder="Enter amount received" oninput="this.dataset.t=1;payCalc()"></div>
   <div><label>Received In</label><select id="py-ac">${acctOpts('cash')}</select></div>
   <div class="full"><label>Note (optional)</label><input id="py-n" placeholder="e.g. Interest payment, Part payment…"></div></div>
  <div class="hint" id="py-split"></div>
  <button class="btn" id="py-btn" style="width:100%;margin-top:16px" onclick="savePay()" disabled>Record Payment</button></div></div>
 <div class="panel"><div class="panel-b"><h2 style="font-weight:400;margin-bottom:12px">Pledges Needing Attention</h2>
  ${att.length?att.map(l=>{const c=calc(l),od=days(l.due,today());return`<button class="att" onclick="paySel='${l.id}';$('#py-l').value='${l.id}';payCalc(true);window.scrollTo(0,0)"><div class="r1"><span class="pno">${E(l.no)}</span><span class="dd">${od>0?od+' days overdue':sinceInt(l)+' days since interest'}</span></div><div>${E(C(l.custId).name)} — ${E(itemName(l))}</div><div class="rd b">Interest Due: ${rs(c.due)}</div></button>`}).join(''):'<div class="empty">All pledges are up to date.</div>'}
 </div></div></div>`};
function payCalc(reset){const id=val('py-l'),btn=$('#py-btn');if(!btn)return;const l=id&&L(id);btn.disabled=!l;
 if(!l){$('#py-sum').innerHTML='';$('#py-split').textContent='';return}
 const d=val('py-d')||today(),rel=val('py-t')==='release',a=$('#py-a');if(reset)delete a.dataset.t;
 if(d<l.date){$('#py-sum').innerHTML='<span class="rd">Date is before the pledge date</span>';return}
 const c=calc(l,d);$('#py-sum').innerHTML=`<div class="rbox"><div class="sumbox"><span>Principal balance</span><span class="n">${rs(c.principal)}</span><span>Interest due (${c.days} days)</span><span class="n int">${rs(c.due)}</span><span class="g">Total to redeem</span><span class="n g or">${rs(c.total)}</span></div></div>`;
 if(!a.dataset.t)a.value=rel?c.total:c.due;const v=+a.value||0;
 btn.textContent=rel?'Redeem & Print':'Record Payment';
 if(rel){const ds=Math.max(0,c.total-v);$('#py-split').textContent=ds?'Discount given: '+rs(ds):''}
 else{const i=Math.min(v,c.due),p=Math.min(v-i,c.principal);$('#py-split').textContent=v?`${rs(i)} to interest · ${rs(p)} to principal${p>=c.principal&&c.principal?' · this closes the pledge':''}`:''}}
function savePay(){const l=L(val('py-l'));if(!l)return;const d=val('py-d'),rel=val('py-t')==='release',amt=Math.round(+val('py-a')||0);
 if(!d||d<l.date)return toast('Check the payment date');const c=calc(l,d);if(amt>c.total)return toast('That is more than the total of '+rs(c.total));
 if(rel&&l.rp&&!l.rp.closed&&!confirm('This article is still repledged with '+l.rp.firm+'. Redeem anyway?'))return;
 let interest,principal,discount=0;if(rel){interest=c.due;principal=c.principal;discount=c.total-amt}else{if(amt<=0)return toast('Enter the amount received');interest=Math.min(amt,c.due);principal=Math.min(amt-interest,c.principal)}
 db.seq.rcpt++;const p={id:uid(),rno:db.settings.rprefix+'-'+pad(db.seq.rcpt,4),date:d,ts:Date.now(),amount:amt,interest,principal,discount,acct:val('py-ac'),note:val('py-n').trim(),release:rel};
 l.payments.push(p);if(rel||c.principal-principal<=0){l.status='released';l.closedOn=d;p.release=true}
 paySel='';save();toast(p.release?'Pledge redeemed':'Payment recorded');go('doc',{k:'pay',id:l.id,p:p.id})}

/* ---------- customers ---------- */
V.customers=()=>`<div class="ph"><h1 class="pg">Customers</h1><button class="btn" onclick="custModal()">${ico('plus')}Add Customer</button></div>
 <div class="search">${ico('search')}<input placeholder="Search by name or phone…" value="${E(cq)}" oninput="cq=this.value;drawCust()"></div><div class="cgrid" id="cg"></div>`;
function drawCust(){const s=cq.trim().toLowerCase();const R=db.customers.filter(c=>!s||(c.name+' '+c.phone).toLowerCase().includes(s));
 $('#cg').innerHTML=R.length?R.map(c=>{const ls=db.loans.filter(l=>l.custId===c.id),act=ls.filter(l=>l.status==='active');
  return`<button class="ccard" onclick="custView('${c.id}')"><div class="top"><div><div class="nm">${E(c.name)}</div><div class="mu" style="font-size:14px">Since ${fdt(c.since)}</div></div><span class="tag">#${c.no}</span></div>
  <div class="ln" style="margin-top:12px"><span class="rd">${ico('phone')}</span>${E(c.phone)||'–'}</div>${c.email?`<div class="ln">${ico('mail')}${E(c.email)}</div>`:''}${c.addr?`<div class="ln"><span class="rd">${ico('pin')}</span>${E(c.addr)}</div>`:''}${c.idNo?`<div class="ln">${ico('id')}${E(c.idType)} ${E(c.idNo)}</div>`:''}
  <div class="c3"><div><b class="or">${act.length}</b><span>Active</span></div><div><b class="gr">${rs(act.reduce((a,l)=>a+calc(l).principal,0))}</b><span>Lent</span></div><div><b>${ls.length}</b><span>Total</span></div></div></button>`}).join('')
  :`<div class="empty" style="grid-column:1/-1">${db.customers.length?'No customers match.':'No customers yet. Add your first customer.'}</div>`}
function addCust(o){db.seq.cust++;const c={id:uid(),no:db.seq.cust,since:today(),rel:'',email:'',addr:'',idType:'Aadhaar',idNo:'',...o};db.customers.push(c);save();return c.id}
function custModal(id){const c=id?C(id):{};
 modal(id?'Edit Customer':'Add Customer',`<div class="fg"><div><label>Full Name *</label><input id="cu-n" value="${E(c.name||'')}"></div><div><label>S/o, W/o, D/o</label><input id="cu-r" value="${E(c.rel||'')}"></div>
  <div><label>Phone (WhatsApp) *</label><input id="cu-p" type="tel" inputmode="tel" value="${E(c.phone||'')}"></div><div><label>Email</label><input id="cu-e" type="email" value="${E(c.email||'')}"></div>
  <div class="full"><label>Address</label><input id="cu-a" value="${E(c.addr||'')}"></div>
  <div><label>ID Proof</label><select id="cu-it">${['Aadhaar','Voter ID','PAN','Driving licence','Ration card','Other'].map(x=>`<option ${x===(c.idType||'Aadhaar')?'selected':''}>${x}</option>`).join('')}</select></div><div><label>ID Number</label><input id="cu-in" value="${E(c.idNo||'')}"></div>
  <div><label>Customer Since</label><input id="cu-s" type="date" value="${c.since||today()}"></div></div>`,
 `${id?`<button class="btn x" style="margin-right:auto" onclick="delCust('${id}')">Delete</button>`:''}<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveCust('${id||''}')">Save Customer</button>`)}
function saveCust(id){const o={name:val('cu-n').trim(),rel:val('cu-r').trim(),phone:val('cu-p').trim(),email:val('cu-e').trim(),addr:val('cu-a').trim(),idType:val('cu-it'),idNo:val('cu-in').trim(),since:val('cu-s')||today()};
 if(!o.name||!o.phone)return toast('Enter the name and phone');if(id)Object.assign(C(id),o);else addCust(o);save();closeModal();toast('Customer saved');render()}
function delCust(id){if(db.loans.some(l=>l.custId===id))return toast('This customer has pledges. Delete those first.');if(!confirm('Delete this customer?'))return;db.customers=db.customers.filter(c=>c.id!==id);save();closeModal();render()}
function custView(id){const c=C(id),ls=db.loans.filter(l=>l.custId===id).sort((a,b)=>b.date.localeCompare(a.date));
 modal(E(c.name),`<div class="kv" style="margin-bottom:16px"><span>Phone</span><b>${E(c.phone)}</b><span>Address</span><b>${E(c.addr)||'–'}</b><span>ID</span><b>${c.idNo?E(c.idType)+' '+E(c.idNo):'–'}</b></div>
  ${ls.length?ls.map(l=>`<button class="att" style="background:var(--card2);border-color:var(--bd)" onclick="closeModal();go('pledge','${l.id}')"><div class="r1"><span class="pno">${E(l.no)}</span>${badge(l)}</div><div>${E(itemName(l))} · ${wt(lwt(l))}</div><div class="money">${rs(l.amount)} <span class="mu" style="font-weight:400">on ${fdt(l.date)}</span></div></button>`).join(''):'<p class="mu">No pledges yet.</p>'}`,
 `<button class="btn s" onclick="custModal('${id}')">${ico('edit')}Edit</button>${c.phone?`<a class="btn wa" href="${wa(c.phone,fillC('Namaste {name} garu,\n\n',c))}" target="_blank" rel="noopener">${ico('chat')}WhatsApp</a>`:''}<button class="btn" onclick="pledgeModal('${id}')">${ico('plus')}New Pledge</button>`)}

/* ---------- cash & bank ---------- */
V.bank=()=>{const E2=entries().filter(e=>!aq||e.acct===aq);
 return`<div class="ph"><div><h1 class="pg">Cash &amp; Bank</h1><div class="sub">Balance tracker &amp; transaction ledger</div></div><div class="btns"><button class="btn bl" onclick="bankModal()">+ Add Bank</button><button class="btn" onclick="txnModal()">+ New Transaction</button></div></div>
 <div class="accs">${db.accounts.map(a=>accCard(a,1)).join('')}${totCard()}</div>
 <div class="panel"><div class="panel-h"><h2>📒 Transaction Ledger</h2><select style="width:auto;min-width:180px;height:40px" onchange="aq=this.value;render()"><option value="">All Accounts</option>${db.accounts.map(a=>`<option value="${a.id}" ${aq===a.id?'selected':''}>${E(a.name)}</option>`).join('')}</select></div>
  ${E2.length?E2.slice(0,200).map(e=>`<div class="lrow"><div class="lic ${e.amt>=0?'in':'out'}">${ico(e.amt>=0?'dn':'up')}</div><div style="min-width:0"><div class="t">${E(e.t)}</div><small>${fdt(e.date)} · ${E(A(e.acct).name)}${e.s?' · '+E(e.s):''}</small></div><div class="amt ${e.amt>=0?'gr':'rd'}">${e.amt>=0?'+':'−'}${rs(Math.abs(e.amt))}</div>${e.id?`<button class="icb" style="height:36px;width:36px;flex:none" title="Delete entry" onclick="delTxn('${e.id}')">${ico('trash')}</button>`:''}</div>`).join(''):'<div class="empty">No transactions yet.</div>'}</div>`};
function bankModal(){modal('Add Bank Account',`<div class="fg"><div class="full"><label>Bank Name *</label><input id="bk-n" placeholder="e.g. State Bank of India"></div><div><label>Last 4 digits of account</label><input id="bk-a" inputmode="numeric" maxlength="4"></div><div><label>Opening Balance (₹)</label><input id="bk-o" type="number" inputmode="numeric" value="0"></div></div>`,
 `<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveBank()">Add Bank</button>`)}
function saveBank(){const n=val('bk-n').trim();if(!n)return toast('Enter the bank name');db.accounts.push({id:uid(),name:n,type:'bank',num:val('bk-a').trim(),open:+val('bk-o')||0});save();closeModal();toast('Bank added');render()}
function txnModal(){modal('New Transaction',`<div class="fg"><div><label>Type</label><select id="tx-t" onchange="$('#tx-to-w').hidden=this.value!=='tr'"><option value="in">Money In</option><option value="out">Money Out / Expense</option><option value="tr">Transfer between accounts</option></select></div>
 <div><label>Account</label><select id="tx-a">${acctOpts('cash')}</select></div><div id="tx-to-w" hidden><label>To Account</label><select id="tx-to">${acctOpts(db.accounts[1]?db.accounts[1].id:'cash')}</select></div>
 <div><label>Amount (₹)</label><input id="tx-m" type="number" inputmode="numeric"></div><div><label>Date</label><input id="tx-d" type="date" value="${today()}"></div><div class="full"><label>Description</label><input id="tx-s" placeholder="e.g. Shop rent, Cash deposited to bank"></div></div>`,
 `<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveTxn()">Save</button>`)}
function saveTxn(){const t=val('tx-t'),a=val('tx-a'),m=Math.round(+val('tx-m')||0),d=val('tx-d')||today(),s=val('tx-s').trim();if(m<=0)return toast('Enter the amount');
 if(t==='tr'){const to=val('tx-to');if(to===a)return toast('Pick two different accounts');db.txns.push({id:uid(),ts:Date.now(),date:d,acct:a,amt:-m,desc:s||'Transfer to '+A(to).name,kind:'tr'},{id:uid(),ts:Date.now()+1,date:d,acct:to,amt:m,desc:s||'Transfer from '+A(a).name,kind:'tr'})}
 else db.txns.push({id:uid(),ts:Date.now(),date:d,acct:a,amt:t==='in'?m:-m,desc:s||(t==='in'?'Money in':'Expense'),kind:t});save();closeModal();toast('Transaction saved');render()}
function adjModal(id){const a=A(id);modal('Adjust Balance — '+E(a.name),`<p class="mu" style="margin-top:0">Current balance: ${rs(bal(id))}. Enter the actual balance; the difference is recorded as an adjustment.</p><label>Actual Balance (₹)</label><input id="ad-v" type="number" inputmode="numeric" value="${bal(id)}">`,
 `${a.type==='bank'?`<button class="btn x" style="margin-right:auto" onclick="delBank('${id}')">Remove Bank</button>`:''}<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveAdj('${id}')">Save</button>`)}
function saveAdj(id){const d=(+val('ad-v')||0)-bal(id);if(d)db.txns.push({id:uid(),ts:Date.now(),date:today(),acct:id,amt:d,desc:'Balance adjusted',kind:'adj'});save();closeModal();toast('Balance updated');render()}
function delBank(id){if(entries().some(e=>e.acct===id&&!e.id))return toast('This bank is used in pledges or payments');if(!confirm('Remove this bank and its manual entries?'))return;db.accounts=db.accounts.filter(a=>a.id!==id);db.txns=db.txns.filter(t=>t.acct!==id);save();closeModal();render()}
function delTxn(id){if(!confirm('Delete this entry?'))return;db.txns=db.txns.filter(t=>t.id!==id);save();render()}

/* ---------- messages ---------- */
V.messages=()=>{const R=db.loans.filter(needsRem).sort((a,b)=>sinceInt(b)-sinceInt(a));
 return`<div class="ph"><div><h1 class="pg">Messages &amp; Reminders</h1><div class="sub">Send interest reminders and offers straight to customers on WhatsApp</div></div>
  <div class="btns"><button class="btn ${msgTab==='rem'?'':'s'}" onclick="msgTab='rem';render()">${ico('bell')}Reminders (${R.length})</button><button class="btn ${msgTab==='offer'?'':'s'}" onclick="msgTab='offer';render()">${ico('chat')}Offers &amp; Deals</button></div></div>
 ${msgTab==='rem'?`<div class="panel"><div class="panel-h"><h2 class="rd" style="color:var(--rd)">🔔 Auto Reminders (${R.length})</h2><span class="mu" style="font-size:14px">Pledges with interest due ≥ ${db.settings.remind} days or past due date</span></div><div class="panel-b">
  ${R.length?R.map(l=>{const c=calc(l),cu=C(l.custId);return`<div class="msg"><div class="r1"><div><span class="pno" style="font-size:18px">${E(l.no)}</span> <span style="font-size:17px;margin-left:6px">${E(cu.name)}</span> <span class="mu" style="margin-left:6px">📞 ${E(cu.phone)}</span></div><b class="int">${sinceInt(l)} days&nbsp; <span class="rd">${rs(c.due)} due</span></b></div>
   <textarea id="m-${l.id}">${E(fill(db.settings.tplRem,l))}</textarea>
   <div class="btns" style="margin-top:12px"><button class="btn sm" onclick="copyMsg('m-${l.id}')">${ico('copy')}Copy &amp; Send</button>${cu.phone?`<button class="btn wa sm" onclick="sendWa('${tel(cu.phone)}','m-${l.id}')">${ico('chat')}WhatsApp</button>`:''}</div></div>`}).join(''):'<div class="empty">No reminders due. Every pledge is up to date.</div>'}</div></div>`
 :`<div class="panel"><div class="panel-h"><h2>📣 Send an Offer or Message</h2><span class="mu" style="font-size:14px">{name} becomes each customer’s name</span></div><div class="panel-b">
  <textarea id="m-offer" oninput="db.settings.tplOffer=this.value;save()">${E(db.settings.tplOffer)}</textarea>
  <div class="btns" style="margin:14px 0"><button class="btn s sm" onclick="db.customers.forEach(c=>offerSel[c.id]=true);render()">Select all</button><button class="btn s sm" onclick="offerSel={};render()">Clear</button><button class="btn sm" onclick="copyMsg('m-offer')">${ico('copy')}Copy message</button></div>
  ${db.customers.length?`<div class="tw"><table><thead><tr><th style="width:40px"></th><th>Customer</th><th>Phone</th><th>Active pledges</th><th>Send</th></tr></thead><tbody>${db.customers.map(c=>`<tr><td><input type="checkbox" style="width:18px;height:18px" ${offerSel[c.id]?'checked':''} onchange="offerSel['${c.id}']=this.checked"></td><td class="b">${E(c.name)}</td><td>${E(c.phone)}</td><td>${db.loans.filter(l=>l.custId===c.id&&l.status==='active').length}</td><td>${c.phone?`<button class="btn wa sm" onclick="sendOffer('${c.id}')">${ico('chat')}WhatsApp</button>`:''}</td></tr>`).join('')}</tbody></table></div>
  <button class="btn wa" style="margin-top:14px" onclick="sendSelected()">${ico('chat')}Send to selected one by one</button><div class="hint">WhatsApp opens a chat for each customer with the message ready — tap send in WhatsApp, then come back for the next.</div>`:'<p class="mu">Add customers first.</p>'}</div></div>`}`};
function copyMsg(id){const t=$('#'+id);t.select();const ok=()=>toast('Message copied');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t.value).then(ok,()=>{document.execCommand('copy');ok()});else{document.execCommand('copy');ok()}}
function sendWa(ph,id){openExt('https://wa.me/91'+ph+'?text='+encodeURIComponent($('#'+id).value))}
function sendOffer(cid){const c=C(cid);openExt(wa(c.phone,fillC(val('m-offer'),c)))}
let queue=[];function sendSelected(){queue=db.customers.filter(c=>offerSel[c.id]&&c.phone);if(!queue.length)return toast('Select at least one customer');nextQ()}
function nextQ(){const c=queue.shift();if(!c){toast('All selected customers done');closeModal();return}sendOffer(c.id);
 modal('Sending offers',`<p>Opened WhatsApp for <b>${E(c.name)}</b>. Send it there, then come back.</p><p class="mu">${queue.length} left.</p>`,`<button class="btn s" onclick="queue=[];closeModal()">Stop</button>${queue.length?`<button class="btn wa" onclick="nextQ()">Next: ${E(queue[0].name)}</button>`:`<button class="btn" onclick="closeModal()">Done</button>`}`)}

/* ---------- repledges ---------- */
V.repledges=()=>{const R=db.loans.filter(l=>l.rp&&l.status==='active'),open=R.filter(l=>!l.rp.closed);
 return`<div class="ph"><div><h1 class="pg">Repledges</h1><div class="sub">Articles repledged to banks / finance firms</div></div><div class="btns"><span class="pill">${open.length} Articles Repledged</span><button class="btn" onclick="rpModal()">${ico('plus')}Repledge Article</button></div></div>
 ${R.length?R.map(l=>{const cu=C(l.custId);return`<div class="rcard"><div class="rh"><div><span class="pno" style="font-size:19px">${E(l.no)}</span> <span class="bdg ${l.rp.closed?'redeemed':'repledged'}" style="margin-left:8px">${l.rp.closed?'Back in locker':'Repledged'}</span></div>
  <div class="btns">${l.rp.closed?'':`<button class="btn s sm" onclick="rpCloseModal('${l.id}')">${ico('unlock')}Repaid to firm</button>`}<button class="btn bl sm" onclick="rpModal('${l.id}',1)">Edit</button><button class="btn x sm" onclick="rpRemove('${l.id}')">Remove</button></div></div>
  <div class="rb"><div><div class="cap">Customer</div><b style="font-size:17px">${E(cu.name)}</b><div class="mu">📞 ${E(cu.phone)}</div></div><div><div class="cap">Article</div><div style="font-size:16px">${E(itemName(l))}</div><div class="mu">${wt(lwt(l))} — ${l.items.map(i=>purLabel(i.metal,i.purity)).join(', ')}</div></div>
  <div><div class="cap">Our Loan</div><b class="money" style="font-size:20px">${rs(l.amount)}</b><div class="mu">@ ${l.roi}%/mo</div></div>${rpBox(l)}</div></div>`}).join(''):'<div class="panel"><div class="empty">No articles repledged. Use “Repledge Article” when you pledge a customer’s article with a bank or finance firm.</div></div>'}`};
function rpModal(id,edit){const l=id&&L(id);const pick=!id?`<div style="margin-bottom:16px"><label>Pledge *</label><select id="rp-l"><option value="">— Select active pledge —</option>${db.loans.filter(x=>x.status==='active'&&!x.rp).map(x=>`<option value="${x.id}">${E(x.no)} — ${E(C(x.custId).name)} — ${E(itemName(x))}</option>`).join('')}</select></div>`:'';
 modal((edit?'Edit Repledge — ':'Repledge to Finance Firm')+(l?E(l.no):''),pick+rpFields(edit?l.rp:{}),`<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveRp('${id||''}',${!!edit})">Save</button>`)}
function saveRp(id,edit){id=id||val('rp-l');const l=L(id);if(!l)return toast('Select a pledge');const r=rpRead();if(!r)return toast('Enter the firm name and amount');
 if(edit){r.closed=l.rp.closed;r.ts=l.rp.ts}else db.seq.rp++;l.rp=r;save();closeModal();toast('Repledge saved');render()}
function rpCloseModal(id){const l=L(id);modal('Repaid to '+E(l.rp.firm),`<p class="mu" style="margin-top:0">Record the amount paid to the firm to get the article back.</p><div class="fg"><div><label>Amount Paid (₹)</label><input id="rc-a" type="number" inputmode="numeric" value="${l.rp.amount}"></div><div><label>Paid From</label><select id="rc-ac">${acctOpts(l.rp.acct)}</select></div><div><label>Date</label><input id="rc-d" type="date" value="${today()}"></div></div>`,
 `<button class="btn s" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveRpClose('${id}')">Save</button>`)}
function saveRpClose(id){const l=L(id),a=Math.round(+val('rc-a')||0);if(a<=0)return toast('Enter the amount');l.rp.closed={amount:a,acct:val('rc-ac'),date:val('rc-d')||today(),ts:Date.now()};save();closeModal();toast('Article back in locker');render()}
function rpRemove(id){if(!confirm('Remove this repledge record? Its money entries will also be removed.'))return;L(id).rp=null;save();render()}

/* ---------- daily report ---------- */
V.daily=()=>{const d=dsel||today(),R=entries().filter(e=>e.date===d).reverse(),tin=R.filter(e=>e.amt>0).reduce((a,e)=>a+e.amt,0),tout=R.filter(e=>e.amt<0).reduce((a,e)=>a-e.amt,0);
 let intr=0,np=0;db.loans.forEach(l=>{if(l.date===d)np++;l.payments.forEach(p=>{if(p.date===d)intr+=Math.max(0,p.interest-(p.discount||0))})});
 return`<div class="ph"><h1 class="pg">Daily Report</h1><div class="btns np"><button class="btn s sm" onclick="dsel=addDays('${d}',-1);render()">‹ Prev</button><input type="date" value="${d}" style="width:auto;height:36px" onchange="dsel=this.value;render()"><button class="btn s sm" onclick="dsel=addDays('${d}',1);render()">Next ›</button>${NATIVE()?'':`<button class="btn sm" onclick="window.print()">${ico('print')}Print</button>`}</div></div>
 <div class="sub" style="margin:-12px 0 18px">${fdt(d)}</div>
 <div class="stats">${stat('Money In',rs(tin),'dn','gr')}${stat('Money Out',rs(tout),'up','rd')}${stat('Net',(tin-tout<0?'−':'')+rs(Math.abs(tin-tout)),'cash','or')}${stat('Interest Earned',rs(intr),'cash','gr')}${stat('New Pledges',np,'doc','vi')}</div>
 <div class="panel"><div class="panel-h"><h2>Entries</h2></div>${R.length?R.map(e=>`<div class="lrow"><div class="lic ${e.amt>=0?'in':'out'}">${ico(e.amt>=0?'dn':'up')}</div><div><div class="t">${E(e.t)}</div><small>${E(A(e.acct).name)}${e.s?' · '+E(e.s):''}</small></div><div class="amt ${e.amt>=0?'gr':'rd'}">${e.amt>=0?'+':'−'}${rs(Math.abs(e.amt))}</div></div>`).join(''):'<div class="empty">No entries on this day.</div>'}</div>`};

/* ---------- printed estimates ---------- */
function billDoc(k,l,p){const s=db.settings,cu=C(l.custId),head=`<div style="text-align:center;margin-bottom:8px"><div style="font-size:21px;font-weight:700;text-transform:uppercase">${E(s.biz)}</div><div style="font-size:13px">${E(s.addr)}${s.phone?' · Ph '+E(s.phone):''}${s.lic?' · Lic '+E(s.lic):''}</div></div>`;
 const cust=`<div class="bname">${E(cu.name)}</div><div class="bkv"><span>${E(cu.rel)||'&nbsp;'}</span><span>Ph: ${E(cu.phone)||'–'}</span><span>${E(cu.addr)||'&nbsp;'}</span><span>${cu.idNo?E(cu.idType)+': '+E(cu.idNo):'&nbsp;'}</span></div>`;
 const sig=`<div class="sig"><span>Customer signature</span><span>For ${E(s.biz)}</span></div><div style="text-align:center;font-size:11px;margin-top:10px">Rough estimate only – not a GST / tax invoice</div>`;
 if(k==='loan')return`<div class="billdoc">${head}<div class="btt">Pledge Estimate<span>${E(l.no)} · ${fdn(l.date).replace(/-/g,'.')}</span></div><div class="bbox">${cust}
  <table class="bill"><tr><th>Details</th><th>Metal</th><th>Purity</th><th>Weight g</th><th>Value ₹</th></tr>${l.items.map(i=>`<tr><td>${E(i.desc)}</td><td>${i.metal==='gold'?'Gold':'Silver'}</td><td>${purLabel(i.metal,i.purity)}</td><td>${f(i.net,3)}</td><td>${f(i.value)}</td></tr>`).join('')}
  <tr class="nt"><td>Total</td><td></td><td></td><td>${f(lwt(l),3)}</td><td>${f(l.value)}</td></tr></table>
  <div style="font-size:13px;padding:6px 2px">Rupees ${words(l.amount)} only${l.notes?' · '+E(l.notes):''}</div><div style="font-size:11.5px;white-space:pre-line;padding:4px 2px;border-top:1px dashed #999">${E(s.terms)}</div></div>
  <div class="bfoot"><span>Interest ${l.roi}% p.m.</span><span>Due: ${fdn(l.due)}</span><div class="mdue"><span>Loan Amount</span><b>₹ ${f(l.amount)}</b></div></div>${sig}</div>`;
 const a=calc(l,p.date);return`<div class="billdoc">${head}<div class="btt">${p.release?'Redemption Estimate':'Payment Estimate'}<span>${E(p.rno)} · ${fdn(p.date).replace(/-/g,'.')}</span></div><div class="bbox">${cust}
  <table class="bill"><tr><th>Details</th><th>Amount ₹</th></tr><tr><td>Pledge ${E(l.no)} dated ${fdn(l.date)} – ${rs(l.amount)} at ${l.roi}% p.m.</td><td></td></tr><tr><td>Interest</td><td>${f(p.interest)}</td></tr><tr><td>Principal</td><td>${f(p.principal)}</td></tr>${p.discount?`<tr><td>Less discount</td><td>−${f(p.discount)}</td></tr>`:''}<tr class="nt"><td>Received (${E(A(p.acct).name)})</td><td>${f(p.amount)}</td></tr></table>
  <div style="font-size:13px;padding:6px 2px">Rupees ${words(p.amount)} only${p.note?' · '+E(p.note):''}</div><div style="font-size:13px;padding:4px 2px">${p.release?'Pledge closed. All articles returned to the customer.':'Articles: '+l.items.map(i=>E(i.desc)).join(', ')}</div></div>
  <div class="bfoot"><span>${p.release?'Pledge closed':'Due: '+fdn(l.due)}</span><span>Net Balance</span><div class="mdue"><span>Principal Due</span><b>₹ ${f(p.release?0:a.principal)}</b></div></div>${sig}</div>`}
V.doc=()=>{const l=L(arg.id),p=arg.p?l.payments.find(x=>x.id===arg.p):null,cu=C(l.custId);
 const txt=arg.k==='loan'?`${db.settings.biz}\nPledge Estimate ${l.no} (${fdt(l.date)})\n${cu.name}\nArticles: ${l.items.map(i=>i.desc+' '+wt(i.net)).join(', ')}\nLoan: ${rs(l.amount)} @ ${l.roi}% p.m.\nDue: ${fdt(l.due)}\n\nThank you!`:`${db.settings.biz}\n${p.release?'Redemption':'Payment'} ${p.rno} (${fdt(p.date)})\nPledge ${l.no} – ${cu.name}\nReceived: ${rs(p.amount)} (Interest ${rs(p.interest)}, Principal ${rs(p.principal)})\n${p.release?'Pledge closed. Articles returned.':'Balance principal: '+rs(calc(l,p.date).principal)}\n\nThank you!`;
 shareBuf=txt;return`<div class="btns np" style="margin-bottom:16px">${NATIVE()?`<button class="btn" onclick="shareText(shareBuf)">${ico('copy')}Share</button>`:`<button class="btn" onclick="window.print()">${ico('print')}Print</button>`}${cu.phone?`<a class="btn wa" href="${wa(cu.phone,txt)}" target="_blank" rel="noopener">${ico('chat')}Send on WhatsApp</a>`:''}<button class="btn s" onclick="go('pledge','${l.id}')">${ico('back')}Back to pledge</button><button class="btn s" onclick="pledgeModal()">${ico('plus')}New Pledge</button></div>
 <div class="paper"><div class="tw">${billDoc(arg.k,l,p)}</div></div>`};

/* ---------- settings ---------- */
V.settings=()=>{const s=db.settings,F=(k,l,t='text',x='')=>`<div><label>${l}</label><input id="s-${k}" type="${t}" value="${E(s[k])}" ${x}></div>`;
 return`<div class="ph"><h1 class="pg">Settings</h1></div>
 <div class="panel"><div class="panel-h"><h2>Shop details</h2></div><div class="panel-b"><div class="fg">${F('biz','Shop name')}${F('tag','Tagline')}${F('addr','Address')}${F('phone','Phone')}${F('lic','Licence number')}${F('prefix','Pledge no. prefix')}${F('rprefix','Receipt no. prefix')}${F('rpprefix','Repledge serial prefix')}</div></div></div>
 <div class="panel"><div class="panel-h"><h2>Loan defaults</h2></div><div class="panel-b"><div class="fg">${F('roi','Interest % per month','number','step="0.05"')}${F('tenure','Due period (months)','number')}${F('minDays','Minimum interest days','number')}${F('remind','Reminder after (days)','number')}${F('goldRate','Gold rate ₹/g (24K)','number')}${F('silverRate','Silver rate ₹/g (999)','number')}${F('ltv','Loan to value %','number')}</div>
  <div style="margin-top:16px"><label>Terms printed on the pledge estimate</label><textarea id="s-terms">${E(s.terms)}</textarea></div>
  <div style="margin-top:16px"><label>Reminder message — {name} {no} {item} {amount} {days} {interest} {total} {due} {shop}</label><textarea id="s-tplRem" style="min-height:220px">${E(s.tplRem)}</textarea></div>
  <button class="btn" style="margin-top:16px" onclick="saveSet()">Save Settings</button></div></div>
 ${SECURE()?`<div class="panel"><div class="panel-h"><h2>Password &amp; licence</h2></div><div class="panel-b"><div class="kv"><span>Machine ID</span><b>${E(Store.machine)}</b><span>Licence</span><b class="gr">Activated</b></div><p class="mu">The password is changed by the owner only: click Lock, then Owner / Admin on the login screen and paste today’s admin code. Uninstall is done from the same place.</p></div></div>`
 :`<div class="panel"><div class="panel-h"><h2>Password</h2></div><div class="panel-b"><div class="fg"><div><label>New password</label><input id="s-p1" type="password"></div><div><label>Type it again</label><input id="s-p2" type="password"></div></div><button class="btn s" style="margin-top:14px" onclick="savePin()">${ico('lock')}Change Password</button></div></div>`}
 <div class="panel"><div class="panel-h"><h2>Data</h2></div><div class="panel-b"><p class="mu" style="margin-top:0">${SECURE()?'Everything is saved on this '+devWord()+', encrypted with your password. A safety copy is kept every day.':'Everything is saved in this browser only.'}</p><div class="btns"><button class="btn" onclick="doBackup()">${ico('save')}Backup</button><label class="btn s" style="margin:0">${ico('dn')}Restore<input type="file" accept=".enc,.json" hidden onchange="doRestore(this)"></label><button class="btn s" onclick="seed()">Load demo data</button><button class="btn x" onclick="wipe()">Erase all data</button></div></div></div>`};
function saveSet(){const s=db.settings;['biz','tag','addr','phone','lic','prefix','rprefix','rpprefix','terms','tplRem'].forEach(k=>s[k]=val('s-'+k));['biz','tag','prefix','rprefix','rpprefix'].forEach(k=>{s[k]=s[k].trim()||DEF[k]});
 ['roi','tenure','minDays','remind','goldRate','silverRate','ltv'].forEach(k=>s[k]=+val('s-'+k)||DEF[k]);save();toast('Settings saved');render()}
function savePin(){const a=val('s-p1'),b=val('s-p2');if(a.length<4)return toast('Use at least 4 characters');if(a!==b)return toast('The two passwords don’t match');db.settings.pin=a;save();toast('Password changed');render()}
function wipe(){if(!confirm('Erase all customers, pledges, payments and transactions? Shop settings are kept.'))return;const s=db.settings;db=blank();db.settings=s;save();toast('All data erased');go('dash')}

/* ---------- demo data ---------- */
function seed(){
  if(db.loans.length&&!confirm('Add demo data to your existing records?'))return;
  const t=today(),s=db.settings;
  if(!db.accounts.some(a=>a.type==='bank'))db.accounts.push({id:'sbi',name:'State Bank of India',type:'bank',num:'4521',open:480000},{id:'hdfc',name:'HDFC Bank',type:'bank',num:'9832',open:210000});
  db.accounts[0].open=(+db.accounts[0].open||0)+400000;
  const cs=[['Ramesh Naidu','S/o Krishna Naidu','9876543210','ramesh@example.com','12, Gandhi Nagar',-1200],['Sunitha Devi','W/o Srinivas','9823456781','sunitha@example.com','45, Bus Stand Road',-980],['Vijay Kumar','S/o Prasad','9712345678','vijay@example.com','8, MG Road',-900],['Fathima Begum','W/o Abdul Rahim','9848012303','','Ward 12',-400],['Padmavathi','D/o Ramaiah','9848012306','','Teachers Colony',-60]]
   .map(([name,rel,phone,email,addr,o],i)=>addCust({name,rel,phone,email,addr,idType:'Aadhaar',idNo:'XXXX-XXXX-'+(4100+i*137),since:addDays(t,o)}));
  const mk=(ci,off,items,amt,roi,pays,ex={})=>{db.seq.loan++;const d=addDays(t,off);
   const its=items.map(([desc,metal,net,pur])=>({desc,metal,net,gross:net,pcs:1,purity:pur,value:Math.round(net*pur/100*(metal==='gold'?s.goldRate:s.silverRate))}));
   const l={id:uid(),no:s.prefix+'-'+d.slice(0,4)+'-'+pad(db.seq.loan,3),custId:cs[ci],date:d,due:addMonths(d,12),ts:Date.now()+db.seq.loan,items:its,amount:amt,roi,acct:ex.acct||'cash',notes:'',goldRate:s.goldRate,silverRate:s.silverRate,value:its.reduce((a,i)=>a+i.value,0),status:'active',payments:[],rp:null};
   db.loans.push(l);
   pays.forEach(([po,a,rl])=>{const pd=addDays(t,po),c=calc(l,pd);let interest,principal,discount=0;if(rl){interest=c.due;principal=c.principal;discount=Math.max(0,c.total-a)}else{interest=Math.min(a,c.due);principal=Math.min(a-interest,c.principal)}
    db.seq.rcpt++;l.payments.push({id:uid(),rno:s.rprefix+'-'+pad(db.seq.rcpt,4),date:pd,ts:Date.now()+db.seq.rcpt,amount:a,interest,principal,discount,acct:'cash',note:'',release:!!rl});if(rl){l.status='released';l.closedOn=pd}});
   if(ex.rp){db.seq.rp++;l.rp={firm:ex.rp[0],serial:s.rpprefix+'-'+pad(db.seq.rp,3),amount:ex.rp[1],date:addDays(t,ex.rp[2]),roi:1,acct:'sbi',ts:Date.now()}}return l};
  mk(0,-420,[['Gold Necklace','gold',25.5,91.6]],85000,1.5,[[-300,3825]]);
  mk(1,-380,[['Silver Bangles (4 pcs)','silver',120,92.5]],6500,1.5,[[-200,975]],{rp:['Punjab National Bank',5000,-370]});
  mk(2,-400,[['Gold Coin 10g','gold',10,99.9]],58000,1.75,[[-30,70000,true]]);
  mk(0,-200,[['Gold Earrings Pair','gold',8.2,91.6]],22000,1.5,[],{acct:'hdfc'});
  mk(3,-110,[['Gold Chain','gold',18,91.6],['Silver Anklets (pair)','silver',210,80]],140000,1.5,[]);
  mk(4,-12,[['Gold Mangalsutra','gold',12,91.6]],78000,1.5,[]);
  mk(4,0,[['Gold Ring','gold',5.5,91.6]],36000,1.5,[]);
  db.txns.push({id:uid(),ts:Date.now(),date:t,acct:'cash',amt:-350,desc:'Tea and stationery',kind:'out'});
  save();toast('Demo data loaded');go('dash');
}

/* ---------- start ---------- */
if(NATIVE()&&CP('App'))CP('App').addListener('backButton',()=>{if($('#modal').classList.contains('open'))return closeModal();if(document.body.classList.contains('menu')){document.body.classList.remove('menu');return}
  if(document.body.classList.contains('gated')||view==='dash')return CP('App').exitApp();go(view==='doc'&&arg?'pledge':'dash',view==='doc'&&arg?arg.id:undefined)});
Store.init().then(()=>{if(SECURE()){showGate();return}db=load();let o=false;try{o=sessionStorage.getItem(KEY+'-o')==='1'}catch(_){}if(o)go('dash');else showGate()}).catch(e=>{$('#app').innerHTML='<div class="gate"><div class="gcard"><h1>Pawn Ledger could not start</h1><p class="mu">'+E(e&&e.message||e)+'</p></div></div>'});
