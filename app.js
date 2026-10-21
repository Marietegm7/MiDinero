'use strict';
const KEY='midinero_finanzas_v2';
const DEFAULT={income:1409,opening:0,payFrom:28,payTo:30,housing:400,fuel:150,insurance:64,installment:98,essentials:100,leisure:150,motoMonthly:275,emergencyMonthly:110,motoGoal:3000,emergencyGoal:1000,motoDate:'2027-09-11'};
const EXPENSE_CATS={housing:'Vivienda',fuel:'Gasolina',insurance:'Seguro del coche',installment:'Cuota pendiente',essentials:'Gastos personales',leisure:'Ocio y caprichos'};
const INCOME_CATS={salary:'Nómina',other:'Otro ingreso'};
const SAVE_CATS={moto:'Moto',emergency:'Colchón'};
const $=id=>document.getElementById(id);
const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(n)||0);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const currentMonth=()=>localDate().slice(0,7);
const money=n=>Math.round((Number(n)||0)*100)/100;
let db=load();let page='inicio';let viewMonth=currentMonth();
function load(){try{let x=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('brujula_finanzas_v1'));if(x&&typeof x==='object'&&x.settings&&Array.isArray(x.txs)){const settings={...DEFAULT,...x.settings};const txs=x.txs.filter(t=>t&&['income','expense','saving','withdrawal'].includes(t.type)&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isFinite(Number(t.amount))&&Number(t.amount)>0).map(t=>({...t,amount:money(t.amount)}));return {settings,txs}}}catch(e){}return {settings:{...DEFAULT},txs:[]}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch(e){toast('No se pudieron guardar los datos. Comprueba que el almacenamiento local esté permitido.');return false}}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4200)}
const monthOf=t=>t.date.slice(0,7);
const inMonth=(t,m=viewMonth)=>monthOf(t)===m;
const sum=arr=>money(arr.reduce((acc,t)=>acc+(Number(t.amount)||0),0));
const txMonth=(type,m=viewMonth)=>db.txs.filter(t=>inMonth(t,m)&&(!type||t.type===type));

const savedFor=kind=>money(sum(db.txs.filter(t=>t.type==='saving'&&t.category===kind))-(kind==='emergency'?sum(db.txs.filter(t=>t.type==='withdrawal'&&t.category==='emergency')):0));
const withdrawals=()=>db.txs.filter(t=>t.type==='withdrawal'&&t.category==='emergency');
function emergencyLedgerHealthy(txs){
 const byDate=new Map();
 for(const t of txs){
  if(t.category!=='emergency'||(t.type!=='saving'&&t.type!=='withdrawal'))continue;
  const value=Number(t.amount)*(t.type==='saving'?1:-1);
  byDate.set(t.date,(byDate.get(t.date)||0)+value);
 }
 let balance=0;
 for(const date of [...byDate.keys()].sort()){
  balance=money(balance+byDate.get(date));
  if(balance < -0.001)return false;
 }
 return true;
}
const categoryBudget=(category,m=viewMonth)=>{const s=db.settings;if(category==='installment'&&m>'2027-04')return 0;return Number(s[category])||0};
function budgets(m=viewMonth){return Object.fromEntries(Object.keys(EXPENSE_CATS).map(k=>[k,categoryBudget(k,m)]))}
const fixedExpenses=(m=viewMonth)=>sum(Object.entries(budgets(m)).map(([category,amount])=>({amount})));
const planMargin=(m=viewMonth)=>money(db.settings.income-fixedExpenses(m)-db.settings.motoMonthly-db.settings.emergencyMonthly);
const monthTotal=type=>sum(txMonth(type));
const cashBalance=()=>money(db.settings.opening+sum(db.txs.filter(t=>t.type==='income'))+sum(db.txs.filter(t=>t.type==='withdrawal'))-sum(db.txs.filter(t=>t.type==='expense'))-sum(db.txs.filter(t=>t.type==='saving')));
const percentage=(a,b)=>b>0?Math.min(100,Math.max(0,a/b*100)):0;
function todayDay(){return localDate()}
function readableDate(str){return new Date(str+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
function monthlyIncomeExists(m=viewMonth){return db.txs.some(t=>t.type==='income'&&t.category==='salary'&&inMonth(t,m))}
function setPage(p){if(!['inicio','movimientos','objetivos','ajustes'].includes(p))return;page=p;document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id===p));document.querySelectorAll('[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===p));$('page-title').textContent=({inicio:'Tu dinero, bajo control',movimientos:'Tus movimientos',objetivos:'Tus metas, paso a paso',ajustes:'Configura tu plan'})[p];window.scrollTo({top:0,behavior:'smooth'});render()}
function render(){const s=db.settings;const income=monthTotal('income'),expenses=monthTotal('expense'),saved=monthTotal('saving');$('cash-val').textContent=euro(cashBalance());$('income-val').textContent=euro(income);$('income-exp').textContent=euro(s.income);$('spent-val').textContent=euro(expenses);$('saved-val').textContent=euro(saved);$('current-month-label').textContent=new Date(viewMonth+'-15T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
const expected=monthlyIncomeExists(viewMonth)?'Nómina registrada este mes.':`Cobras entre el ${s.payFrom} y el ${s.payTo}: registra la nómina al recibirla.`;const current=viewMonth===currentMonth();$('pay-note').textContent=(current?expected:'Estás consultando otro mes. ')+' Tu presupuesto es una guía; el saldo solo refleja movimientos registrados.';
renderGoals();renderBudget();renderBreakdown();renderUpcoming();renderTransactions();renderProjection();renderDaily();}
function renderGoals(){
 const s=db.settings, moto=savedFor('moto'), em=savedFor('emergency');
 $('goals-dashboard').innerHTML=goalCard('🏍️','Moto',moto,s.motoGoal,'cyan')+goalCard('🛟','Colchón de emergencia',em,s.emergencyGoal,'');
 $('moto-detail').innerHTML=goalDetail(moto,s.motoGoal,'cyan',s.motoMonthly,'Aportación mensual prevista')+'<p class="small-note">Fecha objetivo: '+readableDate(s.motoDate)+'</p>';
 $('emergency-detail').innerHTML=goalDetail(em,s.emergencyGoal,'',s.emergencyMonthly,'Aportación mensual prevista')+'<p class="small-note">Cuando alcances este primer tramo, podrás subir el objetivo a unos 3 meses de gastos esenciales.</p>';
 $('emergency-available').textContent=euro(em);
 $('emergency-withdraw').max=String(Math.max(0,em));
 const list=[...withdrawals()].sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
 $('withdrawal-count').textContent=list.length+' registrada'+(list.length===1?'':'s');
 $('withdrawal-history').innerHTML=list.length?`<div class="withdrawal-list">${list.map(t=>`<div class="withdrawal-row"><div><strong>${escapeHtml(t.note||'Retirada del colchón')}</strong><small>${readableDate(t.date)}</small></div><div class="withdrawal-amount">−${euro(t.amount)}</div><button type="button" class="button secondary small" data-delete="${escapeHtml(t.id)}" aria-label="Eliminar retirada de ${euro(t.amount)} del ${readableDate(t.date)}">Deshacer</button></div>`).join('')}</div>`:'<p class="small-note">Todavía no has retirado nada de tu colchón.</p>';
}
function goalCard(emoji,title,amount,goal,theme){return `<div class="goal"><div class="goal-top"><div class="goal-title">${emoji} ${title}</div><div class="goal-count">${Math.round(percentage(amount,goal))}%</div></div><div class="goal-amount">${euro(amount)} <small>de ${euro(goal)}</small></div><div class="progress"><div class="fill ${theme}" style="width:${percentage(amount,goal)}%"></div></div><div class="goal-row"><span>Faltan ${euro(Math.max(0,goal-amount))}</span><span>${Math.round(percentage(amount,goal))}% conseguido</span></div></div>`}
function goalDetail(amount,goal,theme,monthly,caption){return `<div class="goal-amount">${euro(amount)} <small>/ ${euro(goal)}</small></div><div class="progress"><div class="fill ${theme}" style="width:${percentage(amount,goal)}%"></div></div><div class="goal-row"><span>Te faltan ${euro(Math.max(0,goal-amount))}</span><span>${Math.round(percentage(amount,goal))}%</span></div><div style="margin-top:20px" class="metric-label">${caption}</div><div style="font-size:26px;font-weight:800;margin-top:5px">${euro(monthly)}</div>`}
function renderBudget(){const budgetsByCat=budgets();$('budget-list').innerHTML=Object.entries(EXPENSE_CATS).map(([key,label])=>{const limit=budgetsByCat[key];const spent=sum(txMonth('expense').filter(t=>t.category===key));const pct=limit>0?Math.min(100,spent/limit*100):(spent>0?100:0);return `<div class="budget-item"><div class="budget-row"><span>${label}</span><span><strong>${euro(spent)}</strong> / ${euro(limit)}</span></div><div class="budget-track"><div class="budget-fill ${spent>limit?'over':''}" style="width:${pct}%"></div></div></div>`}).join('')}
function renderBreakdown(){const s=db.settings;const expenses=fixedExpenses();const moto=s.motoMonthly;const col=s.emergencyMonthly;const margin=planMargin();const items=[['Gastos planificados',expenses,'#65d7cd'],['Moto',moto,'#a6d6fa'],['Colchón',col,'#b5f27b'],['Margen libre',Math.max(0,margin),'#eacb92']];const total=items.reduce((a,x)=>a+x[1],0)||1;$('month-breakdown').innerHTML=`<div class="breakdown">${items.map(i=>`<div style="background:${i[2]};width:${(i[1]/total)*100}%"></div>`).join('')}</div><div class="legend">${items.map(i=>`<div class="legendrow"><span class="dot" style="background:${i[2]}"></span>${i[0]}<b>${euro(i[1])}</b></div>`).join('')}</div>`;$('plan-warning').textContent=margin<0?'⚠️ Tu plan supera tus ingresos en '+euro(-margin)+'. Ajusta las cantidades en Configuración.':'Quedan '+euro(margin)+' sin asignar, como margen para imprevistos. Los gastos personales y de ocio son límites que puedes revisar.'}
function renderUpcoming(){const s=db.settings;const m=viewMonth;const rows=[['Cobro de nómina',`Días ${s.payFrom}–${s.payTo}`,monthlyIncomeExists(m)?'✓ Registrada':'Pendiente'],['Separar para la moto',euro(s.motoMonthly),'Recomendado'],['Separar para el colchón',euro(s.emergencyMonthly),'Recomendado'],['Gasto de ocio máximo',euro(s.leisure),'Al mes']];$('upcoming').innerHTML=rows.map(r=>`<div><span>${r[0]}<br><span class="muted" style="font-size:12px">${r[1]}</span></span><span class="datepill">${r[2]}</span></div>`).join('')}
const categoryName=t=>t.type==='withdrawal'?'Retirada del colchón':t.type==='expense'?EXPENSE_CATS[t.category]||'Otros':t.type==='saving'?SAVE_CATS[t.category]||'Ahorro':INCOME_CATS[t.category]||'Ingreso';
function txTable(txs){if(!txs.length)return '<div class="empty">Todavía no hay movimientos registrados aquí.<br>Empieza registrando tu próxima nómina o un gasto.</div>';return `<div class="table-wrap"><table class="tx-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th><th></th></tr></thead><tbody>${txs.map(t=>`<tr><td>${readableDate(t.date)}</td><td>${escapeHtml(t.note||categoryName(t))}</td><td><span class="badge">${escapeHtml(categoryName(t))}</span></td><td class="${t.type==='income'?'tx-plus':t.type==='withdrawal'?'tx-return':t.type==='saving'?'tx-save':'tx-minus'}">${t.type==='income'||t.type==='withdrawal'?'+':'−'}${euro(t.amount)}</td><td><button title="Eliminar movimiento" aria-label="Eliminar movimiento" data-delete="${escapeHtml(t.id)}" class="button secondary small">×</button></td></tr>`).join('')}</tbody></table></div>`}
function renderTransactions(){const txs=[...db.txs].sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));$('all-txs').innerHTML=txTable(txs.filter(t=>inMonth(t)));$('recent-txs').innerHTML=txTable(txs.filter(t=>inMonth(t)).slice(0,5));$('tx-count').textContent=txs.filter(t=>inMonth(t)).length+' este mes'}
function paydaysUntil(target){const now=new Date(localDate()+'T12:00:00');const end=new Date(target+'T12:00:00');let count=0;for(let yy=now.getFullYear(); yy<=end.getFullYear(); yy++){for(let mm=0;mm<12;mm++){const payday=new Date(yy,mm,Math.min(db.settings.payTo||30,new Date(yy,mm+1,0).getDate()),12);if(payday>=now&&payday<=end)count++}}return count}
function renderProjection(){const s=db.settings;const n=paydaysUntil(s.motoDate);const rem=Math.max(0,s.motoGoal-savedFor('moto'));const required=n>0?Math.ceil(rem/n*100)/100:0;const forecastSaving=money(s.motoMonthly*n+savedFor('moto'));const gap=money(forecastSaving-s.motoGoal);const monthsCol=s.emergencyMonthly>0?Math.ceil(Math.max(0,s.emergencyGoal-savedFor('emergency'))/s.emergencyMonthly):0;$('projection').innerHTML=`<div class="forecast"><div><small>Nóminas pendientes hasta la meta</small><strong>${n}</strong><small>Último cobro posible antes del ${readableDate(s.motoDate)}</small></div><div><small>Necesitas reservar por nómina</small><strong>${n?euro(required):rem>0?'Sin nóminas disponibles':'0 €'}</strong><small>Para llegar a los ${euro(s.motoGoal)}</small></div><div><small>Si sigues tu plan para la moto</small><strong style="color:${gap>=0?'var(--accent)':'var(--danger)'}">${euro(forecastSaving)}</strong><small>${gap>=0?'Meta cubierta con margen de '+euro(gap):'Te faltarían '+euro(-gap)}</small></div></div><p class="small-note">Colchón de ${euro(s.emergencyGoal)}: ${monthsCol===0?'objetivo alcanzado':s.emergencyMonthly>0?'aproximadamente '+monthsCol+' meses con las aportaciones previstas':'sin aportación mensual planificada'}.</p>`}
function updateTxCategory(){
 const type=$('tx-type').value;
 const map=type==='income'?INCOME_CATS:type==='saving'?SAVE_CATS:type==='withdrawal'?{emergency:'Colchón de emergencia'}:EXPENSE_CATS;
 $('tx-category').innerHTML=Object.entries(map).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
 $('tx-note').required=type==='withdrawal';
 const label=document.querySelector('label[for="tx-note"]');if(label)label.textContent=type==='withdrawal'?'Motivo de la retirada (obligatorio)':'Descripción (opcional)';
 if(type==='income'){$('tx-amount').value=db.settings.income;$('tx-note').value='Nómina'}
 else if(type==='saving'){$('tx-amount').value=db.settings.motoMonthly;$('tx-note').value='Ahorro para la moto'}
 else {$('tx-amount').value='';$('tx-note').value='';}
}
function makeId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'t'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function addTx({type,amount,date,category,note}){
 amount=money(amount);
 if(!Number.isFinite(amount)||amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date))return toast('Indica una fecha y un importe válido.');
 if(type==='saving'&&amount>cashBalance()+0.001)return toast('No puedes apartar más dinero del que hay en el saldo registrado. Registra primero tu cobro.');
 if(type==='withdrawal'&&(category!=='emergency'||date>localDate()))return toast('Solo puedes registrar retiradas del colchón que ya hayan ocurrido.');
 if(type==='withdrawal'&&!String(note||'').trim())return toast('Indica el motivo de la retirada para registrarla.');
 const tx={id:makeId(),type,amount,date,category,note:String(note||'').slice(0,90)};
 if(!emergencyLedgerHealthy([...db.txs,tx]))return toast('No hay dinero suficiente en el colchón para esa fecha.');
 db.txs.push(tx);
 if(!persist()){db.txs.pop();return}
 render();toast(type==='withdrawal'?'Retirada guardada en el historial.':'Movimiento guardado correctamente.');return true;
}
function recordWithdrawal(e){
 e.preventDefault();
 const amount=Number($('emergency-withdraw').value),date=$('emergency-withdraw-date').value,note=$('emergency-withdraw-reason').value.trim();
 if(!note)return toast('Escribe el motivo de la retirada.');
 if(addTx({type:'withdrawal',amount,date,category:'emergency',note})){
  $('withdraw-form').reset();$('emergency-withdraw-date').value=localDate();
 }
}
function registerPay(){const date=localDate();if(monthlyIncomeExists(date.slice(0,7)))return toast('Ya hay una nómina registrada este mes. Si es otro ingreso, añádelo manualmente.');if(!confirm('¿Has recibido realmente la nómina de '+euro(db.settings.income)+'? Esto solo la registrará en tu presupuesto, no en tu banco.'))return;addTx({type:'income',amount:db.settings.income,date,category:'salary',note:'Nómina'})}
function recordSaving(kind){const amount=kind==='moto'?db.settings.motoMonthly:db.settings.emergencyMonthly;const label=kind==='moto'?'moto':'colchón';const v=prompt('¿Cuánto dinero has apartado realmente para '+label+'? (No se hace ninguna transferencia bancaria)',String(amount));if(v===null)return;const n=Number(v.replace(',','.'));if(!Number.isFinite(n)||n<=0)return toast('Escribe un importe válido.');addTx({type:'saving',amount:n,date:localDate(),category:kind,note:'Ahorro para '+label})}
function showSettings(){const s=db.settings;for(const key of ['income','opening','housing','fuel','insurance','installment','essentials','leisure'])$('s-'+key).value=s[key];$('s-moto-monthly').value=s.motoMonthly;$('s-emergency-monthly').value=s.emergencyMonthly;$('s-moto-goal').value=s.motoGoal;$('s-emergency-goal').value=s.emergencyGoal;$('s-moto-date').value=s.motoDate;$('s-payfrom').value=s.payFrom;$('s-payto').value=s.payTo;}
function saveSettings(e){e.preventDefault();const s={};for(const key of ['income','opening','housing','fuel','insurance','installment','essentials','leisure'])s[key]=money($('s-'+key).value);for(const [el,k] of [['s-moto-monthly','motoMonthly'],['s-emergency-monthly','emergencyMonthly'],['s-moto-goal','motoGoal'],['s-emergency-goal','emergencyGoal']])s[k]=money($(el).value);s.motoDate=$('s-moto-date').value;s.payFrom=Number($('s-payfrom').value);s.payTo=Number($('s-payto').value);if(!Number.isInteger(s.payFrom)||!Number.isInteger(s.payTo)||s.payFrom<1||s.payTo>31||s.payFrom>s.payTo)return toast('Revisa los días de cobro.');if(Object.entries(s).some(([k,v])=>k!=='motoDate'&&(!Number.isFinite(v)||v<0)&&k!=='opening')||s.motoGoal<=0||s.emergencyGoal<=0)return toast('Revisa los importes, deben ser válidos y no negativos.');db.settings=s;if(persist()){render();toast('Presupuesto actualizado.')} }
function setup(){const hour=new Date().getHours();$('page-title').textContent=(hour<13?'Buenos días':hour<21?'Buenas tardes':'Buenas noches')+' 👋';$('month').value=viewMonth;$('tx-date').value=localDate();updateTxCategory();showSettings();document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.goto)));document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>recordSaving(b.dataset.save)));$('addQuick').addEventListener('click',()=>setPage('movimientos'));$('month').addEventListener('change',e=>{if(e.target.value){viewMonth=e.target.value;render()}});$('tx-type').addEventListener('change',updateTxCategory);$('tx-category').addEventListener('change',e=>{if($('tx-type').value==='saving'){$('tx-amount').value=e.target.value==='moto'?db.settings.motoMonthly:db.settings.emergencyMonthly;$('tx-note').value=e.target.value==='moto'?'Ahorro para la moto':'Ahorro para el colchón'}});
$('tx-form').addEventListener('submit',e=>{e.preventDefault();if(addTx({type:$('tx-type').value,amount:$('tx-amount').value,date:$('tx-date').value,category:$('tx-category').value,note:$('tx-note').value})){updateTxCategory()}});$('pay-button').addEventListener('click',registerPay);
$('emergency-withdraw-date').value=localDate();
$('emergency-withdraw-date').max=localDate();
$('withdraw-form').addEventListener('submit',recordWithdrawal);
$('withdraw-shortcut').addEventListener('click',()=>{setPage('objetivos');$('emergency-withdraw').focus();$('withdraw-form').scrollIntoView({behavior:'smooth',block:'center'});});
document.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;const tx=db.txs.find(t=>t.id===b.dataset.delete);if(!tx)return;if(!confirm('¿Eliminar este movimiento?'))return;const remaining=db.txs.filter(t=>t.id!==b.dataset.delete);if(!emergencyLedgerHealthy(remaining))return toast('No puedes borrar este ahorro: hay retiradas posteriores que dependen de él.');db.txs=remaining;persist();render();toast('Movimiento eliminado.')});$('settings-form').addEventListener('submit',saveSettings);$('reset-budget').addEventListener('click',()=>{if(!confirm('¿Restablecer solo el presupuesto recomendado? Tus movimientos seguirán guardados.'))return;db.settings={...DEFAULT,opening:db.settings.opening};persist();showSettings();render();toast('Importes restaurados.')});$('export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:3,createdAt:new Date().toISOString(),...db},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='brujula-copia-'+localDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Copia de seguridad exportada. Guárdala en privado.')});$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Archivo demasiado grande');const x=JSON.parse(await file.text());if(!x.settings||!Array.isArray(x.txs))throw Error('Formato no reconocido');if(!confirm('Esta copia sustituirá los datos actuales de la aplicación. ¿Continuar?'))return;const allowed=['income','opening','housing','fuel','insurance','installment','essentials','leisure','motoMonthly','emergencyMonthly','motoGoal','emergencyGoal'];const cleanSettings={...DEFAULT};for(const k of allowed){if(Object.hasOwn(x.settings,k)){const num=Number(x.settings[k]);if(!Number.isFinite(num)||((k!=='opening')&&num<0))throw Error('Datos de importes no válidos');cleanSettings[k]=money(num)}}if(typeof x.settings.motoDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.settings.motoDate))cleanSettings.motoDate=x.settings.motoDate;const cleanTx=[];for(const t of x.txs){if(!t||!['income','expense','saving','withdrawal'].includes(t.type)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!Number.isFinite(Number(t.amount))||Number(t.amount)<=0)throw Error('Movimientos incorrectos');const map=t.type==='income'?INCOME_CATS:t.type==='saving'?SAVE_CATS:t.type==='withdrawal'?{emergency:'Colchón de emergencia'}:EXPENSE_CATS;if(!Object.hasOwn(map,t.category))throw Error('Categoría no válida');cleanTx.push({id:makeId(),type:t.type,category:t.category,date:t.date,amount:money(t.amount),note:String(t.note||'').slice(0,90)})}if(!emergencyLedgerHealthy(cleanTx))throw Error('La copia contiene retiradas superiores al saldo del colchón');db={settings:cleanSettings,txs:cleanTx};persist();showSettings();render();toast('Copia importada correctamente.')}catch(err){toast('No se pudo importar: '+err.message)}finally{e.target.value=''}});$('clear-data').addEventListener('click',()=>{if(!confirm('¿Seguro que quieres borrar todos tus movimientos y restaurar el presupuesto? Esta acción no se puede deshacer.'))return;db={settings:{...DEFAULT},txs:[]};persist();showSettings();render();toast('Datos borrados.')});render()}

function renderDaily(){
 const s=db.settings,now=new Date(),current=viewMonth===currentMonth();
 const spent=sum(txMonth('expense',viewMonth).filter(t=>t.category==='leisure'));
 const left=Math.max(0,money(s.leisure-spent));
 const daysInMonth=new Date(Number(viewMonth.slice(0,4)),Number(viewMonth.slice(5)),0).getDate();
 const remainingDays=current?Math.max(1,daysInMonth-now.getDate()+1):daysInMonth;
 const perDay=money(Math.min(s.leisure/daysInMonth,left/remainingDays));
 $('daily-limit').textContent=euro(perDay)+' / día';
 $('daily-message').textContent=current?'Ritmo diario prudente para ocio: te quedan '+euro(left)+' para los '+remainingDays+' días restantes. No representa tu saldo en el banco.':'Ritmo de gasto de ocio estimado para este mes. No representa tu saldo bancario.';
 $('leisure-progress').style.width=percentage(spent,s.leisure)+'%';
 $('leisure-used').textContent='Gastado: '+euro(spent);
 $('leisure-left').textContent='Disponible: '+euro(left);
 $('leisure-monthly').textContent=euro(s.leisure);
 $('save-monthly').textContent=euro(s.motoMonthly+s.emergencyMonthly);
 $('safety-monthly').textContent=euro(planMargin());
}
function exportMovementsCSV(){
 const cell=v=>{let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const rows=[['Fecha','Tipo','Categoría','Importe','Nota'],...db.txs.map(t=>[t.date,t.type,t.category,Number(t.amount).toFixed(2),t.note||''])];
 const content='\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='midinero-movimientos-'+localDate()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('CSV exportado.');
}
$('export-csv').addEventListener('click',exportMovementsCSV);

setup();
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
try{const legacy=JSON.parse(localStorage.getItem('midinero_state_v1')||'null');if(legacy&&(legacy.transactions?.length||legacy.goals?.length||legacy.initialBalance)&&!db.txs.length)$('legacy-notice').style.display='block';}catch(e){}