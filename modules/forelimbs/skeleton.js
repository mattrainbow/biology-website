/* Turns the forelimb data into bone positions and a skin outline, for any point in a morph. */
window.SKELETON = (function () {
'use strict';
const ANIMALS=FORELIMBS.ANIMALS, NA=ANIMALS.length;
const cl=x=>Math.max(0,Math.min(1,x)), ease=x=>x*x*(3-2*x);
const mix=(a,b,t)=>typeof a==='number'?a+(b-a)*t:Array.isArray(a)?a.map((v,i)=>mix(v,b[i],t)):Object.keys(a).reduce((o,k)=>(o[k]=mix(a[k],b[k],t),o),{});
const R=d=>d*Math.PI/180, pol=(l,a)=>[l*Math.cos(R(a)),l*Math.sin(R(a))];
const add=(p,q,k=1)=>[p[0]+q[0]*k,p[1]+q[1]*k];
const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
const nrm=v=>{const l=Math.hypot(v[0],v[1])||1;return [v[0]/l,v[1]/l]};
const perp=(P,Q)=>nrm([-(Q[1]-P[1]),Q[0]-P[0]]);
const stg=(k,s)=>ease(cl((k*1.3-.3-s)/(1-s)));

function pose(t){
  t=Math.max(0,Math.min(NA-1,t));
  const i=Math.min(NA-2,Math.floor(t));
  return poseAB(ANIMALS[i],ANIMALS[i+1],cl(t-i));
}
// morph directly between any two animals a and b; k runs from 0 (a) to 1 (b)
function poseAB(a,b,k){
  const ta=ease(cl(k*1.3));
  // digit timing: the horse's toes are lost in order (I and V, then II and IV, while III grows)
  const tds=[0,1,2,3,4].map(j=>b.st?stg(k,b.st[j]):a.st?1-stg(1-k,a.st[j]):stg(k,0));
  const m=x=>mix(a[x],b[x],ta);
  const s={hum:m('hum'),fa:m('fa'),radOff:m('radOff'),ulnOff:m('ulnOff'),ulnFrac:m('ulnFrac'),carp:m('carp'),cs:m('cs'),w:m('w')};
  const S=[0,0], E=add(S,pol(...s.hum)), u=pol(1,s.fa[1]), n=[-u[1],u[0]], W=add(E,u,s.fa[0]);
  const bones=[{k:'hum',g:0,a:S,b:E,r:s.w.hum},{k:'rad',g:0,a:add(E,n,s.radOff),b:add(W,n,s.radOff),r:s.w.rad}];
  const ua=add(E,n,-s.ulnOff); bones.push({k:'uln',g:0,a:ua,b:add(ua,u,s.fa[0]*s.ulnFrac),r:s.w.uln});
  const carps=[[.1,.21],[.1,.07],[.1,-.07],[.1,-.21],[.3,.21],[.3,.07],[.3,-.07],[.3,-.21]].map(([al,q])=>add(add(W,u,al*s.cs),n,q*s.cs));
  const HB=add(W,u,s.carp), J=[];
  for(let j=0;j<5;j++){
    const td=tds[j], off=mix(a.off[j],b.off[j],td), segs=mix(a.d[j],b.d[j],td), dw=mix(a.dw[j],b.dw[j],td);
    let P=add(HB,n,off); const pts=[P];
    segs.forEach(([l,ang],q)=>{const Q=add(P,pol(l,s.fa[1]+ang));
      bones.push({k:q?'ph':'mc',g:j+1,q,a:P,b:Q,r:(q?s.w.ph*Math.max(.35,1-.12*(q-1)):s.w.mc)*dw});pts.push(Q);P=Q});
    J.push(pts)}
  const hn=perp(S,E), en=nrm([hn[0]+n[0],hn[1]+n[1]]), fn=perp(S,W);
  return {S,E,W,HB,u,n,hn,en,fn,bones,carps,cr:.085*s.cs,J,ta,tds,k,a,b,ia:ANIMALS.indexOf(a),ib:ANIMALS.indexOf(b)};
}

// Skin outline: one closed shape per animal, computed on the current skeleton, then blended between neighbours.
function along(pts,f){
  const seg=[];let L=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l}
  let d=cl(f)*L,u=[1,0];
  for(let i=0;i<seg.length;i++){const a=pts[i],b=pts[i+1];
    if(seg[i]>1e-3)u=[(b[0]-a[0])/seg[i],(b[1]-a[1])/seg[i]];
    if(d<=seg[i]&&seg[i]>1e-3||i===seg.length-1){const k=seg[i]>1e-3?Math.min(1,d/seg[i]):0;return [[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k],u]}
    d-=seg[i]}
  return [pts[0],u];
}
const side=(J,f,s,w)=>{const [q,u]=along(J,f);return [q[0]-u[1]*w*s,q[1]+u[0]*w*s]};
function outline(p){
  const A=p.a.sk, B=p.b.sk, N=7, out=[], td=p.tds, ta=p.ta;
  const anc=([t,a1,a2])=>{if(t==='A')return [a1,a2];
    const P=t==='S'?p.S:t==='E'?p.E:t==='W'?p.W:mid(p.S,p.W), Nn=t==='S'?p.hn:t==='E'?p.en:t==='W'?p.n:p.fn;
    return add(add(P,Nn,a1),[Nn[1],-Nn[0]],a2)};
  const arm=(fa,fb)=>fa.map((q,i)=>{const x=anc(q),y=anc(fb[i]);return [x[0]+(y[0]-x[0])*ta,x[1]+(y[1]-x[1])*ta]});
  // finger settings blend with each finger's own timing
  const g=(key,i)=>A[key][i]+(B[key][i]-A[key][i])*td[i];
  const W=i=>A.fw*A.dw[i]+(B.fw*B.dw[i]-A.fw*A.dw[i])*td[i];
  out.push(...arm(A.fr,B.fr));
  for(let i=0;i<5;i++){const J=p.J[i],w=W(i),fa=g('fa',i),ft=g('ft',i),fb=g('fb',i),tw=A.tw+(B.tw-A.tw)*td[i];
    if(i){const P=side(p.J[i-1],g('fb',i-1),-1,W(i-1)*.25),Q=side(J,fa,1,w*.25),M=mid(P,Q),v=[p.HB[0]-M[0],p.HB[1]-M[1]],vl=Math.hypot(...v)||1;
      const tt=(td[i-1]+td[i])/2, sc=A.sc+(B.sc-A.sc)*tt;
      out.push(i>1&&sc?add(M,v,Math.min(sc,vl*.5)/vl):M)}
    // skin tapers toward the bone at each finger web so neighbouring fingers never overlap
    const tA=f=>i>0?w*(.25+.75*ease(cl((f-fa)/tw))):w, tB=f=>i<4?w*(.25+.75*ease(cl((f-fb)/tw))):w;
    for(let k=0;k<N;k++){const f=fa+(ft-fa)*k/(N-1);out.push(side(J,f,1,tA(f)))}
    const [tp,tu]=along(J,ft); out.push(add(tp,tu,w));
    for(let k=0;k<N;k++){const f=ft+(fb-ft)*k/(N-1);out.push(side(J,f,-1,tB(f)))}
  }
  out.push(...arm(A.bk,B.bk));
  return out.filter((q,i,X)=>!i||Math.hypot(q[0]-X[i-1][0],q[1]-X[i-1][1])>.01);
}

return {pose,poseAB,outline,along,ease,cl,add};
})();
