const STORAGE_KEY = 'midinero_state_v1';
const defaultCategories = [
  {id:'food',name:'Comida',icon:'🍔'}, {id:'home',name:'Casa',icon:'🏠'},
  {id:'transport',name:'Transporte',icon:'🚗'}, {id:'fun',name:'Ocio',icon:'🎮'},
  {id:'shopping',name:'Compras',icon:'🛍️'}, {id:'subscriptions',name:'Suscripciones',icon:'📱'},
  {id:'health',name:'Personal',icon:'❤️'}, {id:'other',name:'Otros',icon:'📦'}
];
const freshState = () => ({
  version:1, onboarded:false, initialBalance:0, protectedBalance:0,
  categories:structuredClone(defaultCategories), transactions:[], budgets:[], goals:[], recurring:[]
});
let state = loadState();
let currentView = 'dashboard';

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const esc = (v='') => String(v).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);
const money = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n||0));
const dateFmt = d => new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short'}).format(new Date(`${d}T12:00:00`));
const monthKey = d => d.slice(0,7);
const currentMonth = () => todayISO().slice(0,7);
const catById = id => state.categories.find(c=>c.id===id) || {name:'Otros',icon:'📦'};

function loadState(){
  try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? {...freshState(),...JSON.parse(raw)} : freshState(); }
  catch { return freshState(); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); render(); }
function transactionSum(){ return state.transactions.reduce((s,t)=>s+(t.type==='income'?Number(t.amount):-Number(t.amount)),0); }
function realBalance(){ return Number(state.initialBalance)+transactionSum(); }
function reservedGoals(){ return state.goals.reduce((s,g)=>s+Number(g.saved||0),0); }
function thisMonthExpenses(categoryId){
  return state.transactions.filter(t=>t.type==='expense' && monthKey(t.date)===currentMonth() && (!categoryId || t.categoryId===categoryId)).reduce((s,t)=>s+Number(t.amount),0);
}
function nextRecurringDate(item, from=new Date()){
  const y=from.getFullYear(), m=from.getMonth();
  const make=(yy,mm)=>new Date(yy,mm,Math.min(Number(item.day||1),new Date(yy,mm+1,0).getDate()),12);
  let d=make(y,m); if(d < new Date(from.getFullYear(),from.getMonth(),from.getDate(),12)) d=make(y,m+1); return d;
}
function upcomingCommitments(){
  const now=new Date();
  const incomes=state.recurring.filter(r=>r.type==='income').map(r=>nextRecurringDate(r,now)).sort((a,b)=>a-b);
  const horizon=incomes[0] || new Date(now.getFullYear(),now.getMonth()+1,1,12);
  return state.recurring.filter(r=>r.type==='expense').map(r=>({r,d:nextRecurringDate(r,now)})).filter(x=>x.d<=horizon).reduce((s,x)=>s+Number(x.r.amount),0);
}
function spendable(){ return realBalance()-reservedGoals()-Number(state.protectedBalance||0)-upcomingCommitments(); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

function render(){
  const titles={dashboard:'Inicio',transactions:'Movimientos',goals:'Objetivos',budgets:'Límites',more:'Más'};
  $('#viewTitle').textContent=titles[currentView];
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
  const views={dashboard:renderDashboard,transactions:renderTransactions,goals:renderGoals,budgets:renderBudgets,more:renderMore};
  $('#mainContent').innerHTML=views[currentView]();
  bindViewEvents();
}

function renderDashboard(){
  const bal=realBalance(), res=reservedGoals(), commit=upcomingCommitments(), free=spendable();
  const tx=state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  const goals=state.goals.slice(0,3);
  const budgetCards=state.budgets.slice(0,3).map(b=>{
    const spent=thisMonthExpenses(b.categoryId), pct=clamp((spent/Number(b.limit||1))*100,0,100), c=catById(b.categoryId), left=Number(b.limit)-spent;
    return `<div class="row"><div class="avatar">${c.icon}</div><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-meta">${money(spent)} de ${money(b.limit)} · quedan ${money(Math.max(0,left))}</div><div class="progress"><i style="width:${pct}%"></i></div></div></div>`;
  }).join('');
  return `
    <section class="card hero">
      <div class="label">Dinero seguro para gastar</div>
      <div class="money-xl ${free<0?'danger':''}">${money(free)}</div>
      <p class="subtle">Saldo real menos objetivos, colchón protegido y gastos fijos próximos.</p>
      <div class="stat-grid">
        <div class="stat"><small>Saldo real</small><strong>${money(bal)}</strong></div>
        <div class="stat"><small>Objetivos</small><strong>${money(res)}</strong></div>
        <div class="stat"><small>Comprometido</small><strong>${money(commit)}</strong></div>
        <div class="stat"><small>Protegido</small><strong>${money(state.protectedBalance)}</strong></div>
      </div>
    </section>
    <section class="action-grid">
      <button class="primary" id="purchaseBtn">🛒 ¿Me lo puedo comprar?</button>
      <button class="secondary" id="adjustBtn">≈ Ajustar saldo</button>
    </section>
    <div class="two-col">
      <section class="card">
        <div class="section-head"><div><p class="eyebrow">ESTE MES</p><h3>Límites</h3></div><button class="link-button" data-go="budgets">Ver todos</button></div>
        <div class="list">${budgetCards || '<div class="empty">Todavía no has creado límites de gasto.</div>'}</div>
      </section>
      <section class="card">
        <div class="section-head"><div><p class="eyebrow">AHORRO</p><h3>Objetivos</h3></div><button class="link-button" data-go="goals">Ver todos</button></div>
        <div class="list">${goals.map(g=>goalRow(g)).join('') || '<div class="empty">Añade un objetivo para empezar a reservar dinero.</div>'}</div>
      </section>
    </div>
    <section class="card">
      <div class="section-head"><div><p class="eyebrow">HISTORIAL</p><h3>Últimos movimientos</h3></div><button class="link-button" data-go="transactions">Ver todos</button></div>
      <div class="list">${tx.map(transactionRow).join('') || '<div class="empty">Aún no hay movimientos.</div>'}</div>
    </section>`;
}
function transactionRow(t){ const c=catById(t.categoryId); return `<button class="row tx-row" data-id="${t.id}" style="width:100%;text-align:left;color:inherit"><div class="avatar">${t.type==='income'?'💰':c.icon}</div><div class="row-main"><div class="row-title">${esc(t.note || (t.type==='income'?'Ingreso':c.name))}</div><div class="row-meta">${dateFmt(t.date)} · ${t.type==='income'?'Ingreso':esc(c.name)}</div></div><div class="amount ${t.type==='income'?'good':''}">${t.type==='income'?'+':'−'}${money(t.amount)}</div></button>`; }
function goalRow(g){ const pct=clamp((Number(g.saved)/Number(g.target||1))*100,0,100); return `<button class="row goal-row" data-id="${g.id}" style="width:100%;text-align:left;color:inherit"><div class="avatar">🎯</div><div class="row-main"><div class="row-title">${esc(g.name)}</div><div class="row-meta">${money(g.saved)} de ${money(g.target)}${g.date?` · ${dateFmt(g.date)}`:''}</div><div class="progress"><i style="width:${pct}%"></i></div></div><strong>${Math.round(pct)}%</strong></button>`; }

function renderTransactions(){
  const sorted=state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `<section class="card"><div class="section-head"><div><p class="eyebrow">TOTAL</p><h3>${money(realBalance())}</h3></div><button class="primary" id="addTxBtn">＋ Añadir</button></div><div class="list">${sorted.map(transactionRow).join('') || '<div class="empty">Añade tu primer ingreso o gasto.</div>'}</div></section>`;
}
function renderGoals(){
  return `<section class="card"><div class="section-head"><div><p class="eyebrow">RESERVADO</p><h3>${money(reservedGoals())}</h3></div><button class="primary" id="addGoalBtn">＋ Objetivo</button></div><div class="list">${state.goals.map(goalRow).join('') || '<div class="empty">Puedes crear un objetivo para un viaje, móvil, ordenador o cualquier compra.</div>'}</div></section>`;
}
function renderBudgets(){
  const rows=state.budgets.map(b=>{ const c=catById(b.categoryId), spent=thisMonthExpenses(b.categoryId), left=Number(b.limit)-spent, pct=clamp(spent/Number(b.limit||1)*100,0,100); return `<button class="row budget-row" data-id="${b.id}" style="width:100%;text-align:left;color:inherit"><div class="avatar">${c.icon}</div><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-meta">${money(spent)} gastados · ${left>=0?`${money(left)} disponibles`:`${money(Math.abs(left))} por encima`}</div><div class="progress"><i style="width:${pct}%"></i></div></div><div class="amount">${money(b.limit)}</div></button>`; }).join('');
  return `<section class="card"><div class="section-head"><div><p class="eyebrow">PRESUPUESTOS</p><h3>${money(thisMonthExpenses())} gastados este mes</h3></div><button class="primary" id="addBudgetBtn">＋ Límite</button></div><div class="list">${rows || '<div class="empty">Crea límites mensuales por categoría.</div>'}</div></section>`;
}
function renderMore(){
  const recurringRows=state.recurring.map(r=>`<button class="row recurring-row" data-id="${r.id}" style="width:100%;text-align:left;color:inherit"><div class="avatar">${r.type==='income'?'💰':'📅'}</div><div class="row-main"><div class="row-title">${esc(r.name)}</div><div class="row-meta">Día ${r.day} · ${r.type==='income'?'Ingreso':'Gasto fijo'}</div></div><div class="amount ${r.type==='income'?'good':''}">${r.type==='income'?'+':'−'}${money(r.amount)}</div></button>`).join('');
  const categoryRows=state.categories.map(c=>`<button class="row category-row" data-id="${c.id}" style="width:100%;text-align:left;color:inherit"><div class="avatar">${esc(c.icon)}</div><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-meta">Categoría de gasto</div></div><span>›</span></button>`).join('');
  return `<section class="card"><div class="section-head"><div><p class="eyebrow">FIJOS</p><h3>Ingresos y gastos recurrentes</h3></div><button class="primary" id="addRecurringBtn">＋ Añadir</button></div><div class="list">${recurringRows || '<div class="empty">Añade nómina, alquiler, suscripciones y otros pagos habituales.</div>'}</div></section>
  <section class="card"><div class="section-head"><div><p class="eyebrow">ORGANIZACIÓN</p><h3>Categorías</h3></div><button class="primary" id="addCategoryBtn">＋ Categoría</button></div><div class="list">${categoryRows}</div></section>
  <section class="card"><p class="eyebrow">SEGURIDAD FINANCIERA</p><h3>Colchón protegido</h3><p class="subtle">Esta cantidad nunca se considera disponible para gastar.</p><div class="kpi"><span>Importe protegido</span><strong>${money(state.protectedBalance)}</strong></div><button class="secondary full" id="protectedBtn">Cambiar colchón</button></section>
  <section class="card"><p class="eyebrow">DATOS</p><h3>Copia de seguridad</h3><p class="subtle">Tus datos están en este dispositivo. Exporta una copia de vez en cuando.</p><div class="action-grid"><button class="secondary" id="exportBtn">Exportar copia</button><button class="secondary" id="importBtn">Importar copia</button></div><input type="file" id="importFile" accept="application/json" hidden><button class="danger-btn full" id="resetBtn" style="margin-top:10px">Borrar todos los datos</button></section>`;
}

function bindViewEvents(){
  $$('[data-go]').forEach(b=>b.onclick=()=>{currentView=b.dataset.go;render();});
  $('#purchaseBtn')?.addEventListener('click',openPurchase);
  $('#adjustBtn')?.addEventListener('click',openAdjust);
  $('#addTxBtn')?.addEventListener('click',()=>openTransaction());
  $$('.tx-row').forEach(b=>b.onclick=()=>openTransaction(b.dataset.id));
  $('#addGoalBtn')?.addEventListener('click',()=>openGoal());
  $$('.goal-row').forEach(b=>b.onclick=()=>openGoal(b.dataset.id));
  $('#addBudgetBtn')?.addEventListener('click',()=>openBudget());
  $$('.budget-row').forEach(b=>b.onclick=()=>openBudget(b.dataset.id));
  $('#addRecurringBtn')?.addEventListener('click',()=>openRecurring());
  $$('.recurring-row').forEach(b=>b.onclick=()=>openRecurring(b.dataset.id));
  $('#addCategoryBtn')?.addEventListener('click',()=>openCategory());
  $$('.category-row').forEach(b=>b.onclick=()=>openCategory(b.dataset.id));
  $('#protectedBtn')?.addEventListener('click',openProtected);
  $('#exportBtn')?.addEventListener('click',exportData);
  $('#importBtn')?.addEventListener('click',()=>$('#importFile').click());
  $('#importFile')?.addEventListener('change',importData);
  $('#resetBtn')?.addEventListener('click',resetData);
}

function openModal({eyebrow='',title,body,actions}){
  $('#modalEyebrow').textContent=eyebrow; $('#modalTitle').textContent=title; $('#modalBody').innerHTML=body; $('#modalActions').innerHTML=actions || '';
  $('#modal').showModal();
}
function closeModal(){ $('#modal').close(); }
function toast(msg){ const el=$('#toastTemplate').content.firstElementChild.cloneNode(true); el.textContent=msg; document.body.append(el); setTimeout(()=>el.remove(),2400); }
function categoryOptions(selected=''){ return state.categories.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join(''); }

function openTransaction(id){
  const t=state.transactions.find(x=>x.id===id) || {type:'expense',amount:'',date:todayISO(),categoryId:'food',note:''};
  openModal({eyebrow:id?'EDITAR':'NUEVO',title:'Movimiento',body:`
    <div class="segmented"><button type="button" data-type="expense" class="${t.type==='expense'?'active':''}">Gasto</button><button type="button" data-type="income" class="${t.type==='income'?'active':''}">Ingreso</button></div>
    <input type="hidden" id="txType" value="${t.type}">
    <div class="field"><label>Importe</label><input id="txAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${t.amount}" placeholder="0,00"></div>
    <div class="inline-fields"><div class="field"><label>Fecha</label><input id="txDate" type="date" value="${t.date}"></div><div class="field" id="txCatWrap"><label>Categoría</label><select id="txCategory">${categoryOptions(t.categoryId)}</select></div></div>
    <div class="field"><label>Descripción</label><input id="txNote" maxlength="80" value="${esc(t.note)}" placeholder="Ej. Supermercado"></div>`,
    actions:`${id?'<button type="button" class="danger-btn" id="deleteTx">Eliminar</button>':''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveTx">Guardar</button>`});
  $$('[data-type]','#modal').forEach(b=>b.onclick=()=>{ $$('[data-type]','#modal').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $('#txType').value=b.dataset.type; $('#txCatWrap').style.opacity=b.dataset.type==='income'?'.45':'1'; });
  $('#txCatWrap').style.opacity=t.type==='income'?'.45':'1';
  $('#cancelModal').onclick=closeModal;
  $('#saveTx').onclick=()=>{ const amount=Number($('#txAmount').value); if(!(amount>0)) return toast('Introduce un importe válido'); const obj={id:id||uid(),type:$('#txType').value,amount,date:$('#txDate').value||todayISO(),categoryId:$('#txCategory').value,note:$('#txNote').value.trim()}; if(id) state.transactions=state.transactions.map(x=>x.id===id?obj:x); else state.transactions.push(obj); closeModal();saveState();toast('Movimiento guardado'); };
  $('#deleteTx')?.addEventListener('click',()=>{ state.transactions=state.transactions.filter(x=>x.id!==id); closeModal();saveState();toast('Movimiento eliminado'); });
}

function openGoal(id){
  const g=state.goals.find(x=>x.id===id) || {name:'',target:'',saved:0,date:''};
  openModal({eyebrow:id?'OBJETIVO':'NUEVO',title:id?g.name:'Crear objetivo',body:`
    <div class="field"><label>Nombre</label><input id="goalName" maxlength="60" value="${esc(g.name)}" placeholder="Ej. Viaje a Japón"></div>
    <div class="inline-fields"><div class="field"><label>Objetivo (€)</label><input id="goalTarget" type="number" min="0" step="0.01" value="${g.target}" placeholder="1000"></div><div class="field"><label>Fecha opcional</label><input id="goalDate" type="date" value="${g.date||''}"></div></div>
    ${id?`<div class="purchase-result"><div class="kpi"><span>Reservado</span><strong>${money(g.saved)}</strong></div><div class="kpi"><span>Disponible general</span><strong>${money(spendable())}</strong></div></div><div class="inline-fields"><button type="button" class="secondary" id="fundGoal">＋ Reservar</button><button type="button" class="secondary" id="unfundGoal">− Liberar</button></div>`:''}`,
    actions:`${id?'<button type="button" class="danger-btn" id="deleteGoal">Eliminar</button>':''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveGoal">Guardar</button>`});
  $('#cancelModal').onclick=closeModal;
  $('#saveGoal').onclick=()=>{ const name=$('#goalName').value.trim(), target=Number($('#goalTarget').value); if(!name||!(target>0)) return toast('Completa nombre e importe'); const obj={...g,id:id||uid(),name,target,date:$('#goalDate').value}; if(id) state.goals=state.goals.map(x=>x.id===id?obj:x); else state.goals.push(obj); closeModal();saveState();toast('Objetivo guardado'); };
  $('#deleteGoal')?.addEventListener('click',()=>{state.goals=state.goals.filter(x=>x.id!==id);closeModal();saveState();toast('Objetivo eliminado; el dinero vuelve a estar disponible');});
  $('#fundGoal')?.addEventListener('click',()=>adjustGoalFunds(id,1));
  $('#unfundGoal')?.addEventListener('click',()=>adjustGoalFunds(id,-1));
}
function adjustGoalFunds(id,dir){
  const g=state.goals.find(x=>x.id===id); const max=dir>0?Math.max(0,Math.min(spendable(),Number(g.target)-Number(g.saved))):Number(g.saved);
  const label=dir>0?'reservar':'liberar';
  openModal({eyebrow:'OBJETIVO',title:`${dir>0?'Reservar':'Liberar'} dinero`,body:`<p class="subtle">Máximo disponible: ${money(max)}</p><div class="field"><label>Importe</label><input id="fundAmount" type="number" min="0" max="${max}" step="0.01" placeholder="0,00"></div>`,actions:`<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="applyFunds">${dir>0?'Reservar':'Liberar'}</button>`});
  $('#cancelModal').onclick=closeModal; $('#applyFunds').onclick=()=>{ const a=Number($('#fundAmount').value); if(!(a>0)||a>max) return toast('Importe no válido'); g.saved=Number(g.saved)+dir*a; closeModal();saveState();toast(`Dinero ${label}do`); };
}

function openBudget(id){
  const b=state.budgets.find(x=>x.id===id)||{categoryId:state.categories[0]?.id||'other',limit:''};
  openModal({eyebrow:'LÍMITE MENSUAL',title:id?'Editar límite':'Nuevo límite',body:`<div class="field"><label>Categoría</label><select id="budgetCat">${categoryOptions(b.categoryId)}</select></div><div class="field"><label>Límite mensual</label><input id="budgetLimit" type="number" min="0" step="0.01" value="${b.limit}" placeholder="200"></div>`,actions:`${id?'<button type="button" class="danger-btn" id="deleteBudget">Eliminar</button>':''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveBudget">Guardar</button>`});
  $('#cancelModal').onclick=closeModal; $('#saveBudget').onclick=()=>{ const categoryId=$('#budgetCat').value, limit=Number($('#budgetLimit').value); if(!(limit>0)) return toast('Introduce un límite válido'); const existing=state.budgets.find(x=>x.categoryId===categoryId && x.id!==id); if(existing) return toast('Esa categoría ya tiene un límite'); const obj={id:id||uid(),categoryId,limit}; if(id) state.budgets=state.budgets.map(x=>x.id===id?obj:x); else state.budgets.push(obj); closeModal();saveState();toast('Límite guardado'); };
  $('#deleteBudget')?.addEventListener('click',()=>{state.budgets=state.budgets.filter(x=>x.id!==id);closeModal();saveState();toast('Límite eliminado');});
}

function openRecurring(id){
  const r=state.recurring.find(x=>x.id===id)||{name:'',type:'expense',amount:'',day:1,categoryId:'subscriptions'};
  openModal({eyebrow:'RECURRENTE',title:id?'Editar fijo':'Añadir fijo',body:`<div class="segmented"><button type="button" data-rtype="expense" class="${r.type==='expense'?'active':''}">Gasto fijo</button><button type="button" data-rtype="income" class="${r.type==='income'?'active':''}">Ingreso</button></div><input id="rType" type="hidden" value="${r.type}"><div class="field"><label>Nombre</label><input id="rName" value="${esc(r.name)}" placeholder="Ej. Alquiler"></div><div class="inline-fields"><div class="field"><label>Importe</label><input id="rAmount" type="number" min="0" step="0.01" value="${r.amount}"></div><div class="field"><label>Día del mes</label><input id="rDay" type="number" min="1" max="31" value="${r.day}"></div></div><div class="field"><label>Categoría</label><select id="rCat">${categoryOptions(r.categoryId)}</select></div>`,actions:`${id?'<button type="button" class="danger-btn" id="deleteRecurring">Eliminar</button>':''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveRecurring">Guardar</button>`});
  $$('[data-rtype]','#modal').forEach(b=>b.onclick=()=>{$$('[data-rtype]','#modal').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#rType').value=b.dataset.rtype;});
  $('#cancelModal').onclick=closeModal; $('#saveRecurring').onclick=()=>{const name=$('#rName').value.trim(),amount=Number($('#rAmount').value),day=Number($('#rDay').value);if(!name||!(amount>0)||day<1||day>31)return toast('Revisa los datos');const obj={id:id||uid(),name,type:$('#rType').value,amount,day,categoryId:$('#rCat').value};if(id)state.recurring=state.recurring.map(x=>x.id===id?obj:x);else state.recurring.push(obj);closeModal();saveState();toast('Fijo guardado');};
  $('#deleteRecurring')?.addEventListener('click',()=>{state.recurring=state.recurring.filter(x=>x.id!==id);closeModal();saveState();toast('Fijo eliminado');});
}

function openCategory(id){
  const c=state.categories.find(x=>x.id===id)||{name:'',icon:'💡'};
  openModal({eyebrow:'CATEGORÍA',title:id?'Editar categoría':'Nueva categoría',body:`<div class="inline-fields"><div class="field"><label>Icono</label><input id="catIcon" maxlength="4" value="${esc(c.icon)}" placeholder="🍕"></div><div class="field"><label>Nombre</label><input id="catName" maxlength="30" value="${esc(c.name)}" placeholder="Ej. Restaurantes"></div></div>`,actions:`${id?'<button type="button" class="danger-btn" id="deleteCategory">Eliminar</button>':''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveCategory">Guardar</button>`});
  $('#cancelModal').onclick=closeModal;
  $('#saveCategory').onclick=()=>{const name=$('#catName').value.trim(),icon=$('#catIcon').value.trim()||'💡';if(!name)return toast('Ponle un nombre');const duplicate=state.categories.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==id);if(duplicate)return toast('Ya existe una categoría con ese nombre');const obj={id:id||uid(),name,icon};if(id)state.categories=state.categories.map(x=>x.id===id?obj:x);else state.categories.push(obj);closeModal();saveState();toast('Categoría guardada');};
  $('#deleteCategory')?.addEventListener('click',()=>{const used=state.transactions.some(x=>x.categoryId===id)||state.budgets.some(x=>x.categoryId===id)||state.recurring.some(x=>x.categoryId===id);if(used)return toast('No puedes eliminarla mientras tenga movimientos, límites o fijos');if(state.categories.length<=1)return toast('Debe quedar al menos una categoría');state.categories=state.categories.filter(x=>x.id!==id);closeModal();saveState();toast('Categoría eliminada');});
}

function openProtected(){
  openModal({eyebrow:'COLCHÓN',title:'Saldo mínimo protegido',body:`<p class="subtle">La app intentará que esta cantidad nunca se considere disponible para gastar.</p><div class="field"><label>Importe</label><input id="protectedAmount" type="number" min="0" step="0.01" value="${state.protectedBalance}"></div>`,actions:`<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveProtected">Guardar</button>`});
  $('#cancelModal').onclick=closeModal; $('#saveProtected').onclick=()=>{state.protectedBalance=Math.max(0,Number($('#protectedAmount').value)||0);closeModal();saveState();toast('Colchón actualizado');};
}
function openAdjust(){
  openModal({eyebrow:'SALDO REAL',title:'Ajustar saldo',body:`<p class="subtle">Ahora la app calcula ${money(realBalance())}. Escribe lo que tienes realmente y se creará un ajuste.</p><div class="field"><label>Saldo real</label><input id="realAmount" type="number" step="0.01" value="${realBalance().toFixed(2)}"></div>`,actions:`<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="applyAdjust">Ajustar</button>`});
  $('#cancelModal').onclick=closeModal; $('#applyAdjust').onclick=()=>{const target=Number($('#realAmount').value);if(!Number.isFinite(target))return toast('Introduce un saldo válido');const diff=target-realBalance();if(Math.abs(diff)>.004)state.transactions.push({id:uid(),type:diff>=0?'income':'expense',amount:Math.abs(diff),date:todayISO(),categoryId:'other',note:'Ajuste de saldo'});closeModal();saveState();toast('Saldo ajustado');};
}
function openPurchase(){
  const free=spendable();
  openModal({eyebrow:'SIMULADOR',title:'¿Me lo puedo comprar?',body:`<div class="field"><label>Qué quieres comprar</label><input id="purchaseName" placeholder="Ej. Auriculares"></div><div class="field"><label>Precio</label><input id="purchasePrice" type="number" min="0" step="0.01" placeholder="0,00"></div><div id="purchaseOutput"></div>`,actions:`<button type="button" class="secondary" id="cancelModal">Cerrar</button><button type="button" class="primary" id="simulatePurchase">Calcular</button>`});
  $('#cancelModal').onclick=closeModal; $('#simulatePurchase').onclick=()=>{const p=Number($('#purchasePrice').value), name=$('#purchaseName').value.trim()||'Esta compra'; if(!(p>0))return toast('Introduce el precio'); const after=free-p; let cls='good',title='Sí, encaja en tu plan'; if(after<0){cls='danger';title='No es recomendable ahora';} else if(after < Math.max(50,free*.2)){cls='warn';title='Puedes, pero te deja poco margen';} $('#purchaseOutput').innerHTML=`<div class="purchase-result"><h3 class="${cls}">${title}</h3><p class="subtle">${esc(name)} cuesta ${money(p)}.</p><div class="kpi"><span>Disponible antes</span><strong>${money(free)}</strong></div><div class="kpi"><span>Disponible después</span><strong class="${after<0?'danger':''}">${money(after)}</strong></div><div class="kpi"><span>Objetivos reservados</span><strong>${money(reservedGoals())}</strong></div><div class="kpi"><span>Gastos fijos próximos</span><strong>${money(upcomingCommitments())}</strong></div></div>`; };
}

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`midinero-copia-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url); toast('Copia exportada');
}
function importData(e){ const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const obj=JSON.parse(reader.result); if(!obj || !Array.isArray(obj.transactions)) throw new Error(); state={...freshState(),...obj,onboarded:true};saveState();toast('Copia importada');}catch{toast('El archivo no parece una copia válida');}}; reader.readAsText(file); }
function resetData(){ if(confirm('¿Seguro? Esto borrará todos los datos guardados en este dispositivo.')){state=freshState();localStorage.removeItem(STORAGE_KEY);render();startOnboarding();} }
function startOnboarding(){
  openModal({eyebrow:'BIENVENIDO',title:'Configura MiDinero',body:`<p class="subtle">Introduce lo que tienes ahora mismo. Después podrás añadir tus ingresos, gastos fijos, límites y objetivos.</p><div class="field"><label>Saldo actual</label><input id="startBalance" type="number" step="0.01" placeholder="0,00"></div><div class="field"><label>Colchón que no quieres tocar (opcional)</label><input id="startProtected" type="number" min="0" step="0.01" placeholder="0,00"></div>`,actions:`<button type="button" class="primary full" id="finishOnboarding">Empezar</button>`});
  $('#finishOnboarding').onclick=()=>{state.initialBalance=Number($('#startBalance').value)||0;state.protectedBalance=Math.max(0,Number($('#startProtected').value)||0);state.onboarded=true;closeModal();saveState();toast('Tu espacio está listo');};
}

$$('.nav-item').forEach(b=>b.addEventListener('click',()=>{currentView=b.dataset.view;render();}));
$('#quickAddBtn').addEventListener('click',()=>openTransaction());
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
if(!state.onboarded) setTimeout(startOnboarding,180);
