(function () {
  function parseAmountFix(value) {
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

  function showRecurringError(message) {
    let el = document.querySelector('#modalError');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modalError';
      document.querySelector('#modalBody')?.appendChild(el);
    }
    el.hidden = false;
    el.textContent = message;
    el.style.cssText = 'padding:10px 12px;border-radius:12px;background:rgba(255,80,100,.12);border:1px solid rgba(255,80,100,.35);color:#ffb9c2;font-size:.92rem;font-weight:700';
  }

  openRecurring = function (id) {
    const r = state.recurring.find(x => x.id === id) || {
      name: '', type: 'expense', amount: '', day: 1, categoryId: 'subscriptions'
    };

    openModal({
      eyebrow: 'RECURRENTE',
      title: id ? 'Editar fijo' : 'Añadir fijo',
      body: `<div class="segmented"><button type="button" data-rtype="expense" class="${r.type === 'expense' ? 'active' : ''}">Gasto fijo</button><button type="button" data-rtype="income" class="${r.type === 'income' ? 'active' : ''}">Ingreso</button></div><input id="rType" type="hidden" value="${r.type}"><div class="field"><label>Nombre</label><input id="rName" value="${esc(r.name)}" placeholder="Ej. Alquiler"></div><div class="inline-fields"><div class="field"><label>Importe</label><input id="rAmount" type="text" inputmode="decimal" value="${r.amount}" placeholder="0,00"></div><div class="field"><label>Día del mes</label><input id="rDay" type="number" inputmode="numeric" min="1" max="31" value="${r.day}"></div></div><div class="field"><label>Categoría</label><select id="rCat">${categoryOptions(r.categoryId)}</select></div><div id="modalError" hidden></div>`,
      actions: `${id ? '<button type="button" class="danger-btn" id="deleteRecurring">Eliminar</button>' : ''}<button type="button" class="secondary" id="cancelModal">Cancelar</button><button type="button" class="primary" id="saveRecurring">Guardar</button>`
    });

    $$('[data-rtype]', '#modal').forEach(b => b.onclick = () => {
      $$('[data-rtype]', '#modal').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('#rType').value = b.dataset.rtype;
    });

    $('#cancelModal').onclick = closeModal;
    $('#saveRecurring').onclick = () => {
      const name = $('#rName').value.trim();
      const amount = parseAmountFix($('#rAmount').value);
      const day = parseInt($('#rDay').value, 10);

      if (!name) return showRecurringError('Escribe un nombre, por ejemplo Alquiler.');
      if (!Number.isFinite(amount) || amount <= 0) return showRecurringError('Introduce un importe válido, por ejemplo 650 o 12,99.');
      if (!Number.isInteger(day) || day < 1 || day > 31) return showRecurringError('El día del mes debe estar entre 1 y 31.');

      const obj = {
        id: id || uid(),
        name,
        type: $('#rType').value,
        amount,
        day,
        categoryId: $('#rCat').value
      };

      if (id) state.recurring = state.recurring.map(x => x.id === id ? obj : x);
      else state.recurring.push(obj);

      closeModal();
      saveState();
      toast('Fijo guardado');
    };

    $('#deleteRecurring')?.addEventListener('click', () => {
      state.recurring = state.recurring.filter(x => x.id !== id);
      closeModal();
      saveState();
      toast('Fijo eliminado');
    });
  };

  if (typeof render === 'function') render();
})();
