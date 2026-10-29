export function normalizeCoordinate(value) {
  let s=String(value??'').trim().replace(/\s/g,'').replace(/[−–]/g,'-');
  if(!/^[+-]?\d[\d.,]*$/.test(s))return '';
  if(s.includes('.')&&s.includes(','))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')){
    const parts=s.split(',');
    // A single comma followed by three digits is ambiguous: keep it as decimal.
    // Multiple groups of three are unambiguous thousands separators.
    s=parts.length>2&&parts.slice(1).every(p=>p.length===3)?parts.join(''):s.replace(',','.');
  }
  return /^[+-]?\d+(?:\.\d+)?$/.test(s)?s:'';
}
export function validPoint(r){return /^\d+$/.test(String(r.point??'').trim())&&!!normalizeCoordinate(r.x)&&!!normalizeCoordinate(r.y);}
export function exportPoints(rows,{omitClosing=true,spaces=true}={}){
  const list=[...rows];let omitted=false;
  if(omitClosing&&list.length>1){const first=list[0],last=list.at(-1);if(validPoint(first)&&validPoint(last)&&String(first.point).trim()===String(last.point).trim()&&Number(normalizeCoordinate(first.x))===Number(normalizeCoordinate(last.x))&&Number(normalizeCoordinate(first.y))===Number(normalizeCoordinate(last.y))){list.pop();omitted=true;}}
  const separator=spaces?', ':',';
  return {rows:list,omitted,text:list.map(r=>[r.point,normalizeCoordinate(r.x),normalizeCoordinate(r.y)].join(separator)).join('\n')};
}
function words(data,priority=0){return (data?.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>(l.words||[]).map(w=>({...w,priority})))));}
const midX=w=>(w.bbox.x0+w.bbox.x1)/2,midY=w=>(w.bbox.y0+w.bbox.y1)/2;
const headerText=w=>w.text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z]/g,'');
function detectHeaders(all){
  const xs=all.filter(w=>['X','XX','ESTE','EASTING'].includes(headerText(w)));
  const ys=all.filter(w=>['Y','YY','NORTE','NORTHING'].includes(headerText(w)));
  const pairs=xs.flatMap(x=>ys.map(y=>({x,y,dy:Math.abs(midY(x)-midY(y))}))).filter(p=>p.dy<Math.max(p.x.bbox.y1-p.x.bbox.y0,p.y.bbox.y1-p.y.bbox.y0)*2&&Math.abs(midX(p.x)-midX(p.y))>20).sort((a,b)=>a.dy-b.dy||midY(a.x)-midY(b.x));
  if(!pairs.length)return null;
  const pair=pairs[0];const points=all.filter(w=>['V','VERTICE','PUNTO','PTO','PT','NO','NUM','NUMERO'].includes(headerText(w))&&midX(w)<Math.min(midX(pair.x),midX(pair.y))&&Math.abs(midY(w)-midY(pair.x))<Math.max(90,(pair.x.bbox.y1-pair.x.bbox.y0)*5));
  return {x:midX(pair.x),y:midX(pair.y),top:Math.max(pair.x.bbox.y1,pair.y.bbox.y1),point:points.length?midX(points.sort((a,b)=>b.priority-a.priority)[0]):null};
}
function clusterValues(primary){
  const candidates=primary.filter(w=>normalizeCoordinate(w.text));
  const groups=[];
  for(const w of candidates.sort((a,b)=>midY(a)-midY(b)||midX(a)-midX(b))){const height=w.bbox.y1-w.bbox.y0;let g=groups.find(g=>Math.abs(g.cy-midY(w))<Math.max(height,g.height)*.65);if(!g){g={cy:midY(w),height,words:[]};groups.push(g);}g.words.push(w);}
  return groups.filter(g=>g.words.length>=2).sort((a,b)=>a.cy-b.cy);
}
export function parseCoordinateOCR(data,{order='auto'}={}){
  const primary=words(data),all=[...primary,...(data.auxiliary||[]).flatMap((d,i)=>words(d,i+1))];
  let headers=detectHeaders(all);const autoDetected=!!headers;
  if(!headers&&order==='auto')return {rows:[],needsOrder:true,order:null,warnings:['No se pudieron leer los encabezados X/Y. Selecciona su orden en la imagen y vuelve a revisar.']};
  let groups=clusterValues(primary);
  if(!headers){
    const positions=groups.flatMap(g=>g.words.slice().sort((a,b)=>midX(a)-midX(b)).slice(-2).map(midX)).sort((a,b)=>a-b);
    if(!positions.length)return {rows:[],needsOrder:false,warnings:['No se detectaron filas de coordenadas. Intenta con una imagen más nítida.']};
    const split=positions.slice(1).reduce((best,x,i)=>x-positions[i]>best.gap?{gap:x-positions[i],idx:i+1}:best,{gap:-1,idx:0});
    const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
    const left=mean(positions.slice(0,split.idx)),right=mean(positions.slice(split.idx));
    headers={x:order==='yx'?right:left,y:order==='yx'?left:right,top:-1,point:null};
  }else if(order!=='auto'){
    const left=Math.min(headers.x,headers.y),right=Math.max(headers.x,headers.y);headers.x=order==='yx'?right:left;headers.y=order==='yx'?left:right;
  }
  const gap=Math.abs(headers.x-headers.y),boundary=(headers.x+headers.y)/2,left=Math.min(headers.x,headers.y);
  const rows=[];
  for(const g of groups){
    if(g.cy<headers.top)continue;
    const candidates=g.words.filter(w=>midX(w)>left-gap*.55);
    const pick=axis=>{const parts=candidates.filter(w=>(headers[axis]<boundary?midX(w)<boundary:midX(w)>boundary)).sort((a,b)=>a.bbox.x0-b.bbox.x0);return parts.length?{text:parts.map(w=>w.text).join('')}:undefined;};
    const x=pick('x'),y=pick('y');if(!x&&!y)continue;
    const ids=all.filter(w=>/^\d{1,6}$/.test(w.text.trim())&&Math.abs(midY(w)-g.cy)<g.height*.7&&midX(w)<left-gap*.4);
    ids.sort((a,b)=>headers.point!==null?Math.abs(midX(a)-headers.point)-Math.abs(midX(b)-headers.point)||a.priority-b.priority:midX(b)-midX(a)||a.priority-b.priority);
    rows.push({point:ids[0]?.text.trim()||'',x:normalizeCoordinate(x?.text),y:normalizeCoordinate(y?.text),reviewed:false,source:[ids[0]?.text,y?.text,x?.text].filter(Boolean).join(' | ')});
  }
  return {rows,needsOrder:false,order:headers.x>headers.y?'yx':'xy',autoDetected,warnings:rows.some(r=>!validPoint(r))?['Hay filas incompletas. Completa los campos señalados antes de exportar.']:[]};
}
export function parseCoordinateText(text,{order='auto'}={}){
  const lines=String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);let actual=order,autoDetected=false;const rows=[];
  const header=lines.find(l=>/\b(?:X|ESTE)\b/i.test(l)&&/\b(?:Y|NORTE)\b/i.test(l));
  if(header&&order==='auto'){actual=header.search(/\b(?:X|ESTE)\b/i)<header.search(/\b(?:Y|NORTE)\b/i)?'xy':'yx';autoDetected=true;}
  if(actual==='auto')return {rows:[],needsOrder:true,order:null,warnings:['Selecciona si el texto está en orden punto, X, Y o punto, Y, X.']};
  for(const line of lines){
    if(line===header)continue;
    let cells=line.split(/\t+|;\s*|,\s+/).map(s=>s.trim()).filter(Boolean);
    if(cells.length<3)cells=line.split(/\s+/);
    if(cells.length<3&&/^\d+,[+-]?\d+(?:\.\d+)?,[+-]?\d+(?:\.\d+)?$/.test(line))cells=line.split(',');
    if(cells.length<3)continue;
    const a=normalizeCoordinate(cells.at(-2)),b=normalizeCoordinate(cells.at(-1));
    const point=cells.at(-3);if(!a||!b||!/^\d+$/.test(point))continue;
    rows.push({point,x:actual==='xy'?a:b,y:actual==='xy'?b:a,reviewed:false,source:line});
  }
  return {rows,needsOrder:false,order:actual,autoDetected,warnings:[]};
}
