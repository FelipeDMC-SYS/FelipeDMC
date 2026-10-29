import {parseCoordinateOCR,parseCoordinateText,normalizeCoordinate,validPoint,exportPoints} from './coordinates.mjs';
import {imageCanvas,loadImage,createOCRWorker} from './imaging.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`,uid=()=>crypto.randomUUID();
let rows=[],sourceMode='image',isDemo=true,imageURL='./assets/coordenadas-ejemplo.png',blobURL=null,rotation=0,zoom=100,busy=false,runId=0,worker=null,lastOCR=null,lastText='',needsOrder=false,warnings=[],timer;
const demoData=[['1','586986.0588','2235977.7607'],['2','587031.4698','2235971.2457'],['3','587037.4478','2235960.8367'],['4','587030.7535','2235957.1241'],['5','587024.7702','2235955.0823'],['6','587011.5917','2235950.7623'],['7','586991.7600','2235943.8542'],['8','586978.1767','2235955.9251'],['9','586982.8924','2235968.6044'],['1','586986.0588','2235977.7607']];
function toast(message,error=false){clearTimeout(timer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;timer=setTimeout(()=>$('toast').hidden=true,4500);}
function result(){return exportPoints(rows,{omitClosing:$('omitClosing').checked,spaces:$('commaSpaces').checked});}
function renderOutput(){
  const r=result(),invalid=r.rows.some(p=>!validPoint(p)),pending=r.rows.filter(p=>!p.reviewed).length;
  $('formattedOutput').textContent=rows.length?r.text:'Aquí aparecerán tus puntos en formato:\n\npunto, X, Y';
  $('copyBtn').disabled=!r.rows.length||invalid||needsOrder;$('downloadBtn').disabled=$('copyBtn').disabled;
  $('pointCount').textContent=`${r.rows.length} puntos`;$('rowCount').textContent=rows.length;
  $('characterCount').textContent=rows.length?`${r.rows.length} filas`:'';
  $('closingStatus').textContent=r.omitted?'Se omite la última fila: repite el punto y las coordenadas de inicio.':rows.length?'Se conservan todas las filas.':'';
  $('reviewProgress').textContent=`${rows.filter(p=>p.reviewed).length} de ${rows.length} revisados`;
  $('reviewNotice').className='review-notice'+(!isDemo&&(needsOrder||invalid||pending||warnings.length)?' pending':rows.length&&!isDemo?' complete':'');
  $('noticeText').textContent=isDemo?'Tabla de ejemplo. Sube tu imagen para extraer tus puntos.':needsOrder?'No se pudo determinar el orden X/Y. Selecciónalo en «Columnas en la imagen».':invalid?'Hay datos incompletos. Corrígelos en Revisar puntos para poder exportar.':!rows.length?(warnings[0]||'Carga y analiza una tabla para comenzar.'):pending?`${r.rows.length} puntos detectados · ${pending} por revisar. Comprueba cada cifra antes de importar.`:'Todos los puntos de salida están marcados como revisados.';
}
function renderEditor(){
  $('rowsEditor').innerHTML=rows.map((r,i)=>`<div class="coordinate-edit ${r.reviewed?'reviewed':''}" data-row="${r.id}"><div class="coordinate-fields"><input data-field="point" value="${esc(r.point)}" inputmode="numeric" class="${/^\d+$/.test(r.point)?'':'invalid'}" placeholder="Punto" aria-label="Número de punto, fila ${i+1}"><input data-field="x" value="${esc(r.x)}" inputmode="decimal" class="${normalizeCoordinate(r.x)?'':'invalid'}" placeholder="X" aria-label="Coordenada X, fila ${i+1}"><input data-field="y" value="${esc(r.y)}" inputmode="decimal" class="${normalizeCoordinate(r.y)?'':'invalid'}" placeholder="Y" aria-label="Coordenada Y, fila ${i+1}"><button class="icon-button" data-delete="${r.id}" aria-label="Eliminar fila ${i+1}">${icon('trash')}</button></div><div class="row-meta"><span>Fila ${i+1}${i===rows.length-1&&result().omitted?' · cierre repetido':''}</span><label><input type="checkbox" data-field="reviewed" ${r.reviewed?'checked':''}> Revisado</label></div></div>`).join('');
}
function render(){renderOutput();renderEditor();}
function setView(review){$('descriptionView').hidden=review;$('reviewView').hidden=!review;for(const [id,on] of [['resultTab',!review],['reviewTab',review]]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-selected',on);}}
function setSource(mode){sourceMode=mode;$('imageSource').hidden=mode!=='image';$('textSource').hidden=mode!=='text';for(const [id,on] of [['imageTab',mode==='image'],['textTab',mode==='text']]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-selected',on);}$('analyzeBtn').querySelector('span').textContent=mode==='image'?'Extraer coordenadas':'Leer coordenadas del texto';}
function resetZoom(){zoom=100;$('preview').style.width='100%';$('zoomLabel').textContent='100%';$('imageStage').scrollTo(0,0);}
function clear(){rows=[];lastOCR=null;lastText='';needsOrder=false;warnings=[];$('rawText').value='';$('columnStatus').textContent='La salida siempre será punto, X, Y.';render();}
async function loadFile(file){
  if(busy)return toast('Espera a que termine la lectura o cancélala.');
  if(!/^image\/(png|jpe?g|webp|bmp)$/i.test(file.type))return toast('Usa una imagen PNG, JPG, WEBP o BMP.',true);
  if(file.size>20*1024*1024)return toast('La imagen supera los 20 MB.',true);
  const next=URL.createObjectURL(file);try{await loadImage(next);}catch{URL.revokeObjectURL(next);return toast('No se pudo abrir la imagen.',true);}
  if(blobURL)URL.revokeObjectURL(blobURL);blobURL=next;imageURL=next;rotation=0;isDemo=false;
  $('preview').src=imageURL;$('preview').alt='Tabla cargada para extraer coordenadas';$('fileName').textContent=file.name;$('previewCaption').textContent='TU DOCUMENTO';$('sourceBadge').textContent='IMAGEN CARGADA';$('sourceBadge').classList.add('own');$('analysisStatus').textContent='Imagen lista. Pulsa Extraer coordenadas.';$('analysisStatus').classList.remove('error');$('fileInput').value='';resetZoom();setSource('image');clear();setView(false);
}
function demo(){if(busy)return;clear();isDemo=true;imageURL='./assets/coordenadas-ejemplo.png';rotation=0;$('preview').src=imageURL;$('fileName').textContent='tabla-de-coordenadas.png';$('previewCaption').textContent='VISTA DE EJEMPLO';$('sourceBadge').textContent='EJEMPLO';$('sourceBadge').classList.remove('own');rows=demoData.map(([point,x,y])=>({id:uid(),point,x,y,reviewed:false}));$('analysisStatus').textContent='La lectura es local. Tu imagen no se envía a un servidor.';$('analysisStatus').classList.remove('error');$('columnStatus').textContent='El ejemplo muestra Y, X. La salida está ordenada como X, Y.';setSource('image');resetZoom();setView(false);render();}
function setBusy(on){busy=on;for(const id of ['analyzeBtn','uploadBtn','rotateBtn','columnOrder','imageTab','textTab','demoBtn'])$(id).disabled=on;$('cancelBtn').hidden=!on;$('progressTrack').hidden=!on;$('imageStage').classList.toggle('scanning',on&&sourceMode==='image');}
function progress(p,text){$('progressFill').style.width=p+'%';$('analysisStatus').textContent=text;}
function applyResult(r){rows=r.rows.map(p=>({...p,id:uid()}));needsOrder=!!r.needsOrder;warnings=r.warnings||[];isDemo=false;$('sourceBadge').textContent='LECTURA TERMINADA';$('sourceBadge').classList.add('own');$('columnStatus').textContent=r.order?`${r.autoDetected?'Encabezados detectados':'Orden seleccionado'}: punto, ${r.order==='yx'?'Y, X':'X, Y'} → salida: punto, X, Y.`:'Selecciona el orden de las columnas para continuar.';render();setView(false);}
async function analyze(){
  if(busy)return;const run=++runId;let active;setBusy(true);$('analysisStatus').classList.remove('error');
  try{
    if(sourceMode==='text'){const text=$('sourceText').value.trim();if(!text)throw new Error('Pega primero una tabla de coordenadas.');clear();lastText=text;applyResult(parseCoordinateText(text,{order:$('columnOrder').value}));$('rawText').value=text;progress(100,'Texto leído. Revisa los valores y el orden de las columnas.');return;}
    clear();progress(3,'Preparando la tabla…');const gray=await imageCanvas(imageURL,rotation,{preprocess:true});if(run!==runId)return;const ink=await imageCanvas(imageURL,rotation,{preprocess:true,ink:true});if(run!==runId)return;
    let phase=0;active=await createOCRWorker(m=>{if(run!==runId)return;if(m.status==='recognizing text')progress(25+phase*23+(m.progress||0)*22,['Leyendo coordenadas…','Identificando encabezados X/Y…','Leyendo números de punto…'][phase]);else progress(8+(m.progress||0)*15,'Preparando el motor de lectura…');});
    if(run!==runId){await active.terminate();return;}worker=active;
    await active.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
    const primary=await active.recognize(gray,{}, {text:true,blocks:true});if(run!==runId)return;
    phase=1;const headers=await active.recognize(ink,{}, {text:true,blocks:true});if(run!==runId)return;
    phase=2;await active.setParameters({tessedit_pageseg_mode:'6'});const labels=await active.recognize(ink,{}, {text:true,blocks:true});if(run!==runId)return;
    lastOCR={...primary.data,auxiliary:[headers.data,labels.data]};applyResult(parseCoordinateOCR(lastOCR,{order:$('columnOrder').value}));$('rawText').value=primary.data.text+'\n\n— Encabezados y números de punto —\n'+labels.data.text;
    progress(100,needsOrder?'Selecciona el orden de las columnas para completar la lectura.':`${result().rows.length} puntos preparados. Revisa los valores antes de importar.`);
    if(rows.length)toast('Coordenadas extraídas. Revisa cada cifra.');else toast(needsOrder?'Selecciona el orden X/Y de la imagen.':'No se encontraron filas completas. Prueba una imagen más nítida.',true);
  }catch(error){if(run===runId){$('analysisStatus').textContent=error.message||'No se pudo leer la tabla.';$('analysisStatus').classList.add('error');toast($('analysisStatus').textContent,true);}}
  finally{if(active)try{await active.terminate();}catch{}if(run===runId){worker=null;setBusy(false);}}
}
$('uploadBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>{if(e.target.files[0])loadFile(e.target.files[0]);};
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('drag-over');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');});
$('dropzone').addEventListener('drop',e=>{if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);});
window.addEventListener('paste',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const f=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(f){e.preventDefault();loadFile(f);}});
$('imageTab').onclick=()=>setSource('image');$('textTab').onclick=()=>setSource('text');$('resultTab').onclick=()=>setView(false);$('reviewTab').onclick=()=>setView(true);$('demoBtn').onclick=demo;$('analyzeBtn').onclick=analyze;
$('cancelBtn').onclick=async()=>{runId++;const active=worker;worker=null;setBusy(false);$('analysisStatus').textContent='Lectura cancelada.';if(active)try{await active.terminate();}catch{}};
$('rotateBtn').onclick=async()=>{rotation=(rotation+90)%360;try{$('preview').src=(await imageCanvas(imageURL,rotation)).toDataURL('image/png');resetZoom();}catch{toast('No se pudo girar la imagen.',true);}};
function zoomBy(n){zoom=Math.max(100,Math.min(300,zoom+n));$('preview').style.width=zoom+'%';$('zoomLabel').textContent=zoom+'%';}$('zoomIn').onclick=()=>zoomBy(25);$('zoomOut').onclick=()=>zoomBy(-25);
$('columnOrder').onchange=()=>{if(lastOCR&&sourceMode==='image')applyResult(parseCoordinateOCR(lastOCR,{order:$('columnOrder').value}));else if(lastText&&sourceMode==='text')applyResult(parseCoordinateText(lastText,{order:$('columnOrder').value}));};
$('omitClosing').onchange=render;$('commaSpaces').onchange=renderOutput;
function edit(e){const field=e.target.dataset.field;if(!field)return;const el=e.target.closest('[data-row]'),r=rows.find(r=>r.id===el.dataset.row);if(!r)return;r[field]=field==='reviewed'?e.target.checked:e.target.value;if(field!=='reviewed'){r.reviewed=false;el.querySelector('[data-field="reviewed"]').checked=false;e.target.classList.toggle('invalid',field==='point'?!/^\d+$/.test(r.point):!normalizeCoordinate(r[field]));}else if(r.reviewed&&!validPoint(r)){r.reviewed=false;e.target.checked=false;toast('Completa el número de punto y sus dos coordenadas.',true);}el.classList.toggle('reviewed',r.reviewed);renderOutput();}
$('rowsEditor').addEventListener('input',e=>{if(e.target.tagName==='INPUT'&&e.target.type!=='checkbox')edit(e);});$('rowsEditor').addEventListener('change',e=>{if(e.target.type==='checkbox')edit(e);});
$('rowsEditor').addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;rows=rows.filter(r=>r.id!==b.dataset.delete);render();});
$('addRowBtn').onclick=()=>{const id=uid();rows.push({id,point:'',x:'',y:'',reviewed:false});isDemo=false;needsOrder=false;render();$('rowsEditor').querySelector(`[data-row="${id}"] input`).focus();};
$('swapBtn').onclick=()=>{rows=rows.map(r=>({...r,x:r.y,y:r.x,reviewed:false}));$('columnStatus').textContent='X e Y intercambiadas manualmente. Revisa las columnas de la imagen.';render();toast('X e Y intercambiadas.');};
$('reviewAllBtn').onclick=()=>{rows.forEach(r=>r.reviewed=validPoint(r));render();toast(rows.every(r=>r.reviewed)?'Puntos marcados como revisados.':'Hay filas incompletas por corregir.');};
$('copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText(result().text);}catch{const t=document.createElement('textarea');t.value=result().text;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)return toast('No se pudo copiar. Selecciona el texto del resultado.',true);}toast('Coordenadas copiadas.');};
$('downloadBtn').onclick=()=>{const b=new Blob([result().text+'\r\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='coordenadas.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('useRawBtn').onclick=()=>{if(!$('rawText').value)return toast('Analiza una imagen primero.');$('sourceText').value=$('rawText').value;setSource('text');$('sourceText').focus();};
$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('helpDialog').onclick=e=>{if(e.target===$('helpDialog')){const b=$('helpDialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('helpDialog').close();}};
demo();
