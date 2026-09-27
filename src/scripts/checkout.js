// Mock checkout step machine. Reads the cart with loadCart; its only write is emptying the cart (clearCart) when the
// demo order is confirmed. Never sends anything over the network or persists a choice anywhere. Method/branch/slot/payment choices
// live in local JS variables for the page lifetime only; name, phone and address text is only
// read from the inputs, never stored. Does not import site.json:
// only the few strings/lists this page needs are embedded (see #checkout-strings in
// CheckoutView.astro), so the client bundle does not carry the whole catalog's descriptions.
import { loadCart, clearCart } from '../lib/cart-store.js';
import { cartTotal, countItems } from '../lib/cart-core.js';
import { formatPrice, formatNum, roundMoney } from '../lib/price-format.js';
import { isValidPhone, summaryRows, demoOrderNumber, confirmationRows } from '../lib/checkout-core.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
const stringsEl = document.getElementById('checkout-strings');
const strings = stringsEl ? JSON.parse(stringsEl.textContent) : {};
const currency = strings.currency;
const t = (key) => strings[key];

const catalogEl = document.getElementById('store-catalog');
const catalog = catalogEl ? JSON.parse(catalogEl.textContent) : {};
const items = loadCart().filter((it) => catalog[it.slug]);

const emptyEl = document.querySelector('[data-checkout-empty]');
const stepsOl = document.querySelector('ol[aria-label]');
const sections = [...document.querySelectorAll('[data-step-section]')];
const indicators = [...document.querySelectorAll('[data-step-indicator]')];

if (items.length === 0) {
  if (emptyEl) emptyEl.hidden = false;
  if (stepsOl) stepsOl.hidden = true;
  sections.forEach((s) => {
    s.hidden = true;
  });
} else {
  if (emptyEl) emptyEl.hidden = true;
  initSteps();
}

function initSteps() {
  let step = 1;
  let method = null;
  let branchIndex = null;
  let slotIndex = null;
  let paymentIndex = null;

  const methodRadios = [...document.querySelectorAll('input[name="method"]')];
  const deliveryPanel = document.querySelector('[data-method-panel="delivery"]');
  const pickupPanel = document.querySelector('[data-method-panel="pickup"]');
  const areaInput = document.getElementById('addr-area');
  const streetInput = document.getElementById('addr-street');
  const buildingInput = document.getElementById('addr-building');
  const landmarkInput = document.getElementById('addr-landmark');
  const branchRadios = [...document.querySelectorAll('input[name="branch"]')];
  const slotRadios = [...document.querySelectorAll('input[name="slot"]')];
  const slotLegend = document.getElementById('slot-legend');
  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const paymentRadios = [...document.querySelectorAll('input[name="payment"]')];
  const contactError = document.getElementById('contact-error');
  const contactFieldset = document.getElementById('contact-fieldset');
  const paymentError = document.getElementById('payment-error');
  const paymentFieldset = document.getElementById('payment-fieldset');

  const methodError = document.getElementById('method-error');
  const addressError = document.getElementById('address-error');
  const branchError = document.getElementById('branch-error');
  const slotError = document.getElementById('slot-error');
  const methodFieldset = document.getElementById('method-fieldset');
  const deliveryFieldset = document.getElementById('delivery-fieldset');
  const pickupFieldset = document.getElementById('pickup-fieldset');
  const slotFieldset = document.getElementById('slot-fieldset');

  function updatePanels() {
    const checked = document.querySelector('input[name="method"]:checked');
    const val = checked ? checked.value : null;
    if (deliveryPanel) deliveryPanel.hidden = val !== 'delivery';
    if (pickupPanel) pickupPanel.hidden = val !== 'pickup';
  }
  methodRadios.forEach((r) => r.addEventListener('change', updatePanels));

  function clearError(errorEl, fieldset) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    fieldset.removeAttribute('aria-invalid');
    fieldset.removeAttribute('aria-describedby');
  }
  function showError(errorEl, fieldset, message, focusEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    fieldset.setAttribute('aria-invalid', 'true');
    fieldset.setAttribute('aria-describedby', errorEl.id);
    if (focusEl) focusEl.focus();
  }

  function goToStep(n) {
    sections.forEach((s) => {
      s.hidden = Number(s.dataset.step) !== n;
    });
    indicators.forEach((li) => {
      if (Number(li.dataset.stepIndicator) === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    step = n;
    const section = sections.find((s) => Number(s.dataset.step) === n);
    const heading = section ? section.querySelector('h2') : null;
    if (heading) heading.focus();
  }

  document.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (step === 1) {
        if (!nameInput.value.trim()) {
          showError(contactError, contactFieldset, t('error_name'), nameInput);
          return;
        }
        if (!isValidPhone(phoneInput.value)) {
          showError(contactError, contactFieldset, t('error_phone'), phoneInput);
          return;
        }
        clearError(contactError, contactFieldset);

        const checked = document.querySelector('input[name="method"]:checked');
        if (!checked) {
          showError(methodError, methodFieldset, t('error_method'), methodRadios[0]);
          return;
        }
        method = checked.value;
        clearError(methodError, methodFieldset);

        if (method === 'delivery') {
          if (!areaInput.value.trim() || !streetInput.value.trim()) {
            showError(addressError, deliveryFieldset, t('error_address'), areaInput);
            return;
          }
          clearError(addressError, deliveryFieldset);
        } else {
          const branchChecked = document.querySelector('input[name="branch"]:checked');
          if (!branchChecked) {
            showError(branchError, pickupFieldset, t('error_area'), branchRadios[0]);
            return;
          }
          branchIndex = Number(branchChecked.value);
          clearError(branchError, pickupFieldset);
        }

        if (slotLegend) slotLegend.textContent = method === 'delivery' ? t('step_time') : t('step_time_pickup');
        goToStep(2);
      } else if (step === 2) {
        const slotChecked = document.querySelector('input[name="slot"]:checked');
        if (!slotChecked) {
          showError(slotError, slotFieldset, t('error_time'), slotRadios[0]);
          return;
        }
        slotIndex = Number(slotChecked.value);
        clearError(slotError, slotFieldset);

        const paymentChecked = document.querySelector('input[name="payment"]:checked');
        if (!paymentChecked) {
          showError(paymentError, paymentFieldset, t('error_payment'), paymentRadios[0]);
          return;
        }
        paymentIndex = Number(paymentChecked.value);
        clearError(paymentError, paymentFieldset);

        renderSummary();
        goToStep(3);
      }
    });
  });

  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (step > 1) goToStep(step - 1);
    });
  });
  document.querySelector('[data-edit-details]')?.addEventListener('click', () => goToStep(1));

  // Demo "order": show the confirmation, then wipe everything the user entered and the cart.
  document.querySelector('[data-confirm]')?.addEventListener('click', () => {
    const { total, hasRange } = cartTotal(items, catalog);
    const order = {
      orderNo: demoOrderNumber(lang),
      count: countItems(items),
      total: formatPrice(total, null, lang, currency, hasRange ? t('from') : undefined),
      method,
      branch: method === 'pickup' ? strings.branches[branchIndex] : null,
      slot: strings.slots[slotIndex],
    };
    const confirmedDetails = document.querySelector('[data-confirmed-details]');
    confirmedDetails.textContent = '';
    for (const [label, value] of confirmationRows(order, t, lang)) {
      const dt = document.createElement('dt');
      dt.className = 'font-semibold';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      confirmedDetails.append(dt, dd);
    }

    [nameInput, phoneInput, areaInput, streetInput, buildingInput, landmarkInput].forEach((el) => {
      if (el) el.value = '';
    });
    document.querySelectorAll('main input[type="radio"]').forEach((r) => {
      r.checked = false;
    });
    method = branchIndex = slotIndex = paymentIndex = null;
    ['[data-summary-lines]', '[data-summary-details]', '[data-summary-total]'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = '';
    });
    updatePanels();
    clearCart();
    sections.forEach((sec) => {
      sec.hidden = true;
    });
    if (stepsOl) stepsOl.hidden = true;
    const confirmed = document.querySelector('[data-confirmed]');
    confirmed.hidden = false;
    // Instant jump (no smooth scroll), then focus without letting the browser scroll again.
    window.scrollTo(0, 0);
    confirmed.querySelector('h2').focus({ preventScroll: true });
  });

  function renderSummary() {
    const linesEl = document.querySelector('[data-summary-lines]');
    const totalEl = document.querySelector('[data-summary-total]');
    const feeEl = document.querySelector('[data-summary-fee]');
    if (linesEl) linesEl.textContent = '';
    for (const item of items) {
      const p = catalog[item.slug];
      const li = document.createElement('li');
      li.className = 'py-2 flex justify-between gap-3';
      const name = document.createElement('span');
      name.textContent = `${p.name} × ${formatNum(item.qty, lang)}`;
      const lineTotal = document.createElement('span');
      lineTotal.className = 'whitespace-nowrap';
      const amount = roundMoney(p.price * item.qty);
      const amountTo = null;
      lineTotal.textContent = formatPrice(amount, amountTo, lang, currency, p.price_to != null ? t('from') : undefined);
      li.append(name, lineTotal);
      if (linesEl) linesEl.appendChild(li);
    }
    const { total, hasRange } = cartTotal(items, catalog);
    if (totalEl) totalEl.textContent = `${t('total')}: ${formatPrice(total, null, lang, currency, hasRange ? t('from') : undefined)}`;
    const detailsEl = document.querySelector('[data-summary-details]');
    detailsEl.textContent = '';
    const entry = {
      name: nameInput.value,
      phone: phoneInput.value,
      method,
      address: { area: areaInput.value, street: streetInput.value, building: buildingInput.value, landmark: landmarkInput.value },
      branchIndex,
      slotIndex,
      paymentIndex,
    };
    // textContent only: what the user typed is shown back as text, never parsed as HTML.
    for (const [label, value] of summaryRows(entry, t, strings, lang)) {
      const dt = document.createElement('dt');
      dt.className = 'font-semibold';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      detailsEl.append(dt, dd);
    }
    if (feeEl) {
      feeEl.textContent = t('delivery_fee');
      feeEl.hidden = method !== 'delivery';
    }
  }
}
