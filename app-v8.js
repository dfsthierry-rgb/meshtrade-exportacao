/* Central Mesh Export Desk · FX history and invoice regeneration */
document.head.insertAdjacentHTML('beforeend',`<style>
.fxRate{display:inline-flex;flex-direction:column;gap:2px;white-space:nowrap}.fxRate b{font-size:14px}.fxRate small{font-size:9px;color:var(--muted);letter-spacing:.08em}.fxRevisionCard{display:grid;grid-template-columns:minmax(230px,1fr) minmax(180px,.7fr) minmax(180px,.7fr) auto;align-items:end;gap:14px;background:#fff;border:1px solid var(--stroke);border-left:5px solid var(--yellow);padding:16px;margin:14px 0}.fxRevisionCard h3{margin:0 0 4px;font-size:17px}.fxRevisionCard p{margin:0;color:var(--muted);font-size:12px}.fxRevisionCard label{font-size:10px;letter-spacing:.06em;font-weight:800}.fxRevisionCard input{font-size:18px;font-weight:900;background:#fffdf2}.fxRevisionValue{background:#f4f2eb;border:1px solid var(--stroke);padding:11px 13px}.fxRevisionValue small{display:block;color:var(--muted);margin-bottom:4px}.fxRevisionValue b{font-size:19px}.fxUpdateMessage{grid-column:1/-1;font-size:12px;font-weight:800;color:var(--green);min-height:16px}@media(max-width:900px){.fxRevisionCard{grid-template-columns:1fr 1fr}.fxRevisionCard>div:first-child,.fxUpdateMessage{grid-column:1/-1}}@media(max-width:560px){.fxRevisionCard{grid-template-columns:1fr}}
</style>`);

const fxNumber=v=>Number(v)||0;
const fxLabel=v=>fxNumber(v)?fxNumber(v).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}):'—';
const currentInvoiceTotal=()=>usdTotal()+(+S.freightUSD||0)+(+S.insuranceUSD||0)+(+S.otherUSD||0);

function migrateHistoryFx(){
  const records=history();let changed=false;
  records.forEach(record=>{
    const rate=fxNumber(record.fx||record.data?.fx);
    if(rate&&!record.fx){record.fx=rate;changed=true}
    if(rate&&!Array.isArray(record.fxHistory)){record.fxHistory=[{fx:rate,updatedAt:record.savedAt||new Date().toISOString()}];changed=true}
  });
  if(changed)localStorage.setItem('cm-invoice-history',JSON.stringify(records));
}

const saveInvoiceHistoryV8=saveInvoiceHistory;
saveInvoiceHistory=function(){
  const previous=history().find(x=>x.invoiceNo===S.invoiceNo),oldHistory=Array.isArray(previous?.fxHistory)?previous.fxHistory.slice():[];
  saveInvoiceHistoryV8();
  const records=history(),record=records.find(x=>x.invoiceNo===S.invoiceNo),rate=fxNumber(S.fx),now=new Date().toISOString();
  if(!record)return;
  if(rate&&(!oldHistory.length||fxNumber(oldHistory.at(-1).fx)!==rate))oldHistory.push({fx:rate,updatedAt:now});
  Object.assign(record,{fx:rate,fxUpdatedAt:now,fxHistory:oldHistory,totalUSD:currentInvoiceTotal(),data:JSON.parse(JSON.stringify(S))});
  localStorage.setItem('cm-invoice-history',JSON.stringify(records));
};

renderDashboard=function(query=''){
  migrateHistoryFx();
  const q=String(query).toLowerCase(),all=history(),rows=all.filter(x=>[x.invoiceNo,x.customer,x.orders,x.fx,x.data?.fx].join(' ').toLowerCase().includes(q));
  dashboardMetrics.innerHTML=`<div class="metric"><small>Invoices emitidas</small><b>${all.length}</b></div><div class="metric"><small>Valor acumulado</small><b>${usd(all.reduce((a,x)=>a+(+x.totalUSD||0),0))}</b></div><div class="metric"><small>Clientes</small><b>${new Set(all.map(x=>x.customer)).size}</b></div><div class="metric"><small>Peso bruto acumulado</small><b>${all.reduce((a,x)=>a+(+x.gross||0),0).toFixed(3)} kg</b></div>`;
  dashboardTable.innerHTML=rows.length?`<table class="cleanTable"><tr><th>Invoice</th><th>Data</th><th>Consignee</th><th>PO / Pedidos</th><th>Câmbio utilizado</th><th>Total USD</th><th>Caixas / Pacotes</th><th>Peso líquido / bruto</th><th>Ações</th></tr>${rows.map(x=>{const rate=fxNumber(x.fx||x.data?.fx);return `<tr><td class="invoiceNo"><b>${esc(x.invoiceNo)}</b></td><td>${esc(x.date)}</td><td>${esc(x.customer)}</td><td>${esc(x.orders)}</td><td><span class="fxRate"><b>R$ ${fxLabel(rate)}</b><small>BRL POR USD</small></span></td><td>${usd(x.totalUSD)}</td><td>${x.cartons||0} / ${x.packages||0}</td><td>${(+x.net||0).toFixed(3)} / ${(+x.gross||0).toFixed(3)} kg</td><td><div class="rowActions"><button class="backcta" onclick="openHistoryInvoice('${esc(x.invoiceNo)}')">Abrir / atualizar</button><button class="backcta dangerSolid" onclick="deleteHistoryInvoice('${esc(x.invoiceNo)}')">Excluir</button></div></td></tr>`}).join('')}</table>`:'<div class="empty"><b>Nenhuma Invoice encontrada.</b><br>Inicie uma nova operação para importar pedidos e emitir os documentos.</div>';
};

function renderFxRevisionCard(message=''){
  const stage=document.getElementById('stage4'),anchor=stage?.querySelector('.success');if(!anchor)return;
  document.getElementById('fxRevisionCard')?.remove();
  const card=document.createElement('div');card.id='fxRevisionCard';card.className='fxRevisionCard';
  card.innerHTML=`<div><h3>Câmbio desta Invoice</h3><p>A taxa fica gravada no histórico. Altere-a para recalcular e regerar os documentos sem duplicar a Invoice.</p></div><label>NOVO CÂMBIO BRL POR USD<input id="issuedFxInput" type="number" min="0.0001" step="0.0001" value="${esc(S.fx||'')}" oninput="previewIssuedFx(this.value)"></label><div class="fxRevisionValue"><small>Total recalculado</small><b id="issuedFxTotal">${+S.fx?usd(currentInvoiceTotal()):'—'}</b></div><button class="maincta" onclick="applyIssuedFx()">Atualizar Invoice</button><div id="fxUpdateMessage" class="fxUpdateMessage">${esc(message)}</div>`;
  anchor.insertAdjacentElement('afterend',card);
}

function previewIssuedFx(value){
  const rate=fxNumber(value),goods=rate?operationBRL()/rate:0,total=goods+(+S.freightUSD||0)+(+S.insuranceUSD||0)+(+S.otherUSD||0);
  if(document.getElementById('issuedFxTotal'))issuedFxTotal.textContent=rate?usd(total):'—';
  if(document.getElementById('fxUpdateMessage'))fxUpdateMessage.textContent='';
}

function applyIssuedFx(){
  const rate=fxNumber(document.getElementById('issuedFxInput')?.value);
  if(!rate){fxUpdateMessage.textContent='Informe um câmbio válido maior que zero.';fxUpdateMessage.style.color='var(--red)';return}
  const previous=fxNumber(S.fx);S.fx=rate;quietSave();saveInvoiceHistory();renderDocs();renderFxRevisionCard(`Invoice atualizada: câmbio alterado de R$ ${fxLabel(previous)} para R$ ${fxLabel(rate)}. PDF e Excel já usarão o novo valor.`);renderDashboard(document.getElementById('dashboardSearch')?.value||'');
}

const renderDocsV8=renderDocs;
renderDocs=function(){renderDocsV8();renderFxRevisionCard()};

openHistoryInvoice=function(number){
  migrateHistoryFx();const record=history().find(x=>x.invoiceNo===number);if(!record)return;
  S=JSON.parse(JSON.stringify(record.data));S.fx=fxNumber(record.fx||S.fx);quietSave();closeDashboard();goStep(4);
};

migrateHistoryFx();
if(document.getElementById('dashboardDrawer')?.classList.contains('open'))renderDashboard('');
