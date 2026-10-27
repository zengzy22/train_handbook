'use client';

import { useEffect } from 'react';

// Keep the mask's caps circular as controls and labels change size.
export function usePillCurves() {
  useEffect(()=>{
    if(typeof ResizeObserver==='undefined'||(!CSS.supports('-webkit-mask-box-image-source','url("data:image/svg+xml,%3Csvg/%3E")')&&!CSS.supports('mask-border-source','url("data:image/svg+xml,%3Csvg/%3E")')))return;
    const selector='.button, .editor-save, .profile-trigger, .filter-tabs button, .search-field, .badge, .tags > span, .segmented, .segmented button, .home-week-day, .import-file, .exercise-row-tools label, .exercise-row-tools .text-button';
    const watched=new Set<HTMLElement>();
    const sizes=new ResizeObserver(entries=>{
      for(const {target} of entries){
        const element=target as HTMLElement,rect=element.getBoundingClientRect();
        if(rect.width<=0||rect.height<=0)continue;
        const radius=`${Math.min(rect.width,rect.height)/2}px`;
        if(element.style.getPropertyValue('--pill-curve-radius')!==radius)element.style.setProperty('--pill-curve-radius',radius);
        element.dataset.pillCurve='ready';
      }
    });
    function scan(){
      for(const element of watched)if(!element.isConnected){sizes.unobserve(element);watched.delete(element);}
      document.querySelectorAll<HTMLElement>(selector).forEach(element=>{if(!watched.has(element)){watched.add(element);sizes.observe(element);}});
    }
    const changes=new MutationObserver(scan);
    changes.observe(document.body,{childList:true,subtree:true});
    scan();
    return()=>{changes.disconnect();sizes.disconnect();};
  },[]);
}
