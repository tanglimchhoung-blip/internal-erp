// ===============================
// Internal ERP - app.js (Plain JS)
// ===============================

// 1) PASTE YOUR SUPABASE SETTINGS HERE
// Supabase UI: Project Settings -> API
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";

// Create client (supabase-js is loaded via CDN in index.html)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function to2(n) {
  const x = Number(n);
  if (!isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function num(n) {
  const x = Number(n);
  return isFinite(x) ? x : 0;
}

function showMsg(el, text, type) {
  el.classList.remove("hidden", "success", "error");
  el.classList.add(type);
  el.textContent = text;
}

function hideMsg(el) {
  el.classList.add("hidden");
  el.textContent = "";
  el.classList.remove("success", "error");
}

function setSelectOptions(selectEl, rows, placeholder) {
  selectEl.innerHTML = "";
  if (placeholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  rows.forEach(r => {
    const opt = document.createElement("option");
    opt.value = String(r.id);
    opt.textContent = r.name;
    selectEl.appendChild(opt);
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

// ---------- Global cached lists ----------
let LISTS = {
  locations: [],
  categories: [],
  sizes: [],
  colors: [],
  delivery: [],
  expcats: []
};

function listNameById(list, id) {
  const row = list.find(x => String(x.id) === String(id));
  return row ? row.name : "";
}

// ---------- Tabs ----------
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
      btn.classList.add("active");
      $(btn.dataset.tab).classList.remove("hidden");
    });
  });
}

// ---------- Auth ----------
async function refreshAuthUI() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) {
    $("authSection").classList.remove("hidden");
    $("appSection").classList.add("hidden");
    $("btnSignOut").classList.add("hidden");
    $("userBadge").classList.add("hidden");
    return;
  }

  $("authSection").classList.add("hidden");
  $("appSection").classList.remove("hidden");
  $("btnSignOut").classList.remove("hidden");
  $("userBadge").classList.remove("hidden");
  $("userBadge").textContent = session.user.email || "Logged in";

  // Once logged in, load lists + initial data
  await loadAllLists();
  await loadRecentInventory();
  await loadRecentOrders();
  await loadRecentExpenses();
  setDefaultDates();
}

async function signIn() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  const msg = $("authMsg");
  hideMsg(msg);

  if (!email || !password) {
    showMsg(msg, "Please enter email + password.", "error");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showMsg(msg, `Login failed: ${error.message}`, "error");
    return;
  }

  showMsg(msg, "Login success.", "success");
  await refreshAuthUI();
}

async function signUp() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  const msg = $("authMsg");
  hideMsg(msg);

  if (!email || !password) {
    showMsg(msg, "Please enter email + password.", "error");
    return;
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showMsg(msg, `Sign up failed: ${error.message}`, "error");
    return;
  }

  showMsg(msg, "Sign up created. If email confirmation is enabled, confirm your email first.", "success");
}

async function signOut() {
  await supabase.auth.signOut();
  await refreshAuthUI();
}

// ---------- Load dropdown lists ----------
async function loadAllLists() {
  // We load only active rows
  const [loc, cat, siz, col, del, exp] = await Promise.all([
    supabase.from("locations").select("id,name").eq("is_active", true).order("name"),
    supabase.from("product_categories").select("id,name").eq("is_active", true).order("name"),
    supabase.from("product_sizes").select("id,name").eq("is_active", true).order("name"),
    supabase.from("product_colors").select("id,name").eq("is_active", true).order("name"),
    supabase.from("delivery_companies").select("id,name").eq("is_active", true).order("name"),
    supabase.from("expense_categories").select("id,name").eq("is_active", true).order("name"),
  ]);

  const anyErr = [loc, cat, siz, col, del, exp].find(r => r.error);
  if (anyErr) {
    console.error(anyErr.error);
    // We show a friendly message in dashboard area
    showMsg($("dashMsg"), "Failed to load dropdown lists. Check RLS + login.", "error");
    return;
  }

  LISTS.locations = loc.data || [];
  LISTS.categories = cat.data || [];
  LISTS.sizes = siz.data || [];
  LISTS.colors = col.data || [];
  LISTS.delivery = del.data || [];
  LISTS.expcats = exp.data || [];

  // Inventory selects
  setSelectOptions($("invLocation"), LISTS.locations, "Select...");
  setSelectOptions($("invCategory"), LISTS.categories, "Select...");
  setSelectOptions($("invColor"), LISTS.colors, "Select...");
  setSelectOptions($("invSize"), LISTS.sizes, "Select...");

  // Sales header selects
  setSelectOptions($("soLocation"), LISTS.locations, "Select...");
  setSelectOptions($("soDelivery"), LISTS.delivery, "Select...");

  // Expenses selects
  setSelectOptions($("expLocation"), LISTS.locations, "Select...");
  setSelectOptions($("expCategory"), LISTS.expcats, "Select...");

  // If you want default first options auto-selected
  if (LISTS.locations[0]) {
    $("invLocation").value = String(LISTS.locations[0].id);
    $("soLocation").value = String(LISTS.locations[0].id);
    $("expLocation").value = String(LISTS.locations[0].id);
  }
  if (LISTS.categories[0]) $("invCategory").value = String(LISTS.categories[0].id);
}

// ---------- Inventory IN ----------
function recalcInventory() {
  const qty = num($("invQty").value);
  const rmb = num($("invUnitRmb").value);
  const fx = num($("invFx").value);

  let unitUsd = 0;
  if (fx > 0) unitUsd = rmb / fx;

  const amount = qty * unitUsd;

  $("invUnitUsd").value = to2(unitUsd);
  $("invAmountUsd").value = to2(amount);
}

function clearInventoryForm() {
  $("invDate").value = todayISO();
  $("invProductName").value = "";
  $("invQty").value = "";
  $("invUnitRmb").value = "";
  $("invFx").value = "";
  $("invUnitUsd").value = "0.00";
  $("invAmountUsd").value = "0.00";
  $("invNote").value = "";
  hideMsg($("invMsg"));
}

async function saveInventory() {
  const msg = $("invMsg");
  hideMsg(msg);

  const date = $("invDate").value;
  const location_id = $("invLocation").value;
  const product_category_id = $("invCategory").value;
  const product_name = $("invProductName").value.trim();
  const color_id = $("invColor").value || null;
  const size_id = $("invSize").value || null;

  const qty = num($("invQty").value);
  const unit_price_rmb = num($("invUnitRmb").value);
  const fx_rmb_usd = num($("invFx").value);

  const unit_price_usd = num($("invUnitUsd").value);
  const amount_usd = num($("invAmountUsd").value);

  const note = $("invNote").value.trim() || null;

  if (!date || !location_id || !product_category_id || !product_name || qty <= 0) {
    showMsg(msg, "Please fill: date, location, category, product name, qty (>0).", "error");
    return;
  }

  const payload = {
    date,
    location_id,
    product_category_id,
    product_name,
    color_id,
    size_id,
    qty,
    unit_price_rmb,
    fx_rmb_usd,
    unit_price_usd,
    amount_usd,
    note
  };

  const { error } = await supabase.from("inventory_in").insert(payload);
  if (error) {
    showMsg(msg, `Save failed: ${error.message}`, "error");
    return;
  }

  showMsg(msg, "Saved Inventory IN successfully.", "success");
  clearInventoryForm();
  await loadRecentInventory();
}

async function loadRecentInventory() {
  const { data, error } = await supabase
    .from("inventory_in")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(25);

  if (error) {
    showMsg($("invMsg"), `Load recent inventory failed: ${error.message}`, "error");
    return;
  }

  const tbody = $("invTable").querySelector("tbody");
  tbody.innerHTML = "";

  (data || []).forEach(r => {
    const tr = document.createElement("tr");

    const location = listNameById(LISTS.locations, r.location_id);
    const category = listNameById(LISTS.categories, r.product_category_id);
    const color = r.color_id ? listNameById(LISTS.colors, r.color_id) : "";
    const size = r.size_id ? listNameById(LISTS.sizes, r.size_id) : "";

    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${location}</td>
      <td>${category}</td>
      <td>${r.product_name}</td>
      <td>${color}</td>
      <td>${size}</td>
      <td class="num">${to2(r.qty)}</td>
      <td class="num">${to2(r.unit_price_usd)}</td>
      <td class="num">${to2(r.amount_usd)}</td>
      <td>${r.note ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- Sales Order ----------
let currentItems = [];

function addEmptyItem() {
  currentItems.push({
    product_category_id: LISTS.categories[0] ? String(LISTS.categories[0].id) : "",
    product_name: "",
    color_id: "",
    size_id: "",
    qty: "",
    unit_price: ""
  });
  renderItemsTable();
}

function removeItem(idx) {
  currentItems.splice(idx, 1);
  renderItemsTable();
}

function calcOrderTotal() {
  let total = 0;
  currentItems.forEach(it => {
    const q = num(it.qty);
    const u = num(it.unit_price);
    total += q * u;
  });
  $("soTotal").textContent = to2(total);
  return total;
}

function renderItemsTable() {
  const tbody = $("itemsTable").querySelector("tbody");
  tbody.innerHTML = "";

  currentItems.forEach((it, idx) => {
    const tr = document.createElement("tr");

    const catOptions = LISTS.categories.map(c => `<option value="${c.id}" ${String(it.product_category_id)===String(c.id)?"selected":""}>${c.name}</option>`).join("");
    const colorOptions = `<option value="">—</option>` + LISTS.colors.map(c => `<option value="${c.id}" ${String(it.color_id)===String(c.id)?"selected":""}>${c.name}</option>`).join("");
    const sizeOptions  = `<option value="">—</option>` + LISTS.sizes.map(s => `<option value="${s.id}" ${String(it.size_id)===String(s.id)?"selected":""}>${s.name}</option>`).join("");

    const lineTotal = num(it.qty) * num(it.unit_price);

    tr.innerHTML = `
      <td>
        <select data-idx="${idx}" data-field="product_category_id">${catOptions}</select>
      </td>
      <td>
        <input data-idx="${idx}" data-field="product_name" type="text" value="${it.product_name ?? ""}" />
      </td>
      <td>
        <select data-idx="${idx}" data-field="color_id">${colorOptions}</select>
      </td>
      <td>
        <select data-idx="${idx}" data-field="size_id">${sizeOptions}</select>
      </td>
      <td class="num">
        <input data-idx="${idx}" data-field="qty" type="number" step="0.01" min="0" value="${it.qty ?? ""}" />
      </td>
      <td class="num">
        <input data-idx="${idx}" data-field="unit_price" type="number" step="0.01" min="0" value="${it.unit_price ?? ""}" />
      </td>
      <td class="num">${to2(lineTotal)}</td>
      <td class="num">
        <button class="btn secondary" data-action="remove" data-idx="${idx}">Remove</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Change handlers
  tbody.querySelectorAll("input,select").forEach(el => {
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.idx);
      const field = el.dataset.field;
      currentItems[idx][field] = el.value;
      calcOrderTotal();
      renderItemsTable(); // keep line totals updated
    });
  });

  // Remove buttons
  tbody.querySelectorAll("button[data-action='remove']").forEach(btn => {
    btn.addEventListener("click", () => removeItem(Number(btn.dataset.idx)));
  });

  calcOrderTotal();
}

function clearOrderForm() {
  $("soDate").value = todayISO();
  $("soCustomer").value = "";
  $("soPhone").value = "";
  $("soAddress").value = "";
  $("soPaid").value = "";
  $("soNote").value = "";
  $("soCurrency").value = "USD";
  $("soTiming").value = "BEFORE";
  hideMsg($("salesMsg"));

  currentItems = [];
  addEmptyItem();
  addEmptyItem(); // default 2 lines
}

async function saveOrder() {
  const msg = $("salesMsg");
  hideMsg(msg);

  const order_date = $("soDate").value;
  const location_id = $("soLocation").value;
  const customer_name = $("soCustomer").value.trim();
  const phone = $("soPhone").value.trim() || null;
  const address = $("soAddress").value.trim() || null;
  const delivery_company_id = $("soDelivery").value || null;
  const currency = $("soCurrency").value;
  const paid_amount = num($("soPaid").value);
  const cash_timing = $("soTiming").value;
  const note = $("soNote").value.trim() || null;

  if (!order_date || !location_id || !customer_name) {
    showMsg(msg, "Please fill: order date, location, customer name.", "error");
    return;
  }

  // Validate items
  const cleanedItems = currentItems
    .map(it => ({
      product_category_id: it.product_category_id,
      product_name: (it.product_name || "").trim(),
      color_id: it.color_id || null,
      size_id: it.size_id || null,
      qty: num(it.qty),
      unit_price: num(it.unit_price),
      line_total: num(it.qty) * num(it.unit_price)
    }))
    .filter(it => it.product_name && it.product_category_id && it.qty > 0);

  if (cleanedItems.length === 0) {
    showMsg(msg, "Please add at least 1 valid item (category + product + qty>0).", "error");
    return;
  }

  const order_total = cleanedItems.reduce((a, b) => a + b.line_total, 0);

  // 1) Insert sales_orders
  const { data: orderRow, error: orderErr } = await supabase
    .from("sales_orders")
    .insert({
      order_date,
      location_id,
      customer_name,
      phone,
      address,
      delivery_company_id,
      currency,
      paid_amount,
      cash_timing,
      note,
      order_total
    })
    .select("id")
    .single();

  if (orderErr) {
    showMsg(msg, `Save order failed: ${orderErr.message}`, "error");
    return;
  }

  // 2) Insert sales_items
  const order_id = orderRow.id;
  const itemsPayload = cleanedItems.map(it => ({ ...it, order_id }));

  const { error: itemsErr } = await supabase.from("sales_items").insert(itemsPayload);
  if (itemsErr) {
    showMsg(msg, `Order saved but items failed: ${itemsErr.message}`, "error");
    return;
  }

  showMsg(msg, `Saved Sales Order #${order_id} successfully.`, "success");
  clearOrderForm();
  await loadRecentOrders();
}

async function loadRecentOrders() {
  // Load orders
  const { data: orders, error: oErr } = await supabase
    .from("sales_orders")
    .select("*")
    .order("order_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(25);

  if (oErr) {
    showMsg($("salesMsg"), `Load orders failed: ${oErr.message}`, "error");
    return;
  }

  const tbody = $("ordersTable").querySelector("tbody");
  tbody.innerHTML = "";

  (orders || []).forEach(o => {
    const tr = document.createElement("tr");
    const location = listNameById(LISTS.locations, o.location_id);

    const statusOptions = ["NEW","PREPARED","DELIVERING","COMPLETED","CANCELLED"]
      .map(s => `<option value="${s}" ${o.status===s?"selected":""}>${s}</option>`).join("");

    tr.innerHTML = `
      <td>${o.order_date}</td>
      <td>${o.customer_name}</td>
      <td>${location}</td>
      <td>${o.currency}</td>
      <td class="num">${to2(o.order_total)}</td>
      <td class="num">
        <input class="inlineInput" data-order="${o.id}" data-field="paid_amount" type="number" step="0.01" min="0" value="${to2(o.paid_amount)}" />
      </td>
      <td>${o.payment_status}</td>
      <td>
        <select class="inlineSelect" data-order="${o.id}" data-field="status">${statusOptions}</select>
      </td>
      <td>
        <button class="btn" data-action="print" data-order="${o.id}">Print</button>
        <button class="btn secondary" data-action="saveRow" data-order="${o.id}">Update</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach update handlers
  tbody.querySelectorAll("button[data-action='saveRow']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.order;
      const paidEl = tbody.querySelector(`input[data-order="${orderId}"][data-field="paid_amount"]`);
      const statusEl = tbody.querySelector(`select[data-order="${orderId}"][data-field="status"]`);
      await updateOrder(orderId, num(paidEl.value), statusEl.value);
    });
  });

  // Print handlers
  tbody.querySelectorAll("button[data-action='print']").forEach(btn => {
    btn.addEventListener("click", async () => {
      await printPackingSlip(btn.dataset.order);
    });
  });
}

async function updateOrder(orderId, paid_amount, status) {
  const msg = $("salesMsg");
  hideMsg(msg);

  const { error } = await supabase
    .from("sales_orders")
    .update({ paid_amount, status })
    .eq("id", orderId);

  if (error) {
    showMsg(msg, `Update failed: ${error.message}`, "error");
    return;
  }

  showMsg(msg, `Order #${orderId} updated.`, "success");
  await loadRecentOrders();
}

async function printPackingSlip(orderId) {
  const msg = $("salesMsg");
  hideMsg(msg);

  const { data: order, error: oErr } = await supabase
    .from("sales_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (oErr) {
    showMsg(msg, `Print failed (order): ${oErr.message}`, "error");
    return;
  }

  const { data: items, error: iErr } = await supabase
    .from("sales_items")
    .select("*")
    .eq("order_id", orderId)
    .order("id", { ascending: true });

  if (iErr) {
    showMsg(msg, `Print failed (items): ${iErr.message}`, "error");
    return;
  }

  const location = listNameById(LISTS.locations, order.location_id);
  const delivery = order.delivery_company_id ? listNameById(LISTS.delivery, order.delivery_company_id) : "";
  const currency = order.currency;

  const rowsHtml = (items || []).map(it => {
    const cat = listNameById(LISTS.categories, it.product_category_id);
    const color = it.color_id ? listNameById(LISTS.colors, it.color_id) : "";
    const size = it.size_id ? listNameById(LISTS.sizes, it.size_id) : "";
    return `
      <tr>
        <td>${cat}</td>
        <td>${it.product_name}</td>
        <td>${color}</td>
        <td>${size}</td>
        <td style="text-align:right">${to2(it.qty)}</td>
        <td style="text-align:right">${to2(it.unit_price)}</td>
        <td style="text-align:right">${to2(it.line_total)}</td>
      </tr>
    `;
  }).join("");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Packing Slip #${orderId}</title>
  <style>
    body{font-family:Arial; padding:24px; color:#111}
    h1{margin:0 0 12px 0}
    .meta{margin-bottom:14px; font-size:13px}
    .meta div{margin:4px 0}
    table{width:100%; border-collapse:collapse; margin-top:10px}
    th,td{border:1px solid #ddd; padding:8px; font-size:13px}
    th{background:#f5f5f5; text-align:left}
    .right{text-align:right}
    .box{border:1px solid #ddd; padding:10px; border-radius:10px; margin-top:12px}
  </style>
</head>
<body>
  <h1>Packing Slip / Delivery Label</h1>
  <div class="meta">
    <div><strong>Order #:</strong> ${orderId}</div>
    <div><strong>Date:</strong> ${order.order_date}</div>
    <div><strong>Status:</strong> ${order.status} &nbsp;&nbsp; <strong>Payment:</strong> ${order.payment_status} (Paid: ${currency} ${to2(order.paid_amount)})</div>
    <div><strong>Location:</strong> ${location}</div>
    <div><strong>Delivery:</strong> ${delivery}</div>
  </div>

  <div class="box">
    <div><strong>Customer:</strong> ${order.customer_name}</div>
    <div><strong>Phone:</strong> ${order.phone ?? ""}</div>
    <div><strong>Address:</strong> ${order.address ?? ""}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Category</th><th>Product</th><th>Color</th><th>Size</th>
        <th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" class="right"><strong>Order Total</strong></td>
        <td class="right"><strong>${currency} ${to2(order.order_total)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="meta" style="margin-top:14px">
    <div><strong>Cash Timing:</strong> ${order.cash_timing}</div>
    <div><strong>Note:</strong> ${order.note ?? ""}</div>
  </div>

  <script>
    window.print();
  </script>
</body>
</html>
  `;

  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Expenses ----------
function clearExpenseForm() {
  $("expDate").value = todayISO();
  $("expCurrency").value = "USD";
  $("expAmount").value = "";
  $("expNote").value = "";
  hideMsg($("expMsg"));
}

async function saveExpense() {
  const msg = $("expMsg");
  hideMsg(msg);

  const date = $("expDate").value;
  const location_id = $("expLocation").value;
  const expense_category_id = $("expCategory").value;
  const currency = $("expCurrency").value;
  const amount = num($("expAmount").value);
  const note = $("expNote").value.trim() || null;

  if (!date || !location_id || !expense_category_id || amount <= 0) {
    showMsg(msg, "Please fill: date, location, category, amount (>0).", "error");
    return;
  }

  const { error } = await supabase.from("expenses").insert({
    date, location_id, expense_category_id, currency, amount, note
  });

  if (error) {
    showMsg(msg, `Save expense failed: ${error.message}`, "error");
    return;
  }

  showMsg(msg, "Saved expense successfully.", "success");
  clearExpenseForm();
  await loadRecentExpenses();
}

async function loadRecentExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(25);

  if (error) {
    showMsg($("expMsg"), `Load expenses failed: ${error.message}`, "error");
    return;
  }

  const tbody = $("expTable").querySelector("tbody");
  tbody.innerHTML = "";

  (data || []).forEach(r => {
    const tr = document.createElement("tr");
    const location = listNameById(LISTS.locations, r.location_id);
    const cat = listNameById(LISTS.expcats, r.expense_category_id);
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${location}</td>
      <td>${cat}</td>
      <td>${r.currency}</td>
      <td class="num">${to2(r.amount)}</td>
      <td>${r.note ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- Dashboard / Reports ----------
function setDefaultDates() {
  const t = todayISO();
  $("invDate").value = t;
  $("soDate").value = t;
  $("expDate").value = t;

  // default range: this month (simple)
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const yyyy = from.getFullYear();
  const mm = String(from.getMonth() + 1).padStart(2, "0");
  const dd = String(from.getDate()).padStart(2, "0");
  $("dashFrom").value = `${yyyy}-${mm}-${dd}`;
  $("dashTo").value = t;
}

async function loadDashboard() {
  const msg = $("dashMsg");
  hideMsg(msg);

  const date_from = $("dashFrom").value;
  const date_to = $("dashTo").value;

  if (!date_from || !date_to) {
    showMsg(msg, "Please select date range (from / to).", "error");
    return;
  }

  // 1) Summary via RPC
  const { data: summary, error: sErr } = await supabase
    .rpc("get_dashboard_summary", { date_from, date_to });

  if (sErr) {
    showMsg(msg, `Dashboard summary failed: ${sErr.message}`, "error");
    return;
  }

  $("kpiInv").textContent = to2(summary.total_inventory_in_usd);
  $("kpiSales").textContent = `USD ${to2(summary.sales_usd)} • KHR ${to2(summary.sales_khr)} • RMB ${to2(summary.sales_rmb)}`;
  $("kpiExp").textContent = `USD ${to2(summary.expenses_usd)} • KHR ${to2(summary.expenses_khr)} • RMB ${to2(summary.expenses_rmb)}`;

  // 2) Remaining inventory via RPC (uses date_to)
  const { data: remain, error: rErr } = await supabase
    .rpc("get_remaining_inventory", { date_to });

  if (rErr) {
    showMsg(msg, `Remaining inventory failed: ${rErr.message}`, "error");
    return;
  }

  const tbody = $("remainTable").querySelector("tbody");
  tbody.innerHTML = "";

  (remain || []).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.location}</td>
      <td>${r.product_category}</td>
      <td>${r.product_name}</td>
      <td>${r.color}</td>
      <td>${r.size}</td>
      <td class="num">${to2(r.total_in)}</td>
      <td class="num">${to2(r.total_sold)}</td>
      <td class="num"><strong>${to2(r.remaining_qty)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  showMsg(msg, "Dashboard loaded.", "success");
}

async function exportRemainingCsv() {
  const msg = $("dashMsg");
  hideMsg(msg);

  const date_to = $("dashTo").value;
  if (!date_to) {
    showMsg(msg, "Please set Date To first.", "error");
    return;
  }

  const { data: remain, error } = await supabase
    .rpc("get_remaining_inventory", { date_to });

  if (error) {
    showMsg(msg, `Export failed: ${error.message}`, "error");
    return;
  }

  const headers = ["location","product_category","product_name","color","size","total_in","total_sold","remaining_qty"];
  const lines = [headers.join(",")];

  (remain || []).forEach(r => {
    const row = [
      csvEscape(r.location),
      csvEscape(r.product_category),
      csvEscape(r.product_name),
      csvEscape(r.color),
      csvEscape(r.size),
      to2(r.total_in),
      to2(r.total_sold),
      to2(r.remaining_qty),
    ];
    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `remaining_inventory_as_of_${date_to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  showMsg(msg, "CSV exported.", "success");
}

// ---------- Init ----------
function bindEvents() {
  // Auth
  $("btnSignIn").addEventListener("click", signIn);
  $("btnSignUp").addEventListener("click", signUp);
  $("btnSignOut").addEventListener("click", signOut);

  // Inventory calc
  ["invQty","invUnitRmb","invFx"].forEach(id => {
    $(id).addEventListener("input", recalcInventory);
  });
  $("btnSaveInventory").addEventListener("click", saveInventory);
  $("btnClearInventory").addEventListener("click", clearInventoryForm);

  // Sales
  $("btnAddItem").addEventListener("click", addEmptyItem);
  $("btnSaveOrder").addEventListener("click", saveOrder);
  $("btnClearOrder").addEventListener("click", clearOrderForm);

  // Expenses
  $("btnSaveExpense").addEventListener("click", saveExpense);
  $("btnClearExpense").addEventListener("click", clearExpenseForm);

  // Dashboard
  $("btnLoadDash").addEventListener("click", loadDashboard);
  $("btnExportCsv").addEventListener("click", exportRemainingCsv);
}

async function main() {
  setupTabs();
  bindEvents();

  // defaults for forms (before login is okay)
  $("invDate").value = todayISO();
  $("soDate").value = todayISO();
  $("expDate").value = todayISO();
  $("invUnitUsd").value = "0.00";
  $("invAmountUsd").value = "0.00";

  // Sales default items
  currentItems = [];
  addEmptyItem();
  addEmptyItem();

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async () => {
    await refreshAuthUI();
  });

  await refreshAuthUI();
}

main();
