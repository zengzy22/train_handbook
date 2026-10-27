'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TrainingSet } from '../lib/model';

export default function ExerciseChips({sets}:{sets:Pick<TrainingSet,'exercise'|'muscle'>[]}) {
  const items=useMemo(()=>Array.from(new Map(sets.map(set=>[set.exercise,set])).values()),[sets]);
  const root=useRef<HTMLDivElement>(null),measure=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(1);
  useLayoutEffect(()=>{
    const container=root.current,probe=measure.current;
    if(!container||!probe)return;
    function fit(){
      const widths=Array.from(probe!.querySelectorAll<HTMLElement>('[data-exercise]')).map(node=>node.getBoundingClientRect().width);
      const counters=Array.from(probe!.querySelectorAll<HTMLElement>('[data-count]')).map(node=>node.getBoundingClientRect().width);
      const available=container!.clientWidth,gap=parseFloat(getComputedStyle(probe!).columnGap)||0;
      let used=0,count=0;
      for(let index=0;index<widths.length;index++){
        used+=widths[index]+(index?gap:0);
        const remaining=widths.length-index-1;
        if(used+(remaining?gap+counters[remaining-1]:0)<=available+.25)count=index+1;
      }
      // Keep one readable, ellipsized label beside the count on narrow screens.
      setVisible(Math.max(1,count));
    }
    fit();
    const observer=new ResizeObserver(fit);observer.observe(container);observer.observe(probe);
    void document.fonts.ready.then(()=>{if(root.current===container)fit();});
    return()=>observer.disconnect();
  },[items]);
  if(!items.length)return null;
  const count=Math.min(visible,items.length),hidden=items.slice(count);
  const chip=(item:typeof items[number])=><span key={item.exercise} className="exercise-chip" data-muscle={item.muscle} title={item.exercise} role="listitem">{item.exercise}</span>;
  return <div className="exercise-chips" ref={root}>
    <div className="exercise-chips-line" role="list" aria-label="训练动作">{items.slice(0,count).map(chip)}{hidden.length>0&&<span className="exercise-chip-more" role="listitem" title={hidden.map(item=>item.exercise).join('、')} aria-label={`另有 ${hidden.length} 个动作：${hidden.map(item=>item.exercise).join('、')}`}>+{hidden.length}</span>}</div>
    <div className="exercise-chips-measure" ref={measure} aria-hidden="true">{items.map(item=><span key={item.exercise} data-exercise className="exercise-chip" data-muscle={item.muscle}>{item.exercise}</span>)}{items.map((_,index)=><span key={`count-${index}`} data-count className="exercise-chip-more">+{index+1}</span>)}</div>
  </div>;
}
