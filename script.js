// ====== KONFIGURASI ======
const KEY = "lib_v2", SES = "lib_user", PER_PAGE = 6, MAX_PINJAM = 3, LAMA = 7, DENDA = 1000;

// Akun contoh untuk latihan login dan role
const USERS = {
  admin:  { pw: "admin123",  role: "admin" },
  ridwan: { pw: "ridwan123", role: "anggota" },
  sinta:  { pw: "sinta123",  role: "anggota" }
};

// [judul, penulis, kategori, tahun, stok, deskripsi] (tahun dan deskripsi hanya data contoh)
const SEED = [
  ["Laskar Pelangi", "Andrea Hirata", "Novel", 2005, 3, "Kisah anak-anak Belitung berjuang untuk bersekolah."],
  ["Bumi Manusia", "Pramoedya Ananta Toer", "Novel", 1980, 1, "Minke dan pergulatannya di masa kolonial."],
  ["Filosofi Teras", "Henry Manampiring", "Self-help", 2018, 0, "Filsafat Stoa untuk menghadapi hidup modern."],
  ["Atomic Habits", "James Clear", "Self-help", 2018, 2, "Cara membangun kebiasaan lewat perubahan kecil."],
  ["Clean Code", "Robert C. Martin", "Teknologi", 2008, 1, "Panduan menulis kode yang rapi dan mudah dirawat."],
  ["Belajar Laravel untuk Pemula", "Budi Santoso", "Teknologi", 2022, 4, "Pengantar framework Laravel dari nol."],
  ["Software Testing Dasar", "Rina Wulandari", "Teknologi", 2023, 2, "Dasar-dasar pengujian perangkat lunak."],
  ["Sapiens", "Yuval Noah Harari", "Sejarah", 2011, 0, "Sejarah singkat umat manusia."],
  ["Sejarah Indonesia Modern", "M.C. Ricklefs", "Sejarah", 1981, 2, "Sejarah Indonesia sejak abad ke-13."],
  ["Cantik Itu Luka", "Eka Kurniawan", "Novel", 2002, 1, "Novel tentang Dewi Ayu dan keturunannya."],
  ["Dunia Sophie", "Jostein Gaarder", "Filsafat", 1991, 2, "Pengantar sejarah filsafat lewat cerita novel."],
  ["Madilog", "Tan Malaka", "Filsafat", 1943, 1, "Materialisme, dialektika, dan logika."]
];

// ====== STATE ======
// db.loans = riwayat pinjam, db.queue = antrean buku yang stoknya habis
const fresh = () => ({
  books: SEED.map(([title, author, category, tahun, stock, desc], i) => ({ id: i + 1, title, author, category, tahun, stock, desc })),
  loans: [], queue: [], nid: 100
});
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.books) return s; } catch (e) {}
  return fresh();
}
const save = () => localStorage.setItem(KEY, JSON.stringify(db));

let db = load(), me = sessionStorage.getItem(SES), sim = "", page = 1, showHist = false;
if (!USERS[me]) me = null;

// ====== HELPER ======
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => sim || new Date().toLocaleDateString("sv-SE");   // format YYYY-MM-DD
const day = s => new Date(s + "T00:00:00Z");
const addDays = (s, n) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lateDays = l => Math.max(0, Math.round((day(l.returned || today()) - day(l.due)) / 864e5));
const rp = n => "Rp" + n.toLocaleString("id-ID");
const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360;
const isAdmin = () => !!me && USERS[me].role === "admin";
const myLoans = () => db.loans.filter(l => l.user === me && !l.returned);
const loanOf = id => myLoans().find(l => l.bookId === id);
const queueOf = id => db.queue.filter(q => q.bookId === id);
const findBook = id => db.books.find(b => b.id === id);
const NOT_ADMIN = "Hanya admin yang boleh melakukan ini.";

let tt;
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function status(b) {
  if (loanOf(b.id)) return ["dipinjam", "Sedang kamu pinjam"];
  return b.stock > 0 ? ["tersedia", "Tersedia"] : ["habis", "Stok habis"];
}

// ====== FILTER + URUTKAN ======
function filtered() {
  const k = $("search-input").value.trim().toLowerCase(), c = $("category-filter").value, s = $("status-filter").value;
  const r = db.books.filter(b =>
    (b.title.toLowerCase().includes(k) || b.author.toLowerCase().includes(k)) &&
    (c === "semua" || b.category === c) &&
    (s === "semua" || status(b)[0] === s));
  const o = $("sort-select").value;
  if (o === "az") r.sort((a, b) => a.title.localeCompare(b.title, "id"));
  if (o === "za") r.sort((a, b) => b.title.localeCompare(a.title, "id"));
  if (o === "stok") r.sort((a, b) => b.stock - a.stock);
  return r;
}

function fillCats() {
  const sel = $("category-filter"), cur = sel.value;
  const cats = [...new Set(db.books.map(b => b.category))].sort();
  sel.innerHTML = '<option value="semua">Semua kategori</option>' + cats.map(c => `<option>${esc(c)}</option>`).join("");
  sel.value = cats.includes(cur) ? cur : "semua";
  $("cat-list").innerHTML = cats.map(c => `<option value="${esc(c)}">`).join("");
}

// ====== RENDER ======
function card(b) {
  const [k, label] = status(b), loan = loanOf(b.id), q = queueOf(b.id), i = q.findIndex(x => x.user === me);
  let info = "", btn = "";
  if (loan) {
    const l = lateDays(loan);
    info = `Jatuh tempo ${loan.due}` + (l ? ` · <b class="late">Terlambat ${l} hari, denda ${rp(l * DENDA)}</b>` : "");
  } else if (k === "habis" && q.length) {
    info = `Antrean: ${q.length}` + (i >= 0 ? ` (kamu ke-${i + 1})` : "");
  }
  if (isAdmin()) {
    btn = `<button class="btn" data-act="edit" data-id="${b.id}">Edit</button><button class="btn danger" data-act="del" data-id="${b.id}">Hapus</button>`;
  } else if (loan) {
    btn = `<button class="btn" data-act="return" data-id="${b.id}">Kembalikan</button>`;
  } else if (b.stock > 0) {
    const blocked = q.length && q[0].user !== me;   // stok dicadangkan untuk antrean pertama
    btn = `<button class="btn" data-act="borrow" data-id="${b.id}" ${blocked ? "disabled" : ""}>${blocked ? "Dicadangkan" : "Pinjam"}</button>`;
  } else {
    btn = `<button class="btn" data-act="queue" data-id="${b.id}">${i >= 0 ? "Batal antre" : "Antre"}</button>`;
  }
  return `<article class="book" style="--spine:hsl(${hue(b.category)} 40% 32%)" data-id="${b.id}">
    <h2>${esc(b.title)}</h2><p class="author">${esc(b.author)}</p>
    <p class="meta">${esc(b.category)} · Terbit ${b.tahun} · Stok: <span class="stock">${b.stock}</span></p>
    <span class="badge ${k}">${label}</span>${info ? `<p class="meta">${info}</p>` : ""}
    <div class="actions">${btn}<button class="btn ghost" data-act="detail" data-id="${b.id}">Detail</button></div></article>`;
}

function renderHistory() {
  $("history").hidden = !showHist;
  if (!showHist) return;
  const adm = isAdmin(), rows = db.loans.filter(l => adm || l.user === me).slice().reverse();
  $("history").innerHTML = "<h2>Riwayat peminjaman</h2>" + (rows.length
    ? `<div class="scroll"><table><tr><th>Buku</th>${adm ? "<th>Peminjam</th>" : ""}<th>Pinjam</th><th>Jatuh tempo</th><th>Kembali</th><th>Denda</th></tr>` +
      rows.map(l => `<tr><td>${esc(l.title)}</td>${adm ? `<td>${esc(l.user)}</td>` : ""}<td>${l.borrowed}</td><td>${l.due}</td><td>${l.returned || "Belum"}</td><td>${rp(lateDays(l) * DENDA)}</td></tr>`).join("") +
      "</table></div>"
    : "<p>Belum ada riwayat.</p>");
}

function render() {
  $("login").hidden = !!me;
  $("app").hidden = !me;
  if (!me) return;
  $("who").textContent = `${me} (${USERS[me].role})`;
  $("loan-count").textContent = isAdmin() ? `Pinjaman aktif: ${db.loans.filter(l => !l.returned).length}` : `Pinjaman: ${myLoans().length}/${MAX_PINJAM}`;
  $("add-btn").hidden = !isAdmin();
  $("reset-btn").hidden = !isAdmin();
  $("sim-date").value = today();
  fillCats();

  const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(page, pages);
  $("book-list").innerHTML = list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(card).join("");
  $("empty-state").hidden = list.length > 0;
  $("result-info").textContent = `Menampilkan ${list.length} dari ${db.books.length} buku · halaman ${page}/${pages}`;
  const pb = (n, t, dis, cur) => `<button class="btn ghost" data-act="page" data-id="${n}" ${dis ? "disabled" : ""} ${cur ? 'aria-current="page"' : ""}>${t}</button>`;
  $("pager").innerHTML = pages > 1
    ? pb(page - 1, "Sebelumnya", page === 1) + Array.from({ length: pages }, (_, i) => pb(i + 1, i + 1, false, i + 1 === page)).join("") + pb(page + 1, "Berikutnya", page === pages)
    : "";
  renderHistory();
}

// ====== AKSI PINJAM ======
function borrow(id) {
  const b = findBook(id), q = queueOf(id);
  if (!b || isAdmin()) return;
  if (loanOf(id)) return toast("Kamu sudah meminjam buku ini.");
  if (myLoans().length >= MAX_PINJAM) return toast(`Batas pinjam ${MAX_PINJAM} buku sudah tercapai.`);
  if (b.stock <= 0) return toast("Stok buku habis.");
  if (q.length && q[0].user !== me) return toast("Buku ini dicadangkan untuk antrean.");
  if (!confirm(`Pinjam "${b.title}"?`)) return;
  b.stock--;
  db.queue = db.queue.filter(x => !(x.bookId === id && x.user === me));
  const due = addDays(today(), LAMA);
  db.loans.push({ id: db.nid++, bookId: id, title: b.title, user: me, borrowed: today(), due, returned: null });
  save(); render(); toast(`"${b.title}" dipinjam, jatuh tempo ${due}.`);
}

function giveBack(id) {
  const l = loanOf(id), b = findBook(id);
  if (!l || !confirm(`Kembalikan "${l.title}"?`)) return;
  l.returned = today();
  if (b) b.stock++;
  const d = lateDays(l) * DENDA;
  save(); render(); toast(d ? `Dikembalikan. Denda keterlambatan ${rp(d)}.` : "Buku dikembalikan.");
}

function toggleQueue(id) {
  if (isAdmin()) return;
  const i = db.queue.findIndex(q => q.bookId === id && q.user === me);
  if (i >= 0) db.queue.splice(i, 1);
  else db.queue.push({ bookId: id, user: me });
  save(); render(); toast(i >= 0 ? "Antrean dibatalkan." : "Kamu masuk antrean.");
}

// ====== ADMIN: TAMBAH / EDIT / HAPUS ======
function openForm(id) {
  if (!isAdmin()) return toast(NOT_ADMIN);
  const b = findBook(id) || { title: "", author: "", category: "", tahun: "", stock: 1, desc: "" };
  const f = (n, l, t = "text") => `<label>${l}<input name="${n}" type="${t}" value="${esc(b[n])}"></label>`;
  $("dlg").innerHTML = `<form id="bf" data-id="${id || ""}" novalidate><h2>${id ? "Edit" : "Tambah"} buku</h2>
    <div id="errs" class="errs" role="alert"></div>${f("title", "Judul")}${f("author", "Penulis")}
    <label>Kategori<input name="category" list="cat-list" value="${esc(b.category)}"></label>
    ${f("tahun", "Tahun terbit", "number")}${f("stock", "Stok", "number")}
    <label>Deskripsi<textarea name="desc" rows="3">${esc(b.desc)}</textarea></label>
    <div class="btn-row"><button class="btn">Simpan</button><button class="btn ghost" type="button" data-act="close">Batal</button></div></form>`;
  $("dlg").showModal();
}

$("dlg").addEventListener("submit", e => {
  if (e.target.id !== "bf") return;   // form "Tutup" pada detail dibiarkan menutup dialog
  e.preventDefault();
  if (!isAdmin()) return toast(NOT_ADMIN);
  const id = Number(e.target.dataset.id) || 0, f = Object.fromEntries(new FormData(e.target));
  const title = f.title.trim(), author = f.author.trim(), category = f.category.trim();
  const tahun = Number(f.tahun), stock = Number(f.stock), errs = [];
  if (!title) errs.push("Judul wajib diisi.");
  else if (title.length > 100) errs.push("Judul maksimal 100 karakter.");
  else if (db.books.some(b => b.id !== id && b.title.toLowerCase() === title.toLowerCase())) errs.push("Judul sudah ada di katalog.");
  if (!author) errs.push("Penulis wajib diisi.");
  if (!category) errs.push("Kategori wajib diisi.");
  if (!f.tahun.trim() || !Number.isInteger(tahun) || tahun < 1000 || tahun > new Date().getFullYear()) errs.push("Tahun terbit harus bilangan bulat antara 1000 dan tahun ini.");
  if (!f.stock.trim() || !Number.isInteger(stock) || stock < 0 || stock > 99) errs.push("Stok harus bilangan bulat antara 0 dan 99.");
  if (errs.length) { $("errs").innerHTML = errs.map(x => `<p>${esc(x)}</p>`).join(""); return; }
  const data = { title, author, category, tahun, stock, desc: f.desc.trim() };
  if (id) Object.assign(findBook(id), data);
  else db.books.push({ id: db.nid++, ...data });
  save(); $("dlg").close(); render(); toast(id ? "Buku diperbarui." : "Buku ditambahkan.");
});

function removeBook(id) {
  if (!isAdmin()) return toast(NOT_ADMIN);
  const b = findBook(id);
  if (!b) return;
  if (db.loans.some(l => l.bookId === id && !l.returned)) return toast("Buku sedang dipinjam, tidak bisa dihapus.");
  if (!confirm(`Hapus "${b.title}"?`)) return;
  db.books = db.books.filter(x => x.id !== id);
  db.queue = db.queue.filter(q => q.bookId !== id);
  save(); render(); toast("Buku dihapus.");
}

function openDetail(id) {
  const b = findBook(id);
  if (!b) return;
  $("dlg").innerHTML = `<h2>${esc(b.title)}</h2><p>${esc(b.author)} · ${esc(b.category)} · Terbit ${b.tahun}</p>
    <p>${esc(b.desc || "Belum ada deskripsi.")}</p><p>Stok: ${b.stock} · Antrean: ${queueOf(id).length}</p>
    <form method="dialog"><button class="btn">Tutup</button></form>`;
  $("dlg").showModal();
}

// ====== EVENT ======
function clearFilters() {
  $("search-input").value = ""; $("category-filter").value = "semua";
  $("status-filter").value = "semua"; $("sort-select").value = "default";
  page = 1; render(); toast("Filter dihapus.");
}

const ACTIONS = {
  borrow, return: giveBack, queue: toggleQueue, detail: openDetail, edit: openForm, del: removeBook,
  close: () => $("dlg").close(),
  page: n => { page = n; render(); },
  history: () => { showHist = !showHist; render(); },
  clear: clearFilters,
  logout: () => { me = null; sessionStorage.removeItem(SES); showHist = false; render(); },
  reset: () => {
    if (!isAdmin()) return toast(NOT_ADMIN);
    if (!confirm("Kembalikan semua data (buku, riwayat, antrean) ke kondisi awal?")) return;
    db = fresh(); save(); page = 1; render(); toast("Data direset.");
  }
};

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]");
  if (t && ACTIONS[t.dataset.act]) ACTIONS[t.dataset.act](Number(t.dataset.id));
});

["search-input", "category-filter", "status-filter", "sort-select"].forEach(i =>
  $(i).addEventListener("input", () => { page = 1; render(); }));

// Tanggal simulasi: ubah "hari ini" untuk menguji jatuh tempo dan denda
$("sim-date").addEventListener("change", e => { sim = e.target.value; render(); });

$("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const u = $("login-user").value.trim().toLowerCase(), p = $("login-pass").value;
  if (!u || !p) return void ($("login-err").textContent = "Username dan password wajib diisi.");
  if (!USERS[u] || USERS[u].pw !== p) return void ($("login-err").textContent = "Username atau password salah.");
  me = u; sessionStorage.setItem(SES, u);
  $("login-err").textContent = ""; e.target.reset(); page = 1; render();
});

render();
