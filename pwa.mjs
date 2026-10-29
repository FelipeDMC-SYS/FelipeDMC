const installButton=document.getElementById('installBtn');
const installDialog=document.getElementById('installDialog');
let installPrompt;
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
function sync(){if(installButton)installButton.hidden=isStandalone();}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;sync();});
window.addEventListener('appinstalled',()=>{installPrompt=null;sync();installDialog?.close();});
installButton?.addEventListener('click',async()=>{
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
  else installDialog?.showModal();
});
document.getElementById('closeInstall')?.addEventListener('click',()=>installDialog.close());
installDialog?.addEventListener('click',e=>{if(e.target!==installDialog)return;const r=installDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)installDialog.close();});
if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).href}).catch(()=>{});});
sync();
