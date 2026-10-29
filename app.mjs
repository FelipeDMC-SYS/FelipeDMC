import {imageCanvas} from './imaging.mjs';
import {DIRECTIONS,parseOCR,parseText,parseDistance,formatResult} from './parser.mjs';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrows={NORTE:'↑',ORIENTE:'→',SUR:'↓',PONIENTE:'←',NORESTE:'↗',SURESTE:'↘',SUROESTE:'↙',NOROESTE:'↖'};
let rows=[],unresolved=[],letterCase='normal',sourceMode='image',isDemo=true,zoom=100,rotation=0,busy=false,runId=0,activeWorker=null,currentBlobURL=null,imageURL='./assets/ejemplo.png',toastTimer;
const demoRows=[['NORTE','68.87','Margarita López Soltero'],['PONIENTE','223.13','Jorge Brambila López'],['NORTE','47.39','la Fracción 1'],['ORIENTE','216.69','Jorge Brambila López'],['SUR','85.13','Oscar Rodríguez']];
const uid=()=>crypto.randomUUID();
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function output(){return formatResult(rows,{letterCase,separator:$('separator').value,precision:$('precision').value});}
function renderOutput(){
  const content=output();$('copyBtn').disabled=!rows.length;$('downloadBtn').disabled=!rows.length;
  if(!rows.length)$('formattedOutput').innerHTML='<p class="empty">Aquí aparecerá la descripción de tu imagen, en el orden de lectura del documento.</p>';
  else if($('separator').value==='paragraph')$('formattedOutput').textContent=content;
  else $('formattedOutput').innerHTML=content.split('\n').map(line=>{const pos=line.indexOf(':');return `<p><strong>${esc(line.slice(0,pos+1))}</strong>${esc(line.slice(pos+1))}</p>`;}).join('');
  $('characterCount').textContent=rows.length?`${content.length} caracteres`:'';
  $('rowCount').textContent=rows.length;
  $('windCount').textContent=`${new Set(rows.map(r=>r.direction)).size} vientos`;
  const pending=rows.filter(r=>!r.reviewed).length;
  const missing=unresolved.filter(u=>u.direction).map(u=>u.direction);
  const invalid=rows.filter(r=>!parseDistance(r.distance)||!r.name.trim()).length;
  $('reviewProgress').textContent=`${rows.length-pending} de ${rows.length} revisados`;
  $('reviewNotice').className='review-notice'+(!isDemo&&rows.length?(pending||invalid||missing.length?' pending':' complete'):'');
  $('noticeText').textContent=isDemo?'Resultado de ejemplo. Sube tu imagen para obtener tus colindantes.':!rows.length?'Carga y analiza tu imagen para comenzar.':(pending||invalid||missing.length)?`${pending} tramo${pending===1?'':'s'} por revisar.${invalid?' Hay datos incompletos.':''}${missing.length?' Texto por completar: '+missing.join(', ').toLowerCase()+'.':''}`:'Todos los tramos están marcados como revisados.';
  $('unresolvedBox').hidden=!unresolved.length;
  $('unresolvedText').textContent=unresolved.map(u=>(u.direction?u.direction+': ':'')+u.text).join('\n');
}
function renderEditor(){
  $('rowsEditor').innerHTML=[...new Set(rows.map(r=>r.direction))].map(d=>{
    const group=rows.filter(r=>r.direction===d);
    return `<div class="direction-group"><h3 class="direction-heading"><span class="direction-arrow">${arrows[d]}</span>AL ${d}<small>${group.length} tramo${group.length===1?'':'s'}</small></h3>${group.map(r=>`<div class="edit-row ${r.reviewed?'reviewed':''}" data-row="${r.id}"><div class="row-fields"><label>Medida (m)<input data-field="distance" class="${parseDistance(r.distance)?'':'invalid'}" inputmode="decimal" value="${esc(r.distance)}" placeholder="0.00" aria-label="Medida en metros, ${esc(d)}"></label><label>Colindante<input data-field="name" class="${r.name.trim()?'':'invalid'}" value="${esc(r.name)}" placeholder="Nombre o descripción" aria-label="Colindante, ${esc(d)}"></label><button class="icon-button" data-delete="${r.id}" title="Eliminar tramo" aria-label="Eliminar tramo">${icon('trash')}</button></div><div class="row-meta"><select data-field="direction" aria-label="Viento del tramo">${DIRECTIONS.map(v=>`<option ${v===r.direction?'selected':''}>${v}</option>`).join('')}</select><label><input type="checkbox" data-field="reviewed" ${r.reviewed?'checked':''}> Revisado</label></div>${r.source?`<details><summary>Ver texto de origen${r.confidence?' · lectura '+Math.round(r.confidence)+'%':''}</summary><p>${esc(r.source)}</p></details>`:''}</div>`).join('')}</div>`;
  }).join('');
}
function render(){renderOutput();renderEditor();}
function setView(review){$('descriptionView').hidden=review;$('reviewView').hidden=!review;for(const [id,active] of [['resultTab',!review],['reviewTab',review]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',active);}}
function setSource(mode){sourceMode=mode;$('imageSource').hidden=mode!=='image';$('textSource').hidden=mode!=='text';$('imageTab').classList.toggle('active',mode==='image');$('textTab').classList.toggle('active',mode==='text');$('imageTab').setAttribute('aria-selected',mode==='image');$('textTab').setAttribute('aria-selected',mode==='text');$('analyzeBtn').querySelector('span').textContent=mode==='image'?'Analizar imagen':'Analizar texto';}
function clearResults(){rows=[];unresolved=[];$('rawText').value='';render();}
function resetZoom(){zoom=100;$('preview').style.width='100%';$('zoomLabel').textContent='100%';$('imageStage').scrollTo(0,0);}
async function loadFile(file){
  if(busy)return toast('Espera a que termine la lectura o cancélala.');
  if(!/^image\/(png|jpe?g|webp|bmp)$/i.test(file.type))return toast('Selecciona una imagen PNG, JPG, WEBP o BMP.',true);
  if(file.size>20*1024*1024)return toast('La imagen supera 20 MB. Reduce su tamaño e inténtalo de nuevo.',true);
  const next=URL.createObjectURL(file);
  try{await loadImage(next);}catch{URL.revokeObjectURL(next);return toast('No se pudo abrir esta imagen.',true);}
  if(currentBlobURL)URL.revokeObjectURL(currentBlobURL);currentBlobURL=next;imageURL=next;rotation=0;isDemo=false;
  $('preview').src=imageURL;$('preview').alt='Imagen cargada para extraer colindantes';$('fileName').textContent=file.name;
  $('sourceBadge').textContent='IMAGEN CARGADA';$('sourceBadge').classList.add('own');$('previewCaption').textContent='TU DOCUMENTO';
  $('analysisStatus').textContent='Imagen lista. Pulsa Analizar imagen para leerla.';$('analysisStatus').classList.remove('error');
  resetZoom();setSource('image');clearResults();setView(false);$('fileInput').value='';
}
function demo(){if(busy)return;isDemo=true;imageURL='./assets/ejemplo.png';rotation=0;$('preview').src=imageURL;$('preview').alt='Plano de ejemplo con medidas y colindantes en cada viento';$('fileName').textContent='plano-de-ejemplo.png';$('previewCaption').textContent='VISTA DE EJEMPLO';$('sourceBadge').textContent='EJEMPLO';$('sourceBadge').classList.remove('own');rows=demoRows.map(([direction,distance,name])=>({id:uid(),direction,distance,name,reviewed:false,source:'Ejemplo de formato. Pulsa Analizar imagen para probar la lectura OCR.'}));unresolved=[];$('rawText').value='';$('analysisStatus').textContent='La lectura es local. Tu imagen no se envía a un servidor.';$('analysisStatus').classList.remove('error');setSource('image');resetZoom();setView(false);render();}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});}
async function makeCanvas(preprocess=false){return imageCanvas(imageURL,rotation,{preprocess});}
let scriptPromise;
function loadOCR(){if(window.Tesseract)return Promise.resolve();if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./assets/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();scriptPromise=null;reject(new Error('No se pudo cargar el motor. Comprueba tu conexión y vuelve a intentarlo.'));};document.head.append(s);});return scriptPromise;}
function setBusy(value){busy=value;$('analyzeBtn').disabled=value;$('uploadBtn').disabled=value;$('rotateBtn').disabled=value;$('readMode').disabled=value;$('imageTab').disabled=value;$('textTab').disabled=value;$('demoBtn').disabled=value;$('cancelBtn').hidden=!value;$('progressTrack').hidden=!value;$('imageStage').classList.toggle('scanning',value&&sourceMode==='image');}
function progress(percent,message){$('progressFill').style.width=Math.max(0,Math.min(100,percent))+'%';$('analysisStatus').textContent=message;}
function applyResults(result,text){rows=result.rows.map(r=>({...r,id:uid()}));unresolved=result.unresolved;$('rawText').value=text;isDemo=false;$('sourceBadge').textContent=sourceMode==='image'?'IMAGEN LEÍDA':'TEXTO LEÍDO';$('sourceBadge').classList.add('own');render();setView(false);if(rows.length)toast(`${rows.length} tramos detectados. Revisa nombres y medidas.`);else{setView(true);toast('No se detectaron tramos completos. Revisa el texto o agrégalos manualmente.',true);}}
async function analyze(){
  if(busy)return;const run=++runId;let worker;setBusy(true);$('analysisStatus').classList.remove('error');$('progressFill').style.width='0';
  try {
    if(sourceMode==='text'){
      const text=$('sourceText').value.trim();if(!text)throw new Error('Pega primero un texto con las colindancias.');applyResults(parseText(text),text);progress(100,'Texto analizado. Comprueba los datos antes de copiar.');return;
    }
    clearResults();progress(2,'Preparando la imagen…');const canvas=await makeCanvas(true);if(run!==runId)return;
    progress(5,'Cargando el motor de lectura. La primera vez puede tardar…');await loadOCR();if(run!==runId)return;
    worker=await Tesseract.createWorker('spa',1,{workerPath:new URL('./assets/worker.min.js',import.meta.url).href,corePath:new URL('./assets',import.meta.url).href,langPath:new URL('./assets',import.meta.url).href,workerBlobURL:false,logger:m=>{if(run!==runId)return;const status=m.status==='recognizing text'?'Leyendo texto y medidas':m.status?.includes('language')?'Cargando el idioma español':'Preparando el motor de lectura';progress(m.status==='recognizing text'?30+(m.progress||0)*62:8+(m.progress||0)*20,`${status}… ${Math.round((m.progress||0)*100)}%`);},errorHandler:()=>{}});
    if(run!==runId){await worker.terminate();return;}activeWorker=worker;
    await worker.setParameters({tessedit_pageseg_mode:$('readMode').value==='plan'?'11':'3',preserve_interword_spaces:'1'});
    const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});if(run!==runId)return;
    progress(95,'Agrupando los tramos por viento…');data.layout=$('readMode').value;const result=parseOCR(data);applyResults(result,data.text||'');
    progress(100,rows.length?`Lectura terminada · ${rows.length} tramos. Revisa la información detectada.`:'No se encontraron tramos completos. Puedes completar los datos manualmente.');
  }catch(error){if(run!==runId)return;$('analysisStatus').classList.add('error');$('analysisStatus').textContent=error.message||'No se pudo analizar la imagen. Intenta con una imagen más nítida.';toast($('analysisStatus').textContent,true);}
  finally{if(worker)try{await worker.terminate();}catch{}if(run===runId){activeWorker=null;setBusy(false);}}
}
$('uploadBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>{if(e.target.files[0])loadFile(e.target.files[0]);};
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('drag-over');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');});
$('dropzone').addEventListener('drop',e=>{if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);});
window.addEventListener('paste',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const file=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();loadFile(file);}});
$('imageTab').onclick=()=>setSource('image');$('textTab').onclick=()=>setSource('text');$('resultTab').onclick=()=>setView(false);$('reviewTab').onclick=()=>setView(true);$('resolveBtn').onclick=()=>setView(true);
$('demoBtn').onclick=demo;$('analyzeBtn').onclick=analyze;
$('cancelBtn').onclick=async()=>{runId++;const worker=activeWorker;activeWorker=null;setBusy(false);$('analysisStatus').textContent='Lectura cancelada. Puedes volver a intentarlo.';if(worker)try{await worker.terminate();}catch{}};
$('rotateBtn').onclick=async()=>{rotation=(rotation+90)%360;try{const canvas=await makeCanvas();$('preview').src=canvas.toDataURL('image/png');resetZoom();}catch{toast('No se pudo girar la imagen.',true);}};
function changeZoom(delta){zoom=Math.min(300,Math.max(100,zoom+delta));$('preview').style.width=zoom+'%';$('zoomLabel').textContent=zoom+'%';}
$('zoomIn').onclick=()=>changeZoom(25);$('zoomOut').onclick=()=>changeZoom(-25);
document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{letterCase=b.dataset.case;document.querySelectorAll('[data-case]').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-pressed',el===b);});renderOutput();});
$('separator').onchange=renderOutput;$('precision').onchange=renderOutput;
function updateRow(e){const field=e.target.dataset.field;if(!field)return;const el=e.target.closest('[data-row]');const row=rows.find(r=>r.id===el.dataset.row);if(!row)return;row[field]=field==='reviewed'?e.target.checked:e.target.value;if(field==='distance'||field==='name'){row.reviewed=false;const cb=el.querySelector('[data-field="reviewed"]');cb.checked=false;e.target.classList.toggle('invalid',field==='distance'?!parseDistance(row.distance):!row.name.trim());}if(field==='reviewed'&&row.reviewed&&(!parseDistance(row.distance)||!row.name.trim())){row.reviewed=false;e.target.checked=false;toast('Completa una medida válida y el colindante antes de marcarlo.',true);}el.classList.toggle('reviewed',row.reviewed);renderOutput();if(field==='direction')renderEditor();}
$('rowsEditor').addEventListener('input',e=>{if(e.target.tagName==='INPUT'&&e.target.type!=='checkbox')updateRow(e);});
$('rowsEditor').addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.type==='checkbox')updateRow(e);});
$('rowsEditor').addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;rows=rows.filter(r=>r.id!==b.dataset.delete);render();});
$('addRowBtn').onclick=()=>{const id=uid();rows.push({id,direction:'NORTE',distance:'',name:'',reviewed:false,source:''});isDemo=false;render();setView(true);$('rowsEditor').querySelector('[data-row="'+id+'"] [data-field="distance"]')?.focus();};
$('reviewAllBtn').onclick=()=>{rows.forEach(r=>r.reviewed=!!parseDistance(r.distance)&&!!r.name.trim());render();toast(rows.every(r=>r.reviewed)?'Tramos marcados como revisados.':'Quedan tramos con datos incompletos.');};
$('copyBtn').onclick=async()=>{const text=output();try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(!ok)return toast('No se pudo copiar. Selecciona el texto de la descripción.',true);}toast('Descripción copiada.');};
$('downloadBtn').onclick=()=>{const blob=new Blob(['\ufeff'+output()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='colindantes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('useRawBtn').onclick=()=>{if(!$('rawText').value)return toast('Primero analiza una imagen.');$('sourceText').value=$('rawText').value;setSource('text');$('sourceText').focus();$('sourceText').scrollIntoView({behavior:'smooth',block:'center'});};
$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('helpDialog').onclick=e=>{if(e.target===$('helpDialog')){const r=$('helpDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('helpDialog').close();}};
demo();
