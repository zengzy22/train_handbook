'use client';

const labels = ['很疲惫', '偏疲惫', '一般', '状态不错', '状态很好'];

export default function FeelingRating({value,onChange}:{value:number|null;onChange:(value:number|null)=>void}) {
  return <fieldset className="feeling-rating wide">
    <legend>整体体感</legend>
    <div className="feeling-rating-heading">
      <div aria-live="polite"><strong>{value===null?'训练后感觉如何？':labels[value-1]}</strong><span>{value===null?'选择最接近的状态':`${value} / 5`}</span></div>
      {value!==null&&<button type="button" className="text-button" onClick={()=>onChange(null)}>清除</button>}
    </div>
    <div className="feeling-scale" role="radiogroup" aria-label="整体体感等级" onKeyDown={event=>{
      const direction=['ArrowRight','ArrowUp'].includes(event.key)?1:['ArrowLeft','ArrowDown'].includes(event.key)?-1:0;
      if(!direction)return;
      event.preventDefault();
      const next=Math.min(5,Math.max(1,(value??(direction>0?0:6))+direction));
      onChange(next);
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')[next-1]?.focus();
    }}>
      {labels.map((label,index)=><button key={label} type="button" role="radio" aria-label={`${index+1}级，${label}`} aria-checked={value===index+1} tabIndex={value===index+1||(value===null&&index===0)?0:-1} className={value===index+1?'selected':''} onClick={()=>onChange(index+1)}><span className="feeling-scale-bar" aria-hidden="true"><span>{index+1}</span></span></button>)}
    </div>
    <div className="feeling-scale-captions" aria-hidden="true"><span>很疲惫</span><span>状态很好</span></div>
  </fieldset>;
}
