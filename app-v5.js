/* Editable document layer. Invoice is the single source shared by Packing List and exports. */
S.freightUSD ??= '';
S.insuranceUSD ??= '';
S.otherUSD ??= '';
S.declaration ??= 'We hereby certify that the information contained in this invoice is true and correct.';
S.packNotes ??= '';

document.head.insertAdjacentHTML('beforeend', `<style>
.editbar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#eaf2f3;border:1px solid #cbdcdf;padding:11px 14px;margin-bottom:10px}
.editbar strong{font-size:13px}.editbar span{color:#607278;font-size:12px}
.docedit{width:100%;min-width:62px;border:0;border-bottom:1px dashed #8ba1a5;border-radius:0;padding:3px 2px;margin:0;background:#fffdf1;font:inherit}
.docedit:focus{outline:2px solid #9dcbd0;background:#fff}
.docarea{min-height:48px;resize:vertical}.docnote{border:1px solid #777;margin-top:14px;padding:9px}.docnote b{font-size:10px;display:block;margin-bottom:5px}
.charges{width:330px;margin:14px 0 0 auto}.charges td:first-child{font-weight:bold}.charges input{text-align:right}
.document-actions{display:flex;gap:7px}.linkbtn{border:0;background:transparent;color:#0c5964;text-decoration:underline;cursor:pointer;font-weight:bold}
.paper table input,.paper table textarea{font-size:12px}
.unitprice{min-width:84px;text-align:right}.unitmode{display:block;margin-top:3px;font-size:9px}.netsync{background:#eef7f2!important;color:#185f47;font-weight:800}
</style>`);

function quietSave(){localStorage.setItem('cm-invoice-v4',JSON.stringify(S))}
function editRoot(key,value){S[key]=value;quietSave();if(document.getElementById('checks'))renderSummary();renderDocs()}
function editParty(side,key,value){S[side][key]=value;quietSave();renderDocs()}
function editClientDoc(key,value){client()[key]=value;quietSave();renderDocs()}
function editLineDoc(index,key,value){
  let flat=0;
  for(const order of S.orders){
    for(const item of order.items){
      if(flat===index){item[key]=['qty','unitBRL','netWeight'].includes(key)?Number(value):value;quietSave();if(document.getElementById('checks'))renderSummary();renderDocs();return}
      flat++;
    }
  }
}
function editLineUSD(index,value){
  let flat=0;
  for(const order of S.orders)for(const item of order.items){
    if(flat===index){item.unitUSDOverride=value===''?null:round4(value);quietSave();if(typeof currentStep!=='undefined'&&currentStep===4&&typeof saveInvoiceHistory==='function')saveInvoiceHistory();if(document.getElementById('checks'))renderSummary();renderDocs();return}
    flat++;
  }
}
function resetLineUSD(index){
  let flat=0;
  for(const order of S.orders)for(const item of order.items){
    if(flat===index){delete item.unitUSDOverride;quietSave();if(typeof currentStep!=='undefined'&&currentStep===4&&typeof saveInvoiceHistory==='function')saveInvoiceHistory();if(document.getElementById('checks'))renderSummary();renderDocs();return}
    flat++;
  }
}
function connectedDescription(){return allItems().map(x=>x.description).filter(Boolean).join(' / ')}
addPack=function(){
  S.packs.push({box:S.packs.length+1,description:'',qty:'',length:'',width:'',height:'',net:'',gross:'',notes:''});
  render();
};
function editableParty(title,side,p){
  const updater=side==='client'?'editClientDoc':'editParty.bind(null,\'exporter\')';
  const call=(key)=>side==='client'? `editClientDoc('${key}',this.value)` : `editParty('exporter','${key}',this.value)`;
  return `<div class="party"><b>${title}</b>
    <input class="docedit" value="${esc(p.name)}" onchange="${call('name')}">
    <textarea class="docedit docarea" onchange="${call('address')}">${esc(p.address)}</textarea>
    <input class="docedit" value="${esc(p.tax)}" placeholder="Tax ID" onchange="${call('tax')}">
    <input class="docedit" value="${esc(p.country||'')}" placeholder="Country" onchange="${call('country')}">
  </div>`;
}
function docField(label,key,value,type='text'){
  return `<div>${label}<strong><input class="docedit" type="${type}" value="${esc(value)}" onchange="editRoot('${key}',this.value)"></strong></div>`;
}
function lineDescription(index,item){
  return `<textarea class="docedit docarea" onchange="editLineDoc(${index},'description',this.value)">${esc(item.description)}</textarea>`;
}
function renderDocs(){
  const c=client(), it=allItems(), po=S.orders.map(o=>o.customerPO||o.order).filter(Boolean).join(', ');
  const goods=usdTotal(), final=goods+(+S.freightUSD||0)+(+S.insuranceUSD||0)+(+S.otherUSD||0);
  invoiceView.innerHTML=`<div class="editbar"><div><strong>Documento editável</strong><br><span>Altere os campos diretamente. A Packing List e os arquivos finais usam os mesmos dados.</span></div><div class="document-actions"><button class="linkbtn" onclick="show('profiles')">Cadastros</button><button class="linkbtn" onclick="show('packing')">Packing List</button></div></div>
  <div class="paper"><div class="dochead"><img src="central-mesh-logo.png"><div class="doctype">COMMERCIAL INVOICE</div></div>
  <div class="parties">${editableParty('SHIPPER','exporter',S.exporter)}${editableParty('CONSIGNEE','client',c)}</div>
  <div class="docmeta">${docField('INVOICE NUMBER','invoiceNo',S.invoiceNo)}${docField('ISSUE DATE','invoiceDate',S.invoiceDate,'date')}${docField('PO','poDisplay',S.poDisplay||po)}${docField('INCOTERM','incoterm',S.incoterm)}</div>
  <table><tr><th>Item</th><th>NCM/HS Code</th><th>Description</th><th>Net Weight kg</th><th>Qty.</th><th>Unit BRL</th><th>Unit USD</th><th>Total USD</th></tr>
  ${it.map((x,i)=>{const net=itemNetKG(x);return `<tr><td>${i+1}</td><td><input class="docedit" value="${esc(x.hs)}" onchange="editLineDoc(${i},'hs',this.value)"></td><td>${lineDescription(i,x)}</td><td><input class="docedit netsync" value="${net?net.toFixed(3):''}" title="Synchronized with the Packing List" readonly></td><td><input class="docedit" type="number" value="${x.qty}" onchange="editLineDoc(${i},'qty',this.value)"></td><td><input class="docedit" type="number" step=".01" value="${x.unitBRL}" onchange="editLineDoc(${i},'unitBRL',this.value)"></td><td><input class="docedit unitprice" type="number" step=".0001" value="${+S.fx||hasUnitOverride(x)?unitUSD(x).toFixed(4):''}" onchange="editLineUSD(${i},this.value)"><button class="linkbtn unitmode" onclick="resetLineUSD(${i})">${hasUnitOverride(x)?'Manual · usar câmbio':'Automático pelo câmbio'}</button></td><td>${+S.fx||hasUnitOverride(x)?usd(lineUSD(x)):'—'}</td></tr>`}).join('')}
  </table>
  <table class="charges"><tr><td>Goods Value</td><td>${+S.fx?usd(goods):'—'}</td></tr><tr><td>Freight</td><td><input class="docedit" type="number" step=".01" value="${esc(S.freightUSD)}" onchange="editRoot('freightUSD',this.value)"></td></tr><tr><td>Insurance</td><td><input class="docedit" type="number" step=".01" value="${esc(S.insuranceUSD)}" onchange="editRoot('insuranceUSD',this.value)"></td></tr><tr><td>Other Charges</td><td><input class="docedit" type="number" step=".01" value="${esc(S.otherUSD)}" onchange="editRoot('otherUSD',this.value)"></td></tr><tr><td>TOTAL</td><td><b>${+S.fx?usd(final):'—'}</b></td></tr></table>
  <div class="docnote"><b>DECLARATION / NOTES</b><textarea class="docedit docarea" onchange="editRoot('declaration',this.value)">${esc(S.declaration)}</textarea></div>
  <div class="docnote"><b>BANK DETAILS</b><input class="docedit" value="${esc([S.exporter.bank,S.exporter.swift&&'SWIFT '+S.exporter.swift,S.exporter.account].filter(Boolean).join(' · '))}" readonly></div></div>`;

  const packRows=S.packs.map((x,i)=>`<tr><td>${esc(x.box)}</td><td>${esc(x.description||it.map(y=>y.description).join(' / '))}</td><td>${esc(x.qty)}</td><td>${esc(x.length)}</td><td>${esc(x.width)}</td><td>${esc(x.height)}</td><td>${((+x.length*+x.width*+x.height)/1e6).toFixed(3)}</td><td>${esc(x.net)}</td><td>${esc(x.gross)}</td></tr>`).join('');
  packingView.innerHTML=`<div class="editbar"><div><strong>Dados conectados à Invoice</strong><br><span>Cliente, PO, data, Incoterm e descrições acompanham a Invoice. Caixas e pesos vêm da Expedição.</span></div><button class="linkbtn" onclick="show('invoice')">Voltar à Invoice</button></div>
  <div class="paper"><div class="dochead"><img src="central-mesh-logo.png"><div class="doctype">PACKING LIST</div></div>
  <div class="parties">${editableParty('SHIPPER','exporter',S.exporter)}${editableParty('CONSIGNEE','client',c)}</div>
  <div class="docmeta">${docField('PACKING NUMBER','invoiceNo',S.invoiceNo)}${docField('ISSUE DATE','invoiceDate',S.invoiceDate,'date')}${docField('PO','poDisplay',S.poDisplay||po)}${docField('INCOTERM','incoterm',S.incoterm)}</div>
  <table><tr><th>Box Number</th><th>Description / Marks</th><th>Qty.</th><th>Length cm</th><th>Width cm</th><th>Height cm</th><th>CBM</th><th>Net kg</th><th>Gross kg</th></tr>${packRows}</table>
  <div class="total">PACKAGES ${S.packs.length} · NET ${S.packs.reduce((a,x)=>a+(+x.net||0),0).toFixed(3)} KG · GROSS ${S.packs.reduce((a,x)=>a+(+x.gross||0),0).toFixed(3)} KG</div>
  <div class="docnote"><b>MARKS / SHIPPING NOTES</b><textarea class="docedit docarea" onchange="editRoot('packNotes',this.value)">${esc(S.packNotes)}</textarea></div></div>`;
}
const baseRenderPackEditor=renderPackEditor;
renderPackEditor=function(){
  baseRenderPackEditor();
  packEditor.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{quietSave();renderDocs()}));
};
const baseParseOrder=parseOrder;
parseOrder=function(lines,file){
  const parsed=baseParseOrder(lines,file);
  const text=lines.join('\n');
  parsed.order=(text.match(/Pedido[\s\S]{0,90}?\b(\d{6})\b/i)||[])[1]
    || (file.name.match(/(\d{6})/)||[])[1]
    || parsed.order;
  return parsed;
};
const baseDownloadExcel=downloadExcel;
downloadExcel=async function(){
  const empty=S.packs.filter(x=>!x.description);
  empty.forEach(x=>x.description=connectedDescription());
  try{await baseDownloadExcel()}finally{empty.forEach(x=>x.description='')}
};
const baseDownloadPDF=downloadPDF;
downloadPDF=async function(){
  const empty=S.packs.filter(x=>!x.description);
  empty.forEach(x=>x.description=connectedDescription());
  try{await baseDownloadPDF()}finally{empty.forEach(x=>x.description='')}
};
render();
