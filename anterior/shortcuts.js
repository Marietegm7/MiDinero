(function () {
  const SHORTCUT_PREFIX = 'MIDINERO1';

  function parseAmountShortcut(value) {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return NaN;
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    let normalized = raw;
    if (lastComma >= 0 && lastDot >= 0) {
      normalized = lastComma > lastDot
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    } else if (lastComma >= 0) {
      normalized = raw.replace(',', '.');
    }
    return Number(normalized);
  }

  function normalizeType(value) {
    const v = String(value || '').toLowerCase();
    if (['income', 'ingreso', 'cobro', 'entrada'].includes(v)) return 'income';
    if (['expense', 'gasto', 'pago', 'salida'].includes(v)) return 'expense';
    return 'expense';
  }

  function validCategory(id, type) {
    if (type === 'income') return 'other';
    return state.categories.some(c => c.id === id) ? id : (state.categories[0]?.id || 'other');
  }

  function parseShortcutPayload(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith(`${SHORTCUT_PREFIX}|`)) return null;
    const parts = raw.split('|');
    const type = normalizeType(parts[1]);
    const amount = parseAmountShortcut(parts[2]);
    const note = (parts[3] || '').trim().slice(0, 80);
    const categoryId = validCategory((parts[4] || '').trim(), type);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(parts[5] || '') ? parts[5] : todayISO();
    if (!(amount > 0)) return null;
    return { type, amount, note, categoryId, date };
  }

  function shortcutFromUrl() {
    const p = new URLSearchParams(location.search);
    const action = p.get('accion') || p.get('action') || p.get('tipo') || p.get('type');
    if (!action) return null;
    const type = normalizeType(action);
    const amount = parseAmountShortcut(p.get('importe') || p.get('amount'));
    const note = (p.get('nota') || p.get('note') || '').trim().slice(0, 80);
    const categoryId = validCategory(p.get('categoria') || p.get('category') || '', type);
    const dateRaw = p.get('fecha') || p.get('date') || '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayISO();
    if (!(amount > 0)) return null;
    return { type, amount, note, categoryId, date };
  }

  function standaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  openTransaction = function (id, preset = null) {
    const existing = state.transactions.find(x => x.id === id);
    const t = existing || {
      type: preset?.type || 'expense',
      amount: preset?.amount ?? '',
      date: preset?.date || todayISO(),
      categoryId: preset?.categoryId || (preset?.type === 'income' ? 'other' : 'food'),
      note: preset?.note || ''
    };
    const safariWarning = !id && preset && !standaloneMode()
      ? '<div class="purchase-result"><strong>Atajo recibido</strong><p class="subtle" style="margin:8px 0 0">Estás en Safari. Si normalmente usas MiDinero desde el icono de inicio, es mejor importar el atajo dentro de la app instalada para que se guarde en sus datos.</p></div>'
      : '';

    openModal({
      eyebrow: id ? 'EDITAR' : (preset ? 'ATAJO' : 'NUEVO'),
      title: 'Movimiento',
      body: `${safariWarning}
        <div class="segmented"><button type="button" data-type="expense" class="${t.type === 'expense' ? 'active' : ''}">Gasto</button><button type="button" data-type="income" class="${t.type === 'income' ? 'active' : ''}">Ingreso</button></div>
        <input type="hidden" id="txType" value="${t.type}">
        <div class="field"><label>Importe</label><input id="txAmount" type="text" inputmode="decimal" value="${t.amount}" placeholder="0,00"></div>
        <div class="inline-fields"><div class="field"><label>Fecha</label><input id="txDate" type="date" value="${t.date}"></div><div class="field" id="txCatWrap"><label>Categoría</label><select id="txCategory">${categoryOptions(t.categoryId)}</select></div></div>
        <div class="field"><label>Descripción</label><input id="txNote" maxlength="80" value="${esc(t.note)}" placeholder="Ej. Nómina"></div>`,
      actions: `${id ? '<button type="button" class="danger-btn" id="deleteTx">Eliminar</button>' : ''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveTx">Guardar</button>`
    });

    document.querySelectorAll('#modal [data-type]').forEach(b => b.onclick = () => {
      document.querySelectorAll('#modal [data-type]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('#txType').value = b.dataset.type;
      $('#txCatWrap').style.opacity = b.dataset.type === 'income' ? '.45' : '1';
    });

    $('#txCatWrap').style.opacity = t.type === 'income' ? '.45' : '1';
    $('#cancelModal').onclick = closeModal;
    $('#saveTx').onclick = () => {
      const amount = parseAmountShortcut($('#txAmount').value);
      if (!(amount > 0)) return toast('Introduce un importe válido');
      const obj = {
        id: id || uid(),
        type: $('#txType').value,
        amount,
        date: $('#txDate').value || todayISO(),
        categoryId: $('#txCategory').value,
        note: $('#txNote').value.trim()
      };
      if (id) state.transactions = state.transactions.map(x => x.id === id ? obj : x);
      else state.transactions.push(obj);
      closeModal();
      saveState();
      toast('Movimiento guardado');
    };
    $('#deleteTx')?.addEventListener('click', () => {
      state.transactions = state.transactions.filter(x => x.id !== id);
      closeModal();
      saveState();
      toast('Movimiento eliminado');
    });
  };

  async function importShortcutClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const preset = parseShortcutPayload(text);
      if (!preset) return toast('No encuentro un movimiento válido del Atajo');
      openTransaction(null, preset);
    } catch (e) {
      toast('Permite leer el portapapeles y vuelve a intentarlo');
    }
  }

  const originalRenderMore = renderMore;
  renderMore = function () {
    return `${originalRenderMore()}
      <section class="card">
        <p class="eyebrow">SIRI Y ATAJOS</p>
        <h3>Movimiento rápido</h3>
        <p class="subtle">Un Atajo puede copiar un ingreso o gasto y MiDinero lo abre listo para confirmar.</p>
        <button type="button" class="primary full" id="pasteShortcutBtn">📋 Pegar movimiento del Atajo</button>
      </section>`;
  };

  const originalBindViewEvents = bindViewEvents;
  bindViewEvents = function () {
    originalBindViewEvents();
    $('#pasteShortcutBtn')?.addEventListener('click', importShortcutClipboard);
  };

  const preset = shortcutFromUrl();
  if (preset) {
    history.replaceState({}, '', location.pathname + location.hash);
    setTimeout(() => openTransaction(null, preset), 250);
  }

  if (typeof render === 'function') render();
})();
