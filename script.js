document.addEventListener('DOMContentLoaded',()=>{
  const items=document.querySelectorAll('.animate,.animate-left,.animate-right,.animate-pop,.animate-zoom');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal=()=>items.forEach(item=>{const r=item.getBoundingClientRect(); if(reduce|| (r.top<innerHeight-80&&r.bottom>60)) item.classList.add('show'); else item.classList.remove('show')});
  let pending=false; const request=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{reveal();pending=false})}; reveal(); addEventListener('scroll',request,{passive:true}); addEventListener('resize',request);
  const toggle=document.querySelector('.menu-toggle'), links=document.querySelector('.nav-links');
  toggle.addEventListener('click',()=>{const open=links.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});
  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');toggle.setAttribute('aria-expanded','false')}));
  document.querySelectorAll('[data-protected]').forEach(button=>button.addEventListener('click',()=>alert('This resource is reserved for Dr Muath Research Group members. Password access will be enabled here.')));
});