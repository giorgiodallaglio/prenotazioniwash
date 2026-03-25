const READ_ENDPOINT="https://automazioni.visionhome.me/webhook/prenotazioni-oggi";
const STATUS_ENDPOINT="https://automazioni.visionhome.me/webhook/aggiorna-stato";
const SERVICES_ENDPOINT="https://automazioni.visionhome.me/webhook/servizi";
const CREATE_ENDPOINT="https://automazioni.visionhome.me/webhook/prenotazione";
const UPDATE_ENDPOINT="https://automazioni.visionhome.me/webhook/modifica-prenotazione";

const DEFAULT_USERS={
  giorgio:{password:"Batman2024!",role:"admin",label:"Giorgio"},
  karen:{password:"Chloe2025!",role:"admin",label:"Karen"},
  michele:{password:"michele123",role:"operatore",label:"Michele"},
  marco:{password:"marco123",role:"operatore",label:"Marco"},
  riccardo:{password:"riccardo123",role:"operatore",label:"Riccardo"},
  vittorio:{password:"vittorio123",role:"operatore",label:"Vittorio"}
};

let USERS = {};
let DEALERS = JSON.parse(localStorage.getItem("vh_dealers") || "[]");
let editingDealerIndex = null;
let allItems=[],services=[],selected=null,editingId=null,currentUser=null,currentPage='today',formDirty=false;

function showToast(message){
  const t=document.getElementById("toast");
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer=setTimeout(()=>t.classList.remove("show"), 2200);
}
function loadUsers(){
  USERS = JSON.parse(JSON.stringify(DEFAULT_USERS));
  localStorage.setItem("vh_booking_users", JSON.stringify(USERS));
}
function saveUsers(){ localStorage.setItem("vh_booking_users", JSON.stringify(USERS)); renderUsersList(); }

function isDealerBookingValue(value){
  const v = String(value || "").trim().toLowerCase();
  return !!v && v !== "-" && v !== "no";
}
function isDealerBooking(item){
  return isDealerBookingValue(item?.concessionaria);
}
function saveDealers(){
  localStorage.setItem("vh_dealers", JSON.stringify(DEALERS));
  renderDealerSelect();
  renderDealerAdminList();
}
function renderDealerSelect(selectedName=""){
  const select = document.getElementById("f-dealer-name");
  if(!select) return;
  select.innerHTML = "";
  if(!DEALERS.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nessuna concessionaria";
    select.appendChild(opt);
  } else {
    DEALERS.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.name;
      opt.textContent = d.name;
      if (selectedName && d.name === selectedName) opt.selected = true;
      select.appendChild(opt);
    });
  }
}
function toggleDealerSelect(forceValue=null, selectedDealer=""){
  const val = forceValue || document.getElementById("f-concessionaria")?.value || "No";
  const wrap = document.getElementById("dealerSelectWrap");
  if(!wrap) return;
  if(val === "Si"){
    wrap.style.display = "block";
    renderDealerSelect(selectedDealer);
  } else {
    wrap.style.display = "none";
  }
}
function saveDealer(){
  const name = document.getElementById("d-name").value.trim();
  const email = document.getElementById("d-email").value.trim();
  const phone = document.getElementById("d-phone").value.trim();
  if(!name){
    showToast("Inserisci nome concessionaria");
    return;
  }
  const dealer = {name, email, phone};
  if(editingDealerIndex !== null){
    DEALERS[editingDealerIndex] = dealer;
  } else {
    DEALERS.push(dealer);
  }
  clearDealerForm();
  saveDealers();
  showToast("Concessionaria salvata");
}
function editDealer(index){
  const d = DEALERS[index];
  if(!d) return;
  document.getElementById("d-name").value = d.name || "";
  document.getElementById("d-email").value = d.email || "";
  document.getElementById("d-phone").value = d.phone || "";
  editingDealerIndex = index;
}
function deleteDealer(index){
  if(!confirm("Eliminare concessionaria?")) return;
  DEALERS.splice(index, 1);
  saveDealers();
  showToast("Concessionaria eliminata");
}
function clearDealerForm(){
  document.getElementById("d-name").value = "";
  document.getElementById("d-email").value = "";
  document.getElementById("d-phone").value = "";
  editingDealerIndex = null;
}
function renderDealerAdminList(){
  const box = document.getElementById("dealerListAdmin");
  if(!box) return;
  box.innerHTML = "";
  if(!DEALERS.length){
    box.innerHTML = '<div class="note-box" style="margin-top:12px">Nessuna concessionaria configurata.</div>';
    return;
  }
  DEALERS.forEach((d, index) => {
    const row = document.createElement("div");
    row.className = "income-item";
    row.innerHTML = `<div><div style="font-weight:800">${d.name}</div><div class="muted" style="font-size:13px">${d.email || "-"} • ${d.phone || "-"}</div></div><div style="display:flex;gap:8px"><button class="btn-secondary" onclick="editDealer(${index})">Modifica</button><button class="btn-danger" onclick="deleteDealer(${index})">Elimina</button></div>`;
    box.appendChild(row);
  });
}

function badgeClass(s){if(s==="Prenotata")return"b-prenotata";if(s==="In lavaggio")return"b-lavorazione";if(s==="Lavata")return"b-lavata";if(s==="No-show")return"b-noshow";return"b-consegnata";}
function formatEuro(v){return "€ "+Number(v||0).toFixed(2).replace(".",",");}
function formatDateTime(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function splitIsoToLocalParts(iso){
  if(!iso) return {date:"", time:""};
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return {date:`${yyyy}-${mm}-${dd}`, time:`${hh}:${mi}`};
}
function localPartsToUTCString(dateValue, timeValue){
  if(!dateValue) return null;
  const full = `${dateValue}T${timeValue || "00:00"}`;
  const d = new Date(full);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mi = String(d.getUTCMinutes()).padStart(2,"0");
  const ss = String(d.getUTCSeconds()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}
function dateKeyFromDate(d){return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;}
function todayKey(){return dateKeyFromDate(new Date());}
function parseDisplayDate(display){if(!display||display==='-') return null; const [date,time]=display.split(' '); const [dd,mm,yyyy]=date.split('/').map(Number); const [hh,min]=time.split(':').map(Number); return new Date(yyyy,mm-1,dd,hh,min||0);}
function toISODateInput(display){const d=parseDisplayDate(display); if(!d) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function isSameDayDisplay(display, refDate){
  const d = parseDisplayDate(display);
  if(!d || !refDate) return false;
  return d.getDate()===refDate.getDate() && d.getMonth()===refDate.getMonth() && d.getFullYear()===refDate.getFullYear();
}
function bustUrl(url){
  return url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
}
function mapRow(r){
  const createdBy = r["Inserito da"] || r.Inserito_da || r["Inserito_da"] || r.Operatore || "";
  return{
    id:r.id,
    modello:r.Modello||"-",
    stato:r.Stato?.value||"-",
    rawArrivo:r.Arrivo || null,
    rawConsegna:r.Consegna || null,
    arrivo:formatDateTime(r.Arrivo),
    consegna:formatDateTime(r.Consegna),
    servizi:Array.isArray(r.Servizi)?r.Servizi.map(s=>({id:s.id,value:s.value})):[],
    telefono:r.Telefono||"-",
    extra:Number(r.Extra||0),
    sconto:Number(r.Sconto||0),
    concessionaria:r.Concessionaria?.value||"-",
    totale:Number(r.Totale_riga||0),
    note:r.Note||"",
    createdBy:(typeof createdBy === "string" ? createdBy : (createdBy?.value || "")) || "-"
  };
}
function mapServiceRow(r){return{id:r.id,name:r.Servizio,price:Number(r.Prezzo||0),active:!!r.Attivo};}

function saveRememberedCredentials(username,password){if(document.getElementById("rememberCreds").checked){localStorage.setItem("vh_booking_saved_creds",JSON.stringify({username,password}));}else{localStorage.removeItem("vh_booking_saved_creds");}}
function restoreRememberedCredentials(){const saved=localStorage.getItem("vh_booking_saved_creds");if(saved){try{const c=JSON.parse(saved);document.getElementById("loginUser").value=c.username||"";document.getElementById("loginPass").value=c.password||"";document.getElementById("rememberCreds").checked=true;}catch(e){}}}

function applyRoleUI(){
  const role=currentUser?.role||null;
  document.getElementById("roleBadge").textContent=role?`Ruolo: ${currentUser.label}`:"Ruolo: -";
  const canCreate=role==="admin"||role==="operatore";
  const canStatus=role==="admin"||role==="operatore";
  const canEdit=role==="admin"||role==="operatore";
  const canIncassi=role==="admin";
  const canAll=role==="admin";
  const canConcessionaria=role==="admin";
  const canStatistiche=role==="admin";
  const canAdminPanel=role==="admin";

  document.querySelectorAll("[data-role-create]").forEach(el=>el.style.display=canCreate?"":"none");
  document.querySelectorAll("[data-role-status]").forEach(el=>el.style.display=canStatus?"":"none");
  document.querySelectorAll("[data-role-edit]").forEach(el=>el.style.display=canEdit?"":"none");
  document.querySelectorAll("[data-role-incassi]").forEach(el=>el.style.display=canIncassi?"":"none");
  document.querySelectorAll("[data-role-allbookings]").forEach(el=>el.style.display=canAll?"":"none");
  document.querySelectorAll("[data-role-concessionaria]").forEach(el=>el.style.display=canConcessionaria?"":"none");
  document.querySelectorAll("[data-role-statistiche]").forEach(el=>el.style.display=canStatistiche?"":"none");
  document.querySelectorAll("[data-role-adminpanel]").forEach(el=>el.style.display=canAdminPanel?"":"none");
  document.getElementById("topCreateBtn").style.display=canCreate?"flex":"none";
  if(currentPage==="incassi"&&!canIncassi) setPage("today");
  if(currentPage==="all"&&!canAll) setPage("future");
  if(currentPage==="concessionaria"&&!canConcessionaria) setPage("today");
  if(currentPage==="statistiche"&&!canStatistiche) setPage("today");
  if(currentPage==="adminpanel"&&!canAdminPanel) setPage("today");
}

function login(){
  const u=document.getElementById("loginUser").value.trim().toLowerCase();
  const p=document.getElementById("loginPass").value;
  if(!USERS[u]||USERS[u].password!==p){document.getElementById("loginHint").textContent="Credenziali non corrette.";return;}
  saveRememberedCredentials(u,p);
  currentUser={username:u,role:USERS[u].role,label:USERS[u].label};
  localStorage.setItem("vh_booking_user",JSON.stringify(currentUser));
  document.getElementById("loginBackdrop").style.display="none";
  applyRoleUI();
  applyCalendarScrollMode();
}
function logout(){localStorage.removeItem("vh_booking_user");currentUser=null;document.getElementById("loginBackdrop").style.display="flex";applyRoleUI();applyCalendarScrollMode();}
function restoreLogin(){restoreRememberedCredentials();const saved=localStorage.getItem("vh_booking_user");if(saved){try{currentUser=JSON.parse(saved);document.getElementById("loginBackdrop").style.display="none";}catch(e){}}applyRoleUI();applyCalendarScrollMode();}

async function loadServices(){const r=await fetch(bustUrl(SERVICES_ENDPOINT),{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store, max-age=0","Pragma":"no-cache"}});if(!r.ok)throw new Error("HTTP "+r.status);const d=await r.json();services=(d.results||[]).map(mapServiceRow).filter(s=>s.active);renderServicesGrid();}
async function loadBookings(){
  const r=await fetch(bustUrl(READ_ENDPOINT),{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store, max-age=0","Pragma":"no-cache"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const d=await r.json();
  allItems=(d.results||[]).map(mapRow).sort((a,b)=>{
    const ad = parseDisplayDate(a.consegna) || parseDisplayDate(a.arrivo) || new Date(8640000000000000);
    const bd = parseDisplayDate(b.consegna) || parseDisplayDate(b.arrivo) || new Date(8640000000000000);
    if(ad.getTime() !== bd.getTime()) return ad - bd;
    const aa = parseDisplayDate(a.arrivo) || new Date(8640000000000000);
    const ba = parseDisplayDate(b.arrivo) || new Date(8640000000000000);
    return aa - ba;
  });
  selected=allItems[0]||null;
  render();
  showDetail();
}
async function loadAll(){try{["listToday","listFuture","listAll"].forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML='<div class="loading">Caricamento...</div>';});await Promise.all([loadServices(),loadBookings()]);showToast("Dati aggiornati");}catch(e){console.error(e);["listToday","listFuture","listAll"].forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML='<div class="error">Errore nel caricamento. Controlla webhook attivi e CORS.</div>';});}}

function renderServicesGrid(ids=[]){
  const g=document.getElementById("servicesGrid"); g.innerHTML="";
  services.forEach(s=>{
    const l=document.createElement("label");
    l.className="service-pill";
    l.innerHTML=`<input type="checkbox" value="${s.id}" ${ids.includes(s.id)?"checked":""} onchange="updateFormSummary()"><div class="service-content"><span class="service-name">${s.name}</span><span class="service-price">${formatEuro(s.price)}</span></div>`;
    g.appendChild(l);
  });
  updateFormSummary();
}
function selectedServiceIds(){return Array.from(document.querySelectorAll('#servicesGrid input:checked')).map(x=>Number(x.value));}
function updateFormSummary(){
  const ids=selectedServiceIds();
  const serviceTotal=services.filter(s=>ids.includes(s.id)).reduce((sum,s)=>sum+Number(s.price||0),0);
  const extra=Number(document.getElementById("f-extra")?.value||0);
  const sconto=Number(document.getElementById("f-sconto")?.value||0);
  const total=serviceTotal+extra-sconto;
  [["sum-services",serviceTotal],["sum-extra",extra],["sum-sconto",sconto],["sum-total",total]].forEach(([id,val])=>{const el=document.getElementById(id); if(el) el.textContent=formatEuro(val);});
}

function matchesSearch(item,q){return [item.modello,item.stato,item.createdBy,item.servizi.map(s=>s.value).join(" ")].join(" ").toLowerCase().includes(q);}
function renderCards(listId, items){
  const list=document.getElementById(listId);
  if(!items.length){
    list.innerHTML='<div class="empty">Nessuna prenotazione trovata.</div>';
    return;
  }
  const statoClass = {
    "Prenotata":"prenotata",
    "In lavaggio":"inlavaggio",
    "Lavata":"lavata",
    "Consegnata":"consegnata",
    "No-show":"noshow"
  };
  list.innerHTML="";
  items.forEach(i=>{
    const nextAction = i.stato==="Prenotata" ? "In lavaggio" : i.stato==="In lavaggio" ? "Lavata" : i.stato==="Lavata" ? "Consegnata" : "";
    const rawPhone = String(i.telefono || "").trim();
    const cleanPhone = rawPhone.replace(/\s+/g,"");
    const hasPhone = cleanPhone && cleanPhone !== "-";
    const waPhone = cleanPhone.replace(/^\+/, "");
    const waText = encodeURIComponent("Ciao, la tua auto è pronta 🚗");
    const consegnaLabel = i.consegna && i.consegna !== "-" ? i.consegna : "Nessuna consegna";
    const c=document.createElement("div");
    c.className="card " + (statoClass[i.stato] || "");
    c.innerHTML = `
      <div>
        <div class="meta">${i.arrivo}</div>
        <div class="model">${i.modello}</div>
        <div class="sub">${i.stato}</div>
        <div class="meta2">→ ${consegnaLabel}</div>
        <div class="urgency-tag">⏱ Consegna ${consegnaLabel}</div>
        ${hasPhone ? `
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <a href="tel:${cleanPhone}" onclick="event.stopPropagation()" style="text-decoration:none;background:#1f6feb;padding:8px 10px;border-radius:10px;color:white;font-size:12px;font-weight:700">📞 Chiama</a>
            <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" onclick="event.stopPropagation()" style="text-decoration:none;background:#25D366;padding:8px 10px;border-radius:10px;color:white;font-size:12px;font-weight:700">💬 WhatsApp</a>
          </div>
        ` : ""}
      </div>
      <div>
        <div class="badge ${badgeClass(i.stato)}">${i.stato}</div>
        ${nextAction ? `<button type="button" class="quick-next" onclick="event.stopPropagation();quickSetStatus(${i.id},'${nextAction}')">${nextAction}</button>` : ""}
      </div>
    `;
    c.onclick=()=>{
      selected=i;
      showDetail();
      if(window.innerWidth<=1280) openDetailModal();
    };
    list.appendChild(c);
  });
}
function render(){
  const today=todayKey();
  const todayStatus=document.getElementById("todayStatusFilter").value;
  const todaySearch=document.getElementById("searchToday").value.toLowerCase().trim();
  const futureDate=document.getElementById("futureDateFilter").value;
  const futureSearch=document.getElementById("searchFuture").value.toLowerCase().trim();
  const allDate=document.getElementById("allDateFilter").value;
  const allStatus=document.getElementById("allStatusFilter").value;
  const allSearch=document.getElementById("searchAll").value.toLowerCase().trim();
  const incomeDate=document.getElementById("incomeDateFilter").value;
  const incomeStatus=document.getElementById("incomeStatusFilter").value;
  const dealerDate=document.getElementById("dealerDateFilter")?.value || "";
  const dealerStatus=document.getElementById("dealerStatusFilter")?.value || "all";
  const dealerSearch=document.getElementById("searchDealer")?.value.toLowerCase().trim() || "";
  const statsFrom=document.getElementById("statsFromDate")?.value || "";
  const statsTo=document.getElementById("statsToDate")?.value || "";

  const urgencySort = (x,y) => {
    const xd = parseDisplayDate(x.consegna) || parseDisplayDate(x.arrivo) || new Date(8640000000000000);
    const yd = parseDisplayDate(y.consegna) || parseDisplayDate(y.arrivo) || new Date(8640000000000000);
    if(xd.getTime() !== yd.getTime()) return xd - yd;
    const xa = parseDisplayDate(x.arrivo) || new Date(8640000000000000);
    const ya = parseDisplayDate(y.arrivo) || new Date(8640000000000000);
    return xa - ya;
  };

  const nowDate = new Date();
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  const todayItems=allItems
    .filter(i=>isSameDayDisplay(i.arrivo, nowDate))
    .filter(i=>todayStatus==="all"?true:i.stato===todayStatus)
    .filter(i=>matchesSearch(i,todaySearch))
    .sort(urgencySort);

  const futureItems=allItems
    .filter(i=>{const d=parseDisplayDate(i.arrivo); return d && d > startOfToday && !isSameDayDisplay(i.arrivo, nowDate);})
    .filter(i=>futureDate ? toISODateInput(i.arrivo)===futureDate : true)
    .filter(i=>matchesSearch(i,futureSearch))
    .sort(urgencySort);

  const allFiltered=allItems
    .filter(i=>allDate ? toISODateInput(i.arrivo)===allDate : true)
    .filter(i=>allStatus==="all"?true:i.stato===allStatus)
    .filter(i=>matchesSearch(i,allSearch))
    .sort(urgencySort);
  const incomeItems=allItems
    .filter(i=>incomeDate ? toISODateInput(i.arrivo)===incomeDate : isSameDayDisplay(i.arrivo, nowDate))
    .filter(i=>i.stato===incomeStatus)
    .filter(i=>!isDealerBooking(i));
  const dealerItems=allItems
    .filter(i=>isDealerBooking(i))
    .filter(i=>dealerDate ? toISODateInput(i.arrivo)===dealerDate : true)
    .filter(i=>dealerStatus==="all"?true:i.stato===dealerStatus)
    .filter(i=>matchesSearch(i,dealerSearch) || String(i.concessionaria||"").toLowerCase().includes(dealerSearch));

  renderCards("listToday", todayItems);
  renderCards("listFuture", futureItems);
  renderCards("listAll", allFiltered);
  const statsItems=allItems.filter(i=>{
    const d = toISODateInput(i.arrivo);
    if(statsFrom && d < statsFrom) return false;
    if(statsTo && d > statsTo) return false;
    return true;
  });

  renderIncome(incomeItems, incomeDate);
  renderDealerGrouped(dealerItems);
  renderTodayStats(todayItems);
  renderStatistics(statsItems);
}
function renderTodayStats(todayItems){
  const stats = [
    ["Prenotate", todayItems.filter(i=>i.stato==="Prenotata").length],
    ["In corso", todayItems.filter(i=>i.stato==="In lavaggio"||i.stato==="Lavata").length],
    ["Consegnate", todayItems.filter(i=>i.stato==="Consegnata").length],
    ["Totale", todayItems.length]
  ];
  const box=document.getElementById("todayStats");
  box.innerHTML="";
  stats.forEach(([label,val])=>{
    const el=document.createElement("div");
    el.className="stat-card";
    el.innerHTML=`<div class="muted">${label}</div><div class="value">${val}</div>`;
    box.appendChild(el);
  });
}
function showDetail(){
  if(!selected) return;
  const st = selected.servizi.length ? selected.servizi.map(s=>s.value).join(" + ") : "Nessun servizio";
  const note = selected.note || "Nessuna nota";

  [
    ["d-model",selected.modello],["d-state",selected.stato],["d-arrivo",selected.arrivo],["d-consegna",selected.consegna],
    ["d-servizi",st],["d-telefono",selected.telefono],["d-extra",formatEuro(selected.extra)],["d-sconto",formatEuro(selected.sconto)],
    ["d-concessionaria",selected.concessionaria],["d-stato2",selected.stato],["d-createdby",selected.createdBy||"-"],
    ["d-totale",formatEuro(selected.totale)],["d-note",note],
    ["m-model",selected.modello],["m-state",selected.stato],["m-arrivo",selected.arrivo],["m-consegna",selected.consegna],
    ["m-servizi",st],["m-telefono",selected.telefono],["m-extra",formatEuro(selected.extra)],["m-sconto",formatEuro(selected.sconto)],
    ["m-concessionaria",selected.concessionaria],["m-stato2",selected.stato],["m-createdby",selected.createdBy||"-"],
    ["m-totale",formatEuro(selected.totale)],["m-note",note]
  ].forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el) el.textContent=val;
  });

  const rawPhone = String(selected.telefono || "").trim();
  const cleanPhone = rawPhone.replace(/\s+/g,"");
  const hasPhone = cleanPhone && cleanPhone !== "-";
  const waPhone = cleanPhone.replace(/^\+/, "");
  const waText = encodeURIComponent("Ciao, la tua auto è pronta 🚗");
  const buttons = hasPhone ? `
    <a href="tel:${cleanPhone}" style="text-decoration:none;background:#1f6feb;padding:10px 12px;border-radius:12px;color:white;font-size:13px;font-weight:700">📞 Chiama</a>
    <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" style="text-decoration:none;background:#25D366;padding:10px 12px;border-radius:12px;color:white;font-size:13px;font-weight:700">💬 WhatsApp</a>
  ` : "";

  ["d-phone-actions","m-phone-actions"].forEach(id=>{
    const box=document.getElementById(id);
    if(!box) return;
    box.innerHTML = buttons;
    box.style.display = hasPhone ? "flex" : "none";
  });
}
function renderIncome(items, incomeDate){
  const total=items.reduce((s,i)=>s+i.totale,0);
  const title=document.getElementById("incomeTitle");
  const selectedLabel = incomeDate ? incomeDate.split("-").reverse().join("/") : todayKey();
  title.textContent=`Incasso totale del ${selectedLabel}`;
  document.getElementById("incomeTotal").textContent=formatEuro(total);
  document.getElementById("incomeCount").textContent=items.length;
  const box=document.getElementById("incomeList");
  box.innerHTML="";
  if(!items.length){box.innerHTML='<div class="income-item"><div class="muted">Nessuna prenotazione per il filtro selezionato.</div></div>';return;}
  items.forEach(i=>{const r=document.createElement("div");r.className="income-item";r.innerHTML=`<div><div style="font-weight:800">${i.modello}</div><div class="muted" style="font-size:13px">${i.arrivo} → ${i.consegna}<br>${i.createdBy ? "Inserita da: "+i.createdBy : ""}</div></div><strong>${formatEuro(i.totale)}</strong>`;box.appendChild(r);});
}

function renderDealerGrouped(items){
  const container = document.getElementById("dealerGrouped");
  if(!container) return;
  container.innerHTML = "";

  if(!items.length){
    container.innerHTML = '<div class="income-item"><div class="muted">Nessuna auto concessionaria.</div></div>';
    return;
  }

  // raggruppa per cliente concessionaria
  const groups = {};
  items.forEach(i=>{
    const key = i.concessionaria || "Altro";
    if(!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  Object.keys(groups).forEach(group=>{
    const list = groups[group];
    const total = list.reduce((s,i)=>s+i.totale,0);

    const block = document.createElement("div");
    block.style.marginBottom = "16px";

    block.innerHTML = `
      <div style="font-weight:800;font-size:16px;margin-bottom:6px">${group}</div>
      <div class="income-card" style="margin-bottom:8px">
        <div class="muted">Totale</div>
        <div class="income-big">${formatEuro(total)}</div>
        <div class="muted">${list.length} auto</div>
      </div>
    `;

    list.forEach(i=>{
      const row = document.createElement("div");
      row.className = "income-item";
      row.innerHTML = `
        <div>
          <div style="font-weight:700">${i.modello}</div>
          <div class="muted" style="font-size:13px">
            ${i.arrivo} → ${i.consegna}<br>
            Stato: ${i.stato}
          </div>
        </div>
        <strong>${formatEuro(i.totale)}</strong>
      `;
      block.appendChild(row);
    });

    container.appendChild(block);
  });
}

function renderDealer(items, dealerDate){
  const total=items.reduce((s,i)=>s+i.totale,0);
  const title=document.getElementById("dealerTitle");
  const selectedLabel = dealerDate ? dealerDate.split("-").reverse().join("/") : "tutte le date";
  title.textContent=`Totale concessionarie ${selectedLabel}`;
  document.getElementById("dealerTotal").textContent=formatEuro(total);
  document.getElementById("dealerCount").textContent=items.length;
  const box=document.getElementById("dealerList");
  box.innerHTML="";
  if(!items.length){box.innerHTML='<div class="income-item"><div class="muted">Nessuna auto concessionaria per il filtro selezionato.</div></div>';return;}
  items.forEach(i=>{
    const r=document.createElement("div");
    r.className="income-item";
    r.innerHTML=`<div><div style="font-weight:800">${i.modello}</div><div class="muted" style="font-size:13px">${i.arrivo} → ${i.consegna}<br>Stato: ${i.stato}${i.createdBy ? " • Inserita da: "+i.createdBy : ""}</div></div><strong>${formatEuro(i.totale)}</strong>`;
    box.appendChild(r);
  });
}

function toggleMoreMenu(event){
  if(event) event.stopPropagation();
  const menu=document.getElementById("mobileMoreMenu");
  const backdrop=document.getElementById("mobileMoreBackdrop");
  if(!menu || !backdrop) return;
  const opening = !menu.classList.contains("show");
  menu.classList.toggle("show", opening);
  backdrop.classList.toggle("show", opening);
}
function closeMoreMenu(){
  const menu=document.getElementById("mobileMoreMenu");
  const backdrop=document.getElementById("mobileMoreBackdrop");
  if(menu) menu.classList.remove("show");
  if(backdrop) backdrop.classList.remove("show");
}
function openMorePage(page){
  closeMoreMenu();
  setPage(page);
}


function setStatsPreset(mode){
  const from = document.getElementById("statsFromDate");
  const to = document.getElementById("statsToDate");
  const now = new Date();
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if(mode==="today"){
    from.value = fmt(now); to.value = fmt(now);
  }else if(mode==="7"){
    const d = new Date(now); d.setDate(d.getDate()-6);
    from.value = fmt(d); to.value = fmt(now);
  }else if(mode==="30"){
    const d = new Date(now); d.setDate(d.getDate()-29);
    from.value = fmt(d); to.value = fmt(now);
  }else if(mode==="month"){
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    from.value = fmt(d); to.value = fmt(now);
  }
  render();
}

function renderStatistics(items){
  const board = document.getElementById("statsBoard");
  const statuses = document.getElementById("statsStatuses");
  const servicesBox = document.getElementById("statsServices");
  const operatorsBox = document.getElementById("statsOperators");
  if(!board || !statuses || !servicesBox || !operatorsBox) return;

  const incassoRealeItems = items.filter(i => !isDealerBooking(i));
  const dealerItems = items.filter(i => isDealerBooking(i));
  const totale = items.length;
  const consegnate = items.filter(i => i.stato==="Consegnata").length;
  const noShow = items.filter(i => i.stato==="No-show").length;
  const incasso = incassoRealeItems.reduce((s,i)=>s+i.totale,0);
  const dealerTotal = dealerItems.reduce((s,i)=>s+i.totale,0);
  const avg = incassoRealeItems.length ? incasso / incassoRealeItems.length : 0;

  const cards = [
    ["Prenotazioni", String(totale)],
    ["Consegnate", String(consegnate)],
    ["Incasso reale", formatEuro(incasso)],
    ["Concessionarie", formatEuro(dealerTotal)],
    ["Ticket medio", formatEuro(avg)],
    ["No-show", String(noShow)]
  ];
  board.innerHTML = "";
  cards.forEach(([title,val])=>{
    const el = document.createElement("div");
    el.className = "stat-card";
    el.innerHTML = `<div class="stat-title">${title}</div><div class="stat-value">${val}</div>`;
    board.appendChild(el);
  });

  const statusCounts = ["Prenotata","In lavaggio","Lavata","Consegnata","No-show"].map(s=>[s, items.filter(i=>i.stato===s).length]);
  statuses.innerHTML = statusCounts.map(([name,count])=>`<div class="stats-row"><span>${name}</span><strong>${count}</strong></div>`).join("");

  const serviceCounts = {};
  items.forEach(i=> (i.servizi||[]).forEach(s=> { serviceCounts[s.value]=(serviceCounts[s.value]||0)+1; }));
  const topServices = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  servicesBox.innerHTML = topServices.length
    ? topServices.map(([name,count])=>`<div class="stats-row"><span>${name}</span><strong>${count}</strong></div>`).join("")
    : '<div class="muted">Nessun servizio nel periodo.</div>';

  const operatorCounts = {};
  items.forEach(i=> { const key=i.createdBy||"Sconosciuto"; operatorCounts[key]=(operatorCounts[key]||0)+1; });
  const topOps = Object.entries(operatorCounts).sort((a,b)=>b[1]-a[1]);
  operatorsBox.innerHTML = topOps.length
    ? topOps.map(([name,count])=>`<div class="stats-row"><span>${name}</span><strong>${count}</strong></div>`).join("")
    : '<div class="muted">Nessun dato operatore.</div>';
}

function setFuturePreset(mode){
  const input=document.getElementById("futureDateFilter");
  const now=new Date();
  if(mode===""){
    input.value="";
  }else if(mode==="tomorrow"){
    const d=new Date(now); d.setDate(d.getDate()+1);
    input.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }else if(mode==="week"){
    input.value="";
    document.getElementById("searchFuture").value="";
  }
  render();
}




let __calendarTouchStartY = 0;


function applyCalendarScrollMode(){
  const screen = document.querySelector('.screen');
  if(!screen) return;
  if(currentPage === 'calendar'){
    screen.style.overflow = 'hidden';
  } else {
    screen.style.overflow = 'auto';
  }
}

function setPage(page, el){
  if(page==="incassi"&&currentUser?.role!=="admin") return;
  if(page==="all"&&currentUser?.role!=="admin") return;
  if(page==="adminpanel"&&currentUser?.role!=="admin") return;
  currentPage=page;
  document.body.classList.toggle("calendar-page", page==="calendar");
  const titles={today:"Prenotazioni",future:"Prossime",calendar:"Calendario",incassi:"Incassi",all:"Tutte le prenotazioni",concessionaria:"Concessionaria",statistiche:"Statistiche",adminpanel:"Pannello Admin"};
  document.getElementById("screenTitle").textContent=titles[page]||"Prenotazioni";
  ["today","future","calendar","incassi","all","concessionaria","statistiche","adminpanel"].forEach(p=>document.getElementById("page-"+p).style.display=p===page?"block":"none");
  document.querySelectorAll(".sidebar .nav-item[data-nav]").forEach(x=>x.classList.remove("active"));
  if(el) el.classList.add("active");
  else{
    const sidebarActive=document.querySelector(`.sidebar .nav-item[data-nav="${page}"]`);
    if(sidebarActive) sidebarActive.classList.add("active");
  }
  document.querySelectorAll(".bottomnav div[data-bnav]").forEach(x=>x.classList.remove("active"));
  const activeBottom=document.querySelector(`.bottomnav div[data-bnav="${page}"]`);
  if(activeBottom) activeBottom.classList.add("active");
  if(page==="adminpanel") renderUsersList();
  if(page==="statistiche") render();
  applyCalendarScrollMode();
  if(page==="calendar") renderCalendar();
}


function normalizePhone(v){
  return String(v||"").replace(/\D+/g,"");
}
function checkCustomer(){
  const tel = normalizePhone(document.getElementById("f-telefono")?.value || "");
  const box = document.getElementById("customerInfo");
  if(!box) return;

  if(!tel || tel.length < 6){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const matches = allItems.filter(i => normalizePhone(i.telefono) === tel);

  if(matches.length === 0){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const sorted = [...matches].sort((a,b)=>{
    const ad = parseDisplayDate(a.arrivo) || new Date(0);
    const bd = parseDisplayDate(b.arrivo) || new Date(0);
    return bd - ad;
  });

  const count = sorted.length;
  const last = sorted[0];
  const serviceCount = {};
  sorted.forEach(i=>{
    (i.servizi||[]).forEach(s=>{
      serviceCount[s.value] = (serviceCount[s.value] || 0) + 1;
    });
  });

  const topServices = Object.entries(serviceCount)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3)
    .map(x=>x[0])
    .join(", ");

  const vip = count >= 10 ? "🔥 Cliente VIP" : count >= 3 ? "🟢 Cliente abituale" : "🟡 Già passato";
  const lastModel = last.modello && last.modello !== "-" ? `<div style="font-size:13px;margin-top:4px">Ultima auto: ${last.modello}</div>` : "";
  const pref = topServices ? `<div style="font-size:13px;margin-top:4px">Servizi frequenti: ${topServices}</div>` : "";

  box.innerHTML = `
    <div style="font-weight:800;color:#dbe7ff;margin-bottom:4px">${vip}</div>
    <div style="font-size:13px;color:#9aa4b2">${count} visite • ultima: ${last.arrivo}</div>
    ${lastModel}
    ${pref}
  `;
  box.style.display = "block";
}
function clearForm(){
  editingId=null;
  formDirty=false;
  document.getElementById("formTitle").textContent="Nuova prenotazione";
  ["f-modello","f-arrivo-date","f-arrivo-time","f-consegna-date","f-consegna-time","f-telefono","f-note"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("f-stato").value="Prenotata";
  document.getElementById("f-concessionaria").value="No";
  toggleDealerSelect("No");
  document.getElementById("f-extra").value=0;
  document.getElementById("f-sconto").value=0;
  renderServicesGrid([]);
  updateFormSummary();
  checkCustomer();
}
function openCreateModal(){
  if(!(currentUser&&(currentUser.role==="admin"||currentUser.role==="operatore")))return;
  clearForm();
  document.getElementById("formBackdrop").style.display="flex";
}
function closeFormModal(){
  document.getElementById("formBackdrop").style.display="none";
}
function handleCancelEdit(){
  closeFormModal();
  clearForm();
}
function openDetailModal(){document.getElementById("detailBackdrop").style.display="flex";}
function closeDetailModal(){document.getElementById("detailBackdrop").style.display="none";}
function openEditModal(){
  if(!(currentUser&&(currentUser.role==="admin"||currentUser.role==="operatore")))return;
  if(!selected)return;
  formDirty=false;
  editingId=selected.id;
  document.getElementById("formTitle").textContent="Modifica prenotazione";
  document.getElementById("f-modello").value=selected.modello==="-"?"":selected.modello;
  document.getElementById("f-stato").value=selected.stato;
  const arrivoParts = splitIsoToLocalParts(selected.rawArrivo);
  const consegnaParts = splitIsoToLocalParts(selected.rawConsegna);
  document.getElementById("f-arrivo-date").value=arrivoParts.date;
  document.getElementById("f-arrivo-time").value=arrivoParts.time;
  document.getElementById("f-consegna-date").value=consegnaParts.date;
  document.getElementById("f-consegna-time").value=consegnaParts.time;
  document.getElementById("f-telefono").value=selected.telefono==="-"?"":selected.telefono;
  const dealerValue = selected.concessionaria && selected.concessionaria !== "-" ? selected.concessionaria : "No";
  const isDealer = isDealerBookingValue(dealerValue);
  document.getElementById("f-concessionaria").value = isDealer ? "Si" : "No";
  toggleDealerSelect(isDealer ? "Si" : "No", isDealer ? dealerValue : "");
  document.getElementById("f-extra").value=selected.extra||0;
  document.getElementById("f-sconto").value=selected.sconto||0;
  document.getElementById("f-note").value=selected.note||"";
  renderServicesGrid(selected.servizi.map(s=>s.id));
  checkCustomer();
  updateFormSummary();
  closeDetailModal();
  document.getElementById("formBackdrop").style.display="flex";
}
async function quickSetStatus(id, status){
  selected = allItems.find(i=>i.id===id) || selected;
  await setStatus(status);
}
async function setStatus(status){
  if(!(currentUser&&(currentUser.role==="admin"||currentUser.role==="operatore")))return;
  if(!selected)return;
  try{
    const r=await fetch(STATUS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:selected.id,stato:status})});
    if(!r.ok)throw new Error("HTTP "+r.status);
    if(status==="Lavata"||status==="Consegnata") await sendNotification({type:"status",status,booking:selected,operatore:currentUser.label});
    await loadBookings();
    const u=allItems.find(i=>i.id===selected.id);
    if(u){selected=u;showDetail();}
    closeDetailModal();
    showToast(`Stato aggiornato: ${status}`);
  }catch(e){console.error(e);alert("Errore aggiornamento stato.");}
}
async function saveForm(){
  if(!(currentUser&&(currentUser.role==="admin"||currentUser.role==="operatore")))return;
  const isEdit = !!editingId;
  const payload={
    stato:document.getElementById("f-stato").value,
    modello:document.getElementById("f-modello").value.trim(),
    arrivo:localPartsToUTCString(document.getElementById("f-arrivo-date").value, document.getElementById("f-arrivo-time").value),
    consegna:localPartsToUTCString(document.getElementById("f-consegna-date").value, document.getElementById("f-consegna-time").value),
    servizi:selectedServiceIds(),
    extra:Number(document.getElementById("f-extra").value||0),
    sconto:Number(document.getElementById("f-sconto").value||0),
    concessionaria:document.getElementById("f-concessionaria").value === "Si" ? document.getElementById("f-dealer-name").value : "No",
    telefono:document.getElementById("f-telefono").value.trim(),
    note:document.getElementById("f-note").value.trim(),
    inserito_da:(isEdit && selected ? selected.createdBy : currentUser.label)
  };
  if(document.getElementById("f-concessionaria").value === "Si" && !document.getElementById("f-dealer-name").value){
    alert("Seleziona la concessionaria.");
    return;
  }
  if(!payload.modello||!payload.arrivo||!payload.servizi.length){alert("Compila almeno modello, arrivo e un servizio.");return;}
  const endpoint=isEdit?UPDATE_ENDPOINT:CREATE_ENDPOINT;
  const body=isEdit?{id:editingId,...payload}:payload;
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok)throw new Error("HTTP "+r.status);
    closeFormModal();
    clearForm();
    await loadBookings();
    showToast(isEdit ? "Prenotazione modificata" : "Prenotazione creata");
  }catch(e){console.error(e);alert("Errore salvataggio prenotazione.");}
}

function clearUserForm(){
  ["u-label","u-username","u-password"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("u-role").value="operatore";
}
function saveUser(){
  if(currentUser?.role!=="admin") return;
  const label=document.getElementById("u-label").value.trim();
  const username=document.getElementById("u-username").value.trim().toLowerCase();
  const password=document.getElementById("u-password").value;
  const role=document.getElementById("u-role").value;
  if(!label||!username||!password){alert("Compila nome, username e password.");return;}
  USERS[username]={label,password,role};
  saveUsers();
  clearUserForm();
  showToast("Utente salvato");
}
function deleteUser(username){
  if(currentUser?.role!=="admin") return;
  if(username===currentUser.username){alert("Non puoi eliminare l'utente con cui sei loggato.");return;}
  if(!confirm(`Eliminare l'utente ${username}?`)) return;
  delete USERS[username];
  saveUsers();
  showToast("Utente eliminato");
}
function editUser(username){
  const u=USERS[username]; if(!u) return;
  document.getElementById("u-label").value=u.label;
  document.getElementById("u-username").value=username;
  document.getElementById("u-password").value=u.password;
  document.getElementById("u-role").value=u.role;
}
function renderUsersList(){
  const box=document.getElementById("usersList");
  if(!box) return;
  const keys=Object.keys(USERS).sort();
  box.innerHTML="";
  keys.forEach(username=>{
    const u=USERS[username];
    const row=document.createElement("div");
    row.className="income-item";
    row.innerHTML=`<div><div style="font-weight:800">${u.label}</div><div class="muted" style="font-size:13px">${username} • ${u.role}</div></div><div style="display:flex;gap:8px"><button class="btn-secondary" onclick="editUser('${username}')">Modifica</button><button class="btn-danger" onclick="deleteUser('${username}')">Elimina</button></div>`;
    box.appendChild(row);
  });
}
function saveNotifySettings(){
  const endpoint=document.getElementById("notify-endpoint").value.trim();
  localStorage.setItem("vh_notify_endpoint", endpoint);
  showToast("Webhook notifiche salvato");
}
function restoreNotifySettings(){
  document.getElementById("notify-endpoint").value=localStorage.getItem("vh_notify_endpoint")||"";
}
async function sendNotification(payload){
  const endpoint=localStorage.getItem("vh_notify_endpoint");
  if(!endpoint) return;
  try{
    await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  }catch(e){console.error("Webhook notifica non raggiungibile", e);}
}
async function testNotification(){
  const endpoint=document.getElementById("notify-endpoint").value.trim();
  if(!endpoint){alert("Inserisci prima un webhook.");return;}
  await sendNotification({type:"test",message:"Test notifica VisionHome Prenotazioni"});
  showToast("Test notifica inviato");
}

["f-extra","f-sconto"].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener("input", ()=>{formDirty=true; updateFormSummary();});});
["f-modello","f-arrivo-date","f-arrivo-time","f-consegna-date","f-consegna-time","f-telefono","f-note","f-stato","f-concessionaria","f-dealer-name"].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener("input", ()=>{formDirty=true; if(id==="f-telefono") checkCustomer();}); if(el) el.addEventListener("change", ()=>{formDirty=true; if(id==="f-telefono") checkCustomer();});});
document.addEventListener("change", (e)=>{ if(e.target && e.target.closest("#servicesGrid")) formDirty=true; });


let calendarDate = new Date();

function formatCalendarInputDate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function minutesFromDate(date){
  return date.getHours()*60 + date.getMinutes();
}
function calendarStatusClass(status){
  if(status==="Prenotata") return "b-prenotata";
  if(status==="In lavaggio") return "b-lavorazione";
  if(status==="Lavata") return "b-lavata";
  if(status==="No-show") return "b-noshow";
  return "b-consegnata";
}
function buildCalendarHours(){
  const box = document.getElementById("calendarHours");
  if(!box || box.dataset.ready==="1") return;
  box.innerHTML = "";
  for(let h=0; h<24; h++){
    const row = document.createElement("div");
    row.className = "calendar-hour";
    row.textContent = `${String(h).padStart(2,"0")}:00`;
    box.appendChild(row);
  }
  box.dataset.ready = "1";
}
function getCalendarItems(){
  return allItems.filter(i=>{
    const start = parseDisplayDate(i.arrivo);
    return start && sameDay(start, calendarDate);
  }).sort((a,b)=>{
    const sa = parseDisplayDate(a.arrivo) || new Date(8640000000000000);
    const sb = parseDisplayDate(b.arrivo) || new Date(8640000000000000);
    return sa - sb;
  });
}
function renderCalendarNowLine(){
  const eventsBox = document.getElementById("calendarEvents");
  if(!eventsBox) return;
  const old = document.getElementById("calendarNowLine");
  if(old) old.remove();
  const now = new Date();
  if(!sameDay(now, calendarDate)) return;
  const line = document.createElement("div");
  line.id = "calendarNowLine";
  line.className = "calendar-now-line";
  line.style.top = `${(minutesFromDate(now)/60)*52}px`;
  eventsBox.appendChild(line);
}



function isAdminUser(){
  return currentUser?.role === "admin";
}
function normalizeDateOnly(d){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function canAccessCalendarDate(date){
  if (isAdminUser()) return true;
  const today = normalizeDateOnly(new Date());
  const target = normalizeDateOnly(date);
  return target >= today;
}
function enforceCalendarPermissions(){
  if (canAccessCalendarDate(calendarDate)) return;
  calendarDate = new Date();
  const input = document.getElementById("calendarDateFilter");
  if (input) input.value = formatCalendarInputDate(calendarDate);
  if (typeof showToast === "function") {
    showToast("Gli operatori possono vedere solo oggi e i giorni futuri");
  }
}

function renderCalendar(){
  enforceCalendarPermissions();
  buildCalendarHours();
  const title = document.getElementById("calendarDateTitle");
  const head = document.getElementById("calendarHeadDay");
  const input = document.getElementById("calendarDateFilter");
  const eventsBox = document.getElementById("calendarEvents");
  const empty = document.getElementById("calendarEmpty");
  const grid = document.getElementById("calendarGrid");
  const board = document.querySelector(".calendar-board");
  const hint = document.getElementById("calendarScrollHint");
  if(!title || !head || !input || !eventsBox || !empty || !grid || !board) return;

  input.value = formatCalendarInputDate(calendarDate);
  const label = calendarDate.toLocaleDateString("it-IT",{weekday:"long", day:"2-digit", month:"long", year:"numeric"});
  title.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  head.textContent = calendarDate.toLocaleDateString("it-IT",{weekday:"long", day:"2-digit", month:"long"});
  const prevBtn = document.getElementById("calendarPrevBtn");
  if (prevBtn) {
    const yesterday = new Date(calendarDate);
    yesterday.setDate(yesterday.getDate() - 1);
    prevBtn.disabled = !canAccessCalendarDate(yesterday);
    prevBtn.style.opacity = prevBtn.disabled ? "0.45" : "1";
  }
  eventsBox.innerHTML = "";

  const items = getCalendarItems().map(i=>{
    const start = parseDisplayDate(i.arrivo);
    let end = parseDisplayDate(i.consegna);
    if(!start) return null;
    if(!end || end <= start) end = new Date(start.getTime() + 60*60*1000);
    const startMin = minutesFromDate(start);
    const endMin = Math.max(startMin + 30, minutesFromDate(end));
    return { item:i, startMin, endMin };
  }).filter(Boolean);

  empty.style.display = items.length ? "none" : "block";

  const active = [];
  let globalMaxCol = 0;
  for (const ev of items) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= ev.startMin) active.splice(i, 1);
    }
    const usedCols = new Set(active.map(a => a.col));
    let col = 0;
    while (usedCols.has(col)) col++;
    ev.col = col;
    active.push(ev);
    if (col > globalMaxCol) globalMaxCol = col;
  }

  const clusters = [];
  let current = null;
  for (const ev of items) {
    if (!current) {
      current = { events:[ev], end:ev.endMin, maxCol:ev.col };
      continue;
    }
    if (ev.startMin < current.end) {
      current.events.push(ev);
      current.end = Math.max(current.end, ev.endMin);
      current.maxCol = Math.max(current.maxCol, ev.col);
    } else {
      clusters.push(current);
      current = { events:[ev], end:ev.endMin, maxCol:ev.col };
    }
  }
  if (current) clusters.push(current);

  const mobile = window.innerWidth <= 860;
  const minColWidth = mobile ? 140 : 150;
  const sideGap = 10;
  const colGap = 8;
  const hoursWidth = 72;
  const visibleEventsWidth = Math.max(board.clientWidth - hoursWidth, mobile ? 300 : 420);
  const neededEventsWidth = Math.max(visibleEventsWidth, (globalMaxCol + 1) * minColWidth + Math.max(0, globalMaxCol) * colGap + sideGap*2);

  grid.style.minWidth = `${hoursWidth + neededEventsWidth}px`;
  eventsBox.style.width = `${neededEventsWidth}px`;
  hint?.classList.toggle("show", mobile && neededEventsWidth > visibleEventsWidth + 20);

  clusters.forEach(cluster=>{
    const columns = cluster.maxCol + 1;
    const clusterWidth = Math.max(visibleEventsWidth, columns * minColWidth + Math.max(0, columns - 1) * colGap + sideGap*2);
    const cardWidth = Math.max((clusterWidth - sideGap*2 - (columns - 1)*colGap) / columns, minColWidth);

    cluster.events.forEach(ev=>{
      const top = (ev.startMin/60)*52;
      const height = Math.max(((ev.endMin-ev.startMin)/60)*52, 36);
      const left = sideGap + ev.col * (cardWidth + colGap);

      const card = document.createElement("div");
      card.className = `calendar-event ${calendarStatusClass(ev.item.stato)}`;
      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      card.style.width = `${cardWidth}px`;
      card.style.height = `${height}px`;
      card.innerHTML = `
        <div class="event-time">${ev.item.arrivo} → ${ev.item.consegna}</div>
        <div class="event-title">${ev.item.modello}</div>
        <div class="event-sub">${ev.item.stato}${ev.item.concessionaria && ev.item.concessionaria !== "-" ? " • " + ev.item.concessionaria : ""}</div>
      `;
      card.onclick = ()=>{
        selected = ev.item;
        showDetail();
        if(window.innerWidth<=1280) openDetailModal();
      };
      eventsBox.appendChild(card);
    });
  });

  renderCalendarNowLine();
}


function shiftCalendarDay(delta){
  const newDate = new Date(calendarDate);
  newDate.setDate(newDate.getDate() + delta);

  if (!canAccessCalendarDate(newDate)) {
    if (typeof showToast === "function") {
      showToast("Gli operatori non possono andare indietro nel calendario");
    }
    return;
  }

  calendarDate = newDate;
  renderCalendar();
}
function goTodayCalendar(){
  calendarDate = new Date();
  renderCalendar();
}
function onCalendarDateChange(){
  const v = document.getElementById("calendarDateFilter").value;
  if(!v) return;

  const [y,m,d] = v.split("-").map(Number);
  const newDate = new Date(y, m-1, d);

  if (!canAccessCalendarDate(newDate)) {
    if (typeof showToast === "function") {
      showToast("Gli operatori non possono aprire date passate");
    }
    document.getElementById("calendarDateFilter").value = formatCalendarInputDate(calendarDate);
    return;
  }

  calendarDate = newDate;
  renderCalendar();
}


loadUsers();
restoreLogin();
applyCalendarScrollMode();
restoreNotifySettings();
renderDealerSelect();
renderDealerAdminList();
toggleDealerSelect("No");
setInterval(()=>{if(currentUser){loadBookings().catch(console.error);}},15000);
document.getElementById("incomeDateFilter").value = new Date().toISOString().slice(0,10);
document.getElementById("dealerDateFilter").value = "";
loadAll();
applyCalendarScrollMode();
renderCalendar();
