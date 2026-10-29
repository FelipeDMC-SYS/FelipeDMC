export const DIRECTIONS = ['NORTE','ORIENTE','SUR','PONIENTE','NORESTE','SURESTE','SUROESTE','NOROESTE'];
const dirSource = '(?:NORESTE|NOROESTE|NORORIENTE|NORPONIENTE|SURESTE|SUROESTE|SURORIENTE|SURPONIENTE|PONIENTE|ORIENTE|OESTE|ESTE|NORTE|SUR)';
const alias = {ESTE:'ORIENTE',OESTE:'PONIENTE',NORORIENTE:'NORESTE',NORPONIENTE:'NOROESTE',SURORIENTE:'SURESTE',SURPONIENTE:'SUROESTE'};
const dirRe = () => new RegExp('\\b(?:(?:AL|POR\\s+EL|HACIA\\s+EL)\\s+)?('+dirSource+')\\b(?=\\s*(?:[:;\\-]|$)|\\s+(?:EN\\b|MIDE\\b|CON\\b|\\d))\\s*[:;,\\-]?', 'gi');
const clean = s => String(s||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
export function parseDistance(raw) {
  let n=String(raw||'').trim().replace(/\s/g,'');
  if(n.includes(',')&&n.includes('.')) n=n.lastIndexOf(',')>n.lastIndexOf('.')?n.replace(/\./g,'').replace(',','.'):n.replace(/,/g,'');
  else if(n.includes(',')) n=n.replace(',','.');
  return /^\d+(?:\.\d+)?$/.test(n)&&Number(n)>0?n:'';
}
export function parseText(input, confidence=0) {
  const text=clean(input).replace(/\n+/g,' ').replace(/\b(NOR|SUR)[ -]+(ESTE|OESTE|ORIENTE|PONIENTE)\b/gi,'$1$2');
  const headings=[...text.matchAll(dirRe())];
  const rows=[]; const unresolved=[];
  for(let i=0;i<headings.length;i++) {
    const heading=headings[i]; const direction=alias[heading[1].toUpperCase()]||heading[1].toUpperCase();
    const body=text.slice(heading.index+heading[0].length,headings[i+1]?.index??text.length).trim();
    // Only explicit metric distances: never infer dimensions or direction from a drawing.
    const re=/(?:\bEN\s+)?(\d[\d.,]*)(?:\s*)(?:METROS?(?:\s+LINEALES)?|M(?:TS?)?\.?)(?=\s|[,;:]|$)/gi;
    const measures=[...body.matchAll(re)];
    if(!measures.length){unresolved.push({direction,text:body||heading[0]}); continue;}
    measures.forEach((m,j)=>{
      let tail=body.slice(m.index+m[0].length,measures[j+1]?.index??body.length);
      const con=tail.match(/\b(?:CON|COLINDANDO\s+CON|COLINDA\s+CON|LINDA\s+CON)\b\s*[:\-]?\s*(.*)/i);
      let name=con?con[1]:'';
      name=name.split(/(?<=[.;])\s+(?=seg[uú]n\b|conforme\b|dicha?\b|se\s+(?:encuentra|hace|desprende)|lo\s+anterior|con\s+una\s+superficie|superficie\b)/i)[0];
      name=clean(name).replace(/(?:\s+(?:Y|E)(?:\s+EN)?)\s*$/i,'').replace(/(?:\s+(?:Y|E))?\s*[,;.]\s*$/,'').trim();
      rows.push({direction,distance:parseDistance(m[1]),name,source:heading[0]+' '+body,confidence,reviewed:false});
    });
  }
  return {rows,unresolved};
}
export function linesFromBlocks(blocks) {
  const lines=[];
  for(const block of blocks||[]) for(const p of block.paragraphs||[]) for(const l of p.lines||[]) {
    const words=(l.words||[]).filter(w=>w.text?.trim()).sort((a,b)=>a.bbox.x0-b.bbox.x0);
    if(!words.length) continue;
    const height=Math.max(8,l.bbox.y1-l.bbox.y0);let group=[];
    const push=()=>{if(!group.length)return;lines.push({text:group.map(w=>w.text).join(' '),bbox:{x0:Math.min(...group.map(w=>w.bbox.x0)),y0:Math.min(...group.map(w=>w.bbox.y0)),x1:Math.max(...group.map(w=>w.bbox.x1)),y1:Math.max(...group.map(w=>w.bbox.y1))},confidence:group.reduce((s,w)=>s+w.confidence,0)/group.length});group=[];};
    for(const w of words) { if(group.length&&w.bbox.x0-group.at(-1).bbox.x1>height*2.3) push();group.push(w); } push();
  }
  return lines;
}
export function parseOCR(data) {
  const lines=linesFromBlocks(data.blocks).sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
  // A paragraph can put two labels on one line and continue a name on the next.
  // Keep that reading stream intact; spatial anchor grouping is for separate plan labels.
  const inline=lines.some(l=>[...l.text.matchAll(dirRe())].length>1);
  if(inline)return parseText(lines.map(l=>l.text).join(' '),data.confidence);
  const paragraphBlocks=(data.blocks||[]).filter(b=>{
    const text=(b.paragraphs||[]).flatMap(p=>(p.lines||[]).map(l=>l.text||l.words?.map(w=>w.text).join(' ')||'')).join(' ');
    return [...text.matchAll(dirRe())].length>1;
  });
  if(paragraphBlocks.length&&data.layout==='document')return parseText(data.text,data.confidence);
  const anchors=lines.filter(l=>dirRe().test(l.text)).map(l=>({...l,parts:[l]}));
  for(const l of lines) {
    if(dirRe().test(l.text)) continue;
    const candidates=anchors.map(a=>{
      const h=Math.max(10,a.bbox.y1-a.bbox.y0),dy=l.bbox.y0-a.bbox.y0;
      const width=a.bbox.x1-a.bbox.x0,lw=l.bbox.x1-l.bbox.x0;
      const overlap=Math.max(0,Math.min(a.bbox.x1,l.bbox.x1)-Math.max(a.bbox.x0,l.bbox.x0));
      const dx=Math.abs((a.bbox.x0+a.bbox.x1-l.bbox.x0-l.bbox.x1)/2);
      const score=dy/h+dx/Math.max(width,lw)*2;
      return {a,score,ok:dy>=h*.6&&dy<h*7&&(overlap/Math.max(1,Math.min(width,lw))>.25||dx<Math.max(width,lw)*.55)};
    }).filter(x=>x.ok).sort((a,b)=>a.score-b.score);
    if(candidates.length)candidates[0].a.parts.push(l);
  }
  let rows=[],unresolved=[];
  for(const a of anchors) {
    const parts=a.parts.sort((x,y)=>x.bbox.y0-y.bbox.y0||x.bbox.x0-y.bbox.x0);
    const result=parseText(parts.map(p=>p.text).join(' '),parts.reduce((s,p)=>s+p.confidence,0)/parts.length);
    rows.push(...result.rows); unresolved.push(...result.unresolved);
  }
  if(!rows.length) return parseText(data.text,data.confidence);
  // Spatial grouping takes precedence over page reading order for plans.
  return {rows,unresolved};
}
export function titleCase(s) {
  const small=new Set(['de','del','la','las','el','los','y','e','con']);
  return s.toLocaleLowerCase('es-MX').replace(/\p{L}[\p{L}\p{M}]*/gu,w=>small.has(w)?w:w[0].toLocaleUpperCase('es-MX')+w.slice(1));
}
export function formatResult(rows, {letterCase='normal',separator='lines',precision='original'}={}) {
  const visible=[...new Set(rows.map(r=>r.direction))];
  const paragraphs=visible.map((direction,i)=>{
    const group=rows.filter(r=>r.direction===direction);
    const descriptions=group.map(r=>{
      const n=parseDistance(r.distance);let distance=n;
      if(n&&precision==='two')distance=Number(n).toFixed(2);
      let name=letterCase==='normal'?titleCase(r.name):r.name;
      return 'en '+(distance||'[medida por revisar]')+' metros con '+(name||'[colindante por revisar]');
    });
    const body=descriptions.length?descriptions.join(' y '):'[sin datos detectados]';
    return `AL ${direction}: ${body}${i===visible.length-1?'.':';'}`;
  });
  let text=paragraphs.join(separator==='paragraph'?' ':'\n');
  if(letterCase==='upper')text=text.toLocaleUpperCase('es-MX');
  if(letterCase==='lower')text=text.toLocaleLowerCase('es-MX');
  return text;
}
