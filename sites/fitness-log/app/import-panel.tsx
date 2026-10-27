'use client';

import {useEffect,useState} from 'react';
import {FileUp,ImagePlus,ScanLine,LoaderCircle,ChevronRight,X} from 'lucide-react';
import type {TrainingSet} from '../lib/model';
import {exerciseGroups} from '../lib/exercise-groups';

type ImportPreview={title:string;sets:TrainingSet[];warnings:string[];source:'deepseek'|'local'};
async function imageParts(file:File):Promise<string[]>{
  const image=await createImageBitmap(file);
  try{
    const chunkHeight=Math.min(1600,Math.max(900,Math.floor(image.width*1.15)));
    if(image.height<=chunkHeight*1.4)return [await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file);})];
    const parts:string[]=[];
    for(let top=0;top<image.height;top+=chunkHeight){
      const height=Math.min(chunkHeight+24,image.height-top);
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=height;
      const context=canvas.getContext('2d');if(!context)throw new Error('无法处理图片');
      context.drawImage(image,0,top,image.width,height,0,0,image.width,height);
      parts.push(canvas.toDataURL('image/jpeg',0.9));
    }
    return parts;
  }finally{image.close();}
}
export default function ImportPanel({onApply}:{onApply:(sets:TrainingSet[],title:string)=>boolean}){
  const [open,setOpen]=useState(false),[text,setText]=useState(''),[imageDataUrls,setImageDataUrls]=useState<string[]>([]),[fileName,setFileName]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<ImportPreview|null>(null),[imageReady,setImageReady]=useState<boolean|null>(null);
  useEffect(()=>{void fetch('/api/import-plan').then(r=>r.json()).then((v:unknown)=>setImageReady(Boolean((v as {imageRecognitionAvailable?:boolean}).imageRecognitionAvailable))).catch(()=>setImageReady(false));},[]);
  async function chooseFile(file?:File){
    if(!file)return;
    setError('');setPreview(null);setFileName('');setImageDataUrls([]);
    if(file.size>8_000_000){setError('文件不能超过 8 MB');return;}
    if(/^image\/(png|jpeg|webp|gif)$/.test(file.type)){
      setImageDataUrls(await imageParts(file));setFileName(file.name);return;
    }
    if(/\.(txt|md|csv|json)$/i.test(file.name)){
      const contents=await file.text();if(contents.length>100_000){setError('文字内容不能超过 10 万字');return;}
      setText(contents);setImageDataUrls([]);setFileName(file.name);return;
    }
    setError('支持 PNG、JPEG、WebP、GIF 图片及 TXT、MD、CSV、JSON 文字文件');
  }
  async function parse(){
    setError('');setPreview(null);setLoading(true);
    try{const response=await fetch('/api/import-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,imageDataUrls})});const result=await response.json() as ImportPreview&{error?:string};if(!response.ok)throw new Error(result.error||'识别失败');setPreview(result);}
    catch(e){setError(e instanceof Error?e.message:'识别失败，请重试');}
    finally{setLoading(false);}
  }
  return <section className="import-panel"><button type="button" className="import-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="import-toggle-main"><span className="import-toggle-icon"><FileUp size={21}/></span><span className="import-toggle-copy"><strong>导入训练</strong><small>图片 · 文件 · 文字</small></span></span><span className="import-toggle-action"><ChevronRight size={18} className={open?'turn':''}/></span></button>{open&&<div className="import-content">
    <div className="import-source">
      <label className="import-upload"><span className="import-upload-icon"><ImagePlus size={29} strokeWidth={1.6}/></span><strong>选择图片或文件</strong><input aria-label="选择图片或文字文件" type="file" disabled={loading} accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.json" onChange={e=>{void chooseFile(e.target.files?.[0]).catch(()=>setError('文件读取失败'));e.target.value='';}}/></label>
      {fileName&&<div className="import-selected"><span>{fileName}</span><button type="button" className="icon-btn" disabled={loading} aria-label="移除导入文件" onClick={()=>{setFileName('');setImageDataUrls([]);setPreview(null);}}><X size={16}/></button></div>}
      <label className="import-text-label">或粘贴训练内容<textarea disabled={loading} value={text} maxLength={100000} placeholder={'杠铃卧推 4组×8次 60kg\n哑铃肩推 3组×10次 20kg'} onChange={e=>{setText(e.target.value);setPreview(null);}}/></label>
    </div>
    <div className="import-actions"><button type="button" className="button primary" disabled={loading||(!text.trim()&&!imageDataUrls.length)||(Boolean(imageDataUrls.length)&&imageReady===false)} onClick={()=>void parse()}>{loading?<LoaderCircle className="spin" size={16}/>:<ScanLine size={16}/>} {loading?'正在识别…':'识别动作与组'}</button></div>
    {Boolean(imageDataUrls.length)&&imageReady===false&&<p className="import-error" role="status">暂时无法识别图片，请粘贴训练文字。</p>}
    {error&&<p className="import-error" role="alert">{error}</p>}
    {preview&&<div className="import-preview" role="status"><strong>{exerciseGroups(preview.sets).length} 个动作 · {preview.sets.length} 组</strong><ul>{exerciseGroups(preview.sets).map(indices=><li key={preview.sets[indices[0]].id}>{preview.sets[indices[0]].exercise}{preview.sets[indices[0]].components?.length?` · ${preview.sets[indices[0]].components!.map(c=>`${c.exercise}${c.reps??""}${c.reps?"次":""}`).join(" + ")}`:""} <span>{indices.length} 组</span></li>)}</ul>{preview.warnings.length>0&&<p>{preview.warnings.slice(0,4).join('；')}</p>}<button type="button" className="button primary" onClick={()=>{if(onApply(preview.sets,preview.title)){setOpen(false);setPreview(null);}}}>使用这些动作</button></div>}
  </div>}</section>;
}
