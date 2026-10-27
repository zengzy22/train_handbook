'use client';

import {useState,useEffect,useLayoutEffect,useRef,useCallback} from 'react';
import type {InputHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {Check,CheckCircle2,MoreHorizontal,Plus,Minus,Trash2,X} from 'lucide-react';
import {emptySet,rpeSchema} from '../lib/model';
import type {TrainingSet} from '../lib/model';
import {exerciseGroups,addSetToExercise,setExerciseMode} from '../lib/exercise-groups';

const muscles=['胸部','背部','腿部','肩部','手臂','核心','全身','有氧'] as const;
const exercises=['杠铃卧推','哑铃卧推','上斜哑铃卧推','杠铃深蹲','硬拉','罗马尼亚硬拉','引体向上','高位下拉','坐姿划船','杠铃划船','哑铃肩推','哑铃侧平举','二头弯举','绳索下压','腿举','平板支撑'];
type NumberProps=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'|'inputMode'> & {value:number|null|undefined;zeroIsBlank?:boolean;integer?:boolean};
function SetNumberField({value,onChange,zeroIsBlank=false,integer=false,...props}:NumberProps){
  const [draft,setDraft]=useState<string|null>(null),displayed=zeroIsBlank&&value===0?'':value??'';
  return <input {...props} type="text" inputMode={integer?'numeric':'decimal'} value={draft??displayed} onFocus={e=>{setDraft(String(displayed));e.currentTarget.select();}} onChange={e=>{
    const next=e.target.value;if(!(integer?/^\d*$/:/^\d*(?:\.\d*)?$/).test(next))return;
    setDraft(next);if(next===''||Number.isFinite(Number(next)))onChange?.(e);
  }} onBlur={()=>setDraft(null)}/>;
}

function RpeField({value,label,onChange}:{value:number|null;label:string;onChange:(value:number|null)=>void}){
  const [draft,setDraft]=useState<string|null>(null);
  function step(delta:number){setDraft(null);onChange(Math.max(0,Math.min(10,Math.round((value??0)*2)/2+delta)));}
  return <div className="exercise-cell rpe-cell"><span>RPE</span><div className="rpe-stepper">
    <button type="button" aria-label={`${label}RPE减少0.5`} disabled={value===0} onClick={()=>step(-.5)}><Minus size={13}/></button>
    <input aria-label={`${label}RPE`} role="spinbutton" aria-valuemin={0} aria-valuemax={10} aria-valuenow={value??undefined} aria-valuetext={value===null?'未填写':String(value)} type="text" inputMode="decimal" placeholder="—" value={draft??value??''} onFocus={e=>{setDraft(value===null?'':String(value));e.currentTarget.select();}} onChange={e=>{
      const next=e.target.value;if(!/^\d*(?:\.\d*)?$/.test(next))return;
      if(next===''){setDraft('');onChange(null);return;}
      const number=Number(next);if(rpeSchema.safeParse(number).success){setDraft(next);onChange(number);}
    }} onBlur={()=>setDraft(null)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();step(e.key==='ArrowUp'?.5:-.5);}}}/>
    <button type="button" aria-label={`${label}RPE增加0.5`} disabled={value===10} onClick={()=>step(.5)}><Plus size={13}/></button>
  </div></div>;
}

type MenuOption={label:string;checked:boolean;toggle:()=>void};
function SetOptionsMenu({anchor,label,options,canDelete,onDelete,onClose}:{anchor:HTMLButtonElement;label:string;options:MenuOption[];canDelete:boolean;onDelete:()=>void;onClose:()=>void}){
  const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState<{left:number;top:number}|null>(null);
  useLayoutEffect(()=>{const r=anchor.getBoundingClientRect(),height=ref.current?.offsetHeight??250;setPosition({left:Math.max(12,Math.min(innerWidth-232,r.right-220)),top:r.bottom+height+12<=innerHeight?r.bottom+6:Math.max(12,r.top-height-6)});},[anchor]);
  useEffect(()=>{
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
    function escape(e:KeyboardEvent){if(e.key==='Escape'){e.stopPropagation();onClose();}}
    function scroll(e:Event){if(e.target instanceof Node&&ref.current?.contains(e.target))return;onClose();}
    document.addEventListener('keydown',escape);window.addEventListener('resize',onClose);window.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('keydown',escape);window.removeEventListener('resize',onClose);window.removeEventListener('scroll',scroll,true);if(anchor.isConnected)anchor.focus({preventScroll:true});};
  },[anchor,onClose]);
  return createPortal(<div className="set-menu-layer"><div className="set-menu-backdrop" onPointerDown={onClose}/><div ref={ref} role="menu" aria-label={`${label}组选项`} className="set-options-menu" style={{left:position?.left??0,top:position?.top??0,visibility:position?'visible':'hidden'}} onKeyDown={e=>{
    if(e.key==='Tab'){onClose();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();
    const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),index=items.indexOf(document.activeElement as HTMLButtonElement);
    items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
  }}><p>{label}</p>{options.map(option=><button type="button" key={option.label} role="menuitemcheckbox" aria-checked={option.checked} onClick={option.toggle}><span>{option.label}</span><span className={'option-check '+(option.checked?'checked':'')}>{option.checked&&<Check size={15}/>}</span></button>)}<button type="button" role="menuitem" className="danger" disabled={!canDelete} onClick={()=>{onDelete();onClose();}}><span>删除此组</span><Trash2 size={16}/></button></div></div>,document.body);
}

type Extras={notes?:boolean;time?:boolean;rest?:boolean};
type Cached={notes?:string;time?:number|null;rest?:number|null;components?:(number|null|undefined)[]};
export default function SetEditor({sets,onChange,plan}:{sets:TrainingSet[];onChange:(sets:TrainingSet[])=>void;plan:boolean}){
  const [extras,setExtras]=useState<Record<string,Extras>>({}),[menu,setMenu]=useState<{id:string;anchor:HTMLButtonElement}|null>(null);
  const cached=useRef<Record<string,Cached>>({}),closeMenu=useCallback(()=>setMenu(null),[]);
  const update=(index:number,patch:Partial<TrainingSet>)=>onChange(sets.map((set,i)=>i===index?{...set,...patch}:set));
  const updateGroup=(indices:number[],patch:Partial<TrainingSet>)=>onChange(sets.map((set,i)=>indices.includes(i)?{...set,...patch}:set));
  function updateComponent(index:number,part:number,patch:Partial<NonNullable<TrainingSet['components']>[number]>){
    const source=sets[index],components=source.components?.map((c,j)=>j===part?{...c,...patch}:c);
    const name=components?.every(c=>c.exercise.trim())?components.map(c=>c.exercise.trim()).join(' + '):null;
    onChange(sets.map((set,i)=>i===index?{...set,components,exercise:name&&set.exercise.includes('组合动作')?name:set.exercise}:name&&set.groupId===source.groupId&&set.exercise.includes('组合动作')?{...set,exercise:name}:set));
  }
  function enabled(set:TrainingSet,key:keyof Extras){return extras[set.id]?.[key]??(key==='notes'?Boolean(set.notes):key==='time'?Boolean(set.durationMaxSeconds!=null||set.components?.some(c=>c.durationMaxSeconds!=null)):set.restMaxSeconds!=null);}
  function toggle(index:number,key:keyof Extras){
    const set=sets[index],next=!enabled(set,key),cache=cached.current[set.id]??={};
    setExtras(previous=>({...previous,[set.id]:{...previous[set.id],[key]:next}}));
    if(key==='notes'){if(!next)cache.notes=set.notes;update(index,{notes:next?cache.notes??set.notes??'':undefined});}
    if(key==='rest'){if(!next)cache.rest=set.restMaxSeconds;update(index,{restMaxSeconds:next&&cache.rest!=null?Math.max(set.restSeconds??0,cache.rest):null});}
    if(key==='time'){
      if(set.components?.length){if(!next)cache.components=set.components.map(c=>c.durationMaxSeconds);update(index,{components:set.components.map((c,j)=>({...c,durationMaxSeconds:next&&cache.components?.[j]!=null?Math.max(c.durationSeconds??0,cache.components[j]!):null}))});}
      else {if(!next)cache.time=set.durationMaxSeconds;update(index,{durationMaxSeconds:next&&cache.time!=null?Math.max(set.durationSeconds??0,cache.time):null});}
    }
  }
  function mode(indices:number[],combo:boolean){indices.forEach(index=>{delete cached.current[sets[index].id];});setExtras(previous=>{const next={...previous};indices.forEach(index=>{delete next[sets[index].id];});return next;});onChange(setExerciseMode(sets,indices,combo));}
  const groups=exerciseGroups(sets),menuIndex=menu?sets.findIndex(set=>set.id===menu.id):-1;
  return <><datalist id="exercise-options">{exercises.map(exercise=><option value={exercise} key={exercise}/>)}</datalist><div className="exercise-stack">{groups.map((indices,groupIndex)=>{
    const first=sets[indices[0]],groupCombo=Boolean(first.components?.length);
    return <section className="exercise-card" key={first.id}>
      <div className="exercise-card-head"><div className="exercise-name-fields"><input aria-label={`第${groupIndex+1}个动作名称`} placeholder="动作或组合名称" list="exercise-options" value={first.exercise} maxLength={100} onChange={e=>updateGroup(indices,{exercise:e.target.value})}/><select aria-label={`第${groupIndex+1}个动作肌群`} value={first.muscle} onChange={e=>updateGroup(indices,{muscle:e.target.value as TrainingSet['muscle']})}>{muscles.map(m=><option key={m}>{m}</option>)}</select></div><span className="exercise-count">{indices.length} 组</span></div>
      <div className="exercise-scroll-hint">每组一行 <span>左右滑动查看参数 ↔</span></div>
      <div className="exercise-sets-scroll" tabIndex={0} role="region" aria-label={`${first.exercise||`动作${groupIndex+1}`}的逐组参数，可横向滚动`}>{indices.map((index,row)=>{
        const set=sets[index],combo=Boolean(set.components?.length),label=`${first.exercise||`动作${groupIndex+1}`}第${row+1}组`,time=enabled(set,'time'),rest=enabled(set,'rest'),notes=enabled(set,'notes');
        const columns=`24px ${combo?'104px':'repeat(3,minmax(48px,1fr))'+(time?' minmax(48px,1fr)':'')} minmax(48px,1fr) ${rest?'minmax(48px,1fr) ':''}minmax(48px,1fr) 132px ${plan?'':'44px '}44px`;
        const numericCount=(combo?0:3)+(time&&!combo?1:0)+2+(rest?1:0),columnCount=1+(combo?1:0)+numericCount+1+(plan?0:1)+1;
        const minWidth=24+(combo?104:0)+numericCount*48+132+(plan?0:44)+44+(columnCount-1)*4;
        return <div className="exercise-set-block" key={set.id}><div className={`exercise-set ${combo?'is-combo':''}`} style={{gridTemplateColumns:columns,minWidth}}>
          <span className="exercise-row-number" aria-label={`${label}${set.warmup?'，热身组':''}`}>{set.warmup?<span className="warmup-badge" title="热身组">热</span>:row+1}</span>
          {combo?<div className="combo-label">组合 · {set.components!.length} 个动作</div>:<><label className="exercise-cell"><span>kg</span><SetNumberField aria-label={`${label}重量`} min="0" max="1500" step="0.5" zeroIsBlank placeholder="0" value={set.weight} onChange={e=>update(index,{weight:e.target.value===''?0:Number(e.target.value)})}/></label><label className="exercise-cell"><span>次</span><SetNumberField aria-label={`${label}次数`} min="1" max="1000" integer placeholder="—" value={set.reps} onChange={e=>update(index,{reps:e.target.value===''?null:Number(e.target.value)})}/></label><label className="exercise-cell"><span>时间 s</span><SetNumberField aria-label={`${label}时间秒`} min="1" max="86400" integer placeholder="—" value={set.durationSeconds} onChange={e=>update(index,{durationSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>{time&&<label className="exercise-cell"><span>时间上限 s</span><SetNumberField aria-label={`${label}时间上限秒`} min="1" max="86400" integer placeholder="上限" value={set.durationMaxSeconds} onChange={e=>update(index,{durationMaxSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>}</>}
          <label className="exercise-cell"><span>休息 s</span><SetNumberField aria-label={`${label}休息秒`} min="1" max="86400" integer placeholder="—" value={set.restSeconds} onChange={e=>update(index,{restSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>{rest&&<label className="exercise-cell"><span>休息上限 s</span><SetNumberField aria-label={`${label}休息上限秒`} min="1" max="86400" integer placeholder="上限" value={set.restMaxSeconds} onChange={e=>update(index,{restMaxSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>}
          <label className="exercise-cell metric-velocity"><span>MCV m/s</span><SetNumberField aria-label={`${label}MCV米每秒`} min="0" max="20" step="0.01" placeholder="—" value={set.mcv} onChange={e=>update(index,{mcv:e.target.value===''?null:Number(e.target.value)})}/></label>
          <RpeField label={label} value={set.rpe} onChange={rpe=>update(index,{rpe})}/>
          {!plan&&<label className="exercise-check"><span>完成</span><input aria-label={`${label}完成`} type="checkbox" checked={set.completed} onChange={e=>update(index,{completed:e.target.checked})}/></label>}
          <button type="button" className="set-options-trigger" aria-label={`${label}更多选项`} aria-haspopup="menu" aria-expanded={menu?.id===set.id} onClick={e=>setMenu(menu?.id===set.id?null:{id:set.id,anchor:e.currentTarget})}><MoreHorizontal size={20}/></button>
        </div>
        {combo&&<div className="combo-components"><p>依次完成以下动作，合计为同一组</p>{set.components!.map((part,j)=><div className="combo-component" key={j} style={{gridTemplateColumns:`24px minmax(120px,1.5fr) repeat(${time?5:4},minmax(58px,1fr)) 36px`,minWidth:time?600:520}}>
          <span>{j+1}</span><input aria-label={`第${row+1}组第${j+1}个子动作名称`} placeholder="动作名称" value={part.exercise} maxLength={100} onChange={e=>updateComponent(index,j,{exercise:e.target.value})}/>
          <label><span>次</span><SetNumberField aria-label={`第${row+1}组第${j+1}个子动作次数`} min="1" max="1000" integer placeholder="—" value={part.reps} onChange={e=>updateComponent(index,j,{reps:e.target.value===''?null:Number(e.target.value)})}/></label>
          <label><span>时间 s</span><SetNumberField aria-label={`第${row+1}组第${j+1}个子动作时间秒`} min="1" max="86400" integer placeholder="—" value={part.durationSeconds} onChange={e=>updateComponent(index,j,{durationSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>
          {time&&<label><span>时间上限 s</span><SetNumberField aria-label={`第${row+1}组第${j+1}个子动作时间上限秒`} min="1" max="86400" integer placeholder="上限" value={part.durationMaxSeconds} onChange={e=>updateComponent(index,j,{durationMaxSeconds:e.target.value===''?null:Number(e.target.value)})}/></label>}
          <label><span>kg</span><SetNumberField aria-label={`第${row+1}组第${j+1}个子动作重量`} min="0" max="1500" step="0.5" placeholder="—" value={part.weight} onChange={e=>updateComponent(index,j,{weight:e.target.value===''?null:Number(e.target.value)})}/></label>
          <label className="metric-velocity"><span>MCV m/s</span><SetNumberField aria-label={`第${row+1}组第${j+1}个子动作MCV`} min="0" max="20" step="0.01" placeholder="—" value={part.mcv} onChange={e=>updateComponent(index,j,{mcv:e.target.value===''?null:Number(e.target.value)})}/></label>
          <button type="button" className="icon-btn danger" disabled={set.components!.length<=2} aria-label={`移除第${j+1}个子动作`} onClick={()=>{delete cached.current[set.id];update(index,{components:set.components!.filter((_,n)=>n!==j)});}}><X size={15}/></button>
        </div>)}<button type="button" className="text-button" disabled={set.components!.length>=10} onClick={()=>{delete cached.current[set.id];update(index,{components:[...set.components!,{exercise:'',weight:null,reps:null,durationSeconds:null,mcv:null}]});}}><Plus size={14}/>添加子动作</button></div>}
        {notes&&<input className="set-note-input" aria-label={`${label}说明`} placeholder="负荷目标、速度或注意事项" maxLength={500} value={set.notes??''} onChange={e=>update(index,{notes:e.target.value})}/>}
        </div>;
      })}</div>
      <div className="exercise-card-actions"><button type="button" className="text-button" disabled={sets.length>=300} onClick={()=>onChange(addSetToExercise(sets,indices))}><Plus size={16}/>添加一组</button><div className="exercise-mode segmented" role="group" aria-label={`第${groupIndex+1}个动作类型`}><button type="button" aria-label="切换为单个动作" aria-pressed={!groupCombo} className={!groupCombo?'selected':''} title="仅保留第一个子动作" onClick={()=>{if(groupCombo)mode(indices,false);}}>单个</button><button type="button" aria-label="切换为组合动作" aria-pressed={groupCombo} className={groupCombo?'selected':''} onClick={()=>{if(!groupCombo)mode(indices,true);}}>组合</button></div><button type="button" className="icon-btn danger" disabled={groups.length===1} aria-label={`删除第${groupIndex+1}个动作`} onClick={()=>onChange(sets.filter((_,n)=>!indices.includes(n)))}><Trash2 size={16}/></button></div>
      {groupCombo&&<p className="combo-mode-hint">切回单个动作时，仅保留第一个子动作。</p>}
    </section>;
  })}</div>
  <div className="set-buttons"><button type="button" className="button small" disabled={sets.length>=300} onClick={()=>onChange([...sets,emptySet()])}><Plus size={16}/>添加动作</button>{!plan&&<button type="button" className="button mark-all-complete" disabled={sets.every(set=>set.completed)} onClick={()=>onChange(sets.map(set=>({...set,completed:true})))}><CheckCircle2 size={16}/>{sets.every(set=>set.completed)?'已全部完成':'全部标记完成'}</button>}</div>
  {menu&&menuIndex>=0&&<SetOptionsMenu anchor={menu.anchor} label={`${sets[menuIndex].exercise||'动作'}第${groups.find(g=>g.includes(menuIndex))!.indexOf(menuIndex)+1}组`} options={[
    {label:'热身',checked:sets[menuIndex].warmup,toggle:()=>update(menuIndex,{warmup:!sets[menuIndex].warmup})},
    {label:'说明',checked:enabled(sets[menuIndex],'notes'),toggle:()=>toggle(menuIndex,'notes')},
    {label:'时间范围',checked:enabled(sets[menuIndex],'time'),toggle:()=>toggle(menuIndex,'time')},
    {label:'休息范围',checked:enabled(sets[menuIndex],'rest'),toggle:()=>toggle(menuIndex,'rest')},
  ]} canDelete={sets.length>1} onDelete={()=>onChange(sets.filter((_,i)=>i!==menuIndex))} onClose={closeMenu}/>}
  </>;
}
