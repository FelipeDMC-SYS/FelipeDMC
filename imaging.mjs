export function monochromePixels(rgba,{ink=false,width=0,height=0}={}) {
  let dark=0,n=0;for(let i=0;i<rgba.length;i+=400){if((rgba[i]+rgba[i+1]+rgba[i+2])/3<105)dark++;n++;}
  const invert=dark/n>.6;
  if(ink&&invert){
    let colored=0;for(let i=0;i<rgba.length;i+=4){const high=Math.max(rgba[i],rgba[i+1],rgba[i+2]),low=Math.min(rgba[i],rgba[i+1],rgba[i+2]);if(high-low>55&&high>120)colored++;}
    const useColor=colored/(rgba.length/4)>.008;
    for(let i=0;i<rgba.length;i+=4){const high=Math.max(rgba[i],rgba[i+1],rgba[i+2]),low=Math.min(rgba[i],rgba[i+1],rgba[i+2]);const v=useColor?(high-low>55&&high>120?0:255):(high>155?0:255);rgba[i]=rgba[i+1]=rgba[i+2]=v;}
    // Remove long ruled table lines, keeping small decimal points and strokes.
    for(let y=0;y<height;y++){let run=0;for(let x=0;x<width;x++){run=rgba[(y*width+x)*4]<128?run+1:0;if(run>width*.65){for(let k=0;k<width;k++){const j=(y*width+k)*4;rgba[j]=rgba[j+1]=rgba[j+2]=255;}break;}}}
  }else{
    for(let i=0;i<rgba.length;i+=4){let v=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];if(invert)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.35+128));rgba[i]=rgba[i+1]=rgba[i+2]=v;}
  }
  return rgba;
}
export async function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('No se pudo abrir la imagen.'));im.src=src;});}
// Fixed cubic interpolation gives the OCR the same pixels across browser engines.
export function resizePixels(source,width,height,outWidth,outHeight){
  const kernel=x=>{x=Math.abs(x);return x<1?(1.5*x-2.5)*x*x+1:x<2?((-.5*x+2.5)*x-4)*x+2:0;};
  const taps=(n,m)=>Array.from({length:m},(_,i)=>{const scale=Math.max(1,n/m),center=(i+.5)*n/m-.5,left=Math.max(0,Math.ceil(center-2*scale)),right=Math.min(n-1,Math.floor(center+2*scale));const a=[];let sum=0;for(let j=left;j<=right;j++){const w=kernel((j-center)/scale);a.push([j,w]);sum+=w;}return a.map(([j,w])=>[j,w/sum]);});
  const xs=taps(width,outWidth),ys=taps(height,outHeight),tmp=new Uint8ClampedArray(outWidth*height*4),dest=new Uint8ClampedArray(outWidth*outHeight*4);
  for(let y=0;y<height;y++)for(let x=0;x<outWidth;x++)for(let c=0;c<4;c++){let sum=0;for(const [i,w] of xs[x])sum+=source[(y*width+i)*4+c]*w;tmp[(y*outWidth+x)*4+c]=Math.round(sum);}
  for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++)for(let c=0;c<4;c++){let sum=0;for(const [i,w] of ys[y])sum+=tmp[(i*outWidth+x)*4+c]*w;dest[(y*outWidth+x)*4+c]=Math.round(sum);}
  return dest;
}
export async function imageCanvas(src,rotation=0,{preprocess=false,ink=false}={}){
  const im=await loadImage(src),turned=rotation%180!==0;
  const bw=turned?im.naturalHeight:im.naturalWidth,bh=turned?im.naturalWidth:im.naturalHeight;
  const scale=preprocess?Math.min(4,Math.max(1,2200/bw),Math.sqrt(7000000/(bw*bh))):Math.min(1,Math.sqrt(12000000/(bw*bh)));
  const canvas=document.createElement('canvas');canvas.width=bw;canvas.height=bh;
  const ctx=canvas.getContext('2d',{willReadFrequently:preprocess});ctx.fillStyle='#fff';ctx.fillRect(0,0,bw,bh);ctx.translate(bw/2,bh/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(im,-im.naturalWidth/2,-im.naturalHeight/2);ctx.setTransform(1,0,0,1,0,0);
  if(!preprocess)return canvas;
  const source=ctx.getImageData(0,0,bw,bh);if(ink)monochromePixels(source.data,{ink:true,width:bw,height:bh});
  const out=document.createElement('canvas');out.width=Math.round(bw*scale);out.height=Math.round(bh*scale);const outCtx=out.getContext('2d'),pixels=outCtx.createImageData(out.width,out.height);
  pixels.data.set(resizePixels(source.data,bw,bh,out.width,out.height));if(!ink)monochromePixels(pixels.data,{width:out.width,height:out.height});outCtx.putImageData(pixels,0,0);return out;
}
// Resolve OCR assets from this module, including GitHub Pages repository paths.
const assetURL = name => new URL('./assets/' + name, import.meta.url).href;
let scriptPromise;
export function loadOCR(){if(window.Tesseract)return Promise.resolve();if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=assetURL('tesseract.min.js');script.onload=resolve;script.onerror=()=>{script.remove();scriptPromise=null;reject(new Error('No se pudo cargar el motor de lectura. Comprueba tu conexión.'));};document.head.append(script);});return scriptPromise;}
export async function createOCRWorker(logger){await loadOCR();return window.Tesseract.createWorker('spa',1,{workerPath:assetURL('worker.min.js'),corePath:assetURL(''),langPath:assetURL(''),workerBlobURL:false,logger,errorHandler:()=>{}});}
