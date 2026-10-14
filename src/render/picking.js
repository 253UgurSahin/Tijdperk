import { proj, pxu, rayAt } from './camera.js';

export function nearScreen(list,X,Y,r,lift){let best=null,bd=Math.max(r,pxu()*.42);for(const e of list){if(e.hidden||e.retreat)continue;const[sx,sy,sz]=proj(e.x,lift(e),e.y);if(sz>1)continue;const d=Math.hypot(sx-X,sy-Y);if(d<bd){bd=d;best=e}}return best}
export function pickGroup(X,Y,grp,key){const hits=rayAt(X,Y).intersectObjects(grp.children,true);for(const h of hits){let o=h.object;if(o.userData[key]!=null)return o.userData[key]}return null}
