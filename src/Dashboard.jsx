import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Upload, TrendingUp, TrendingDown, List, Globe, X } from "lucide-react";

const SPA_MEMBERS = [
  { label: "Seerone Anandarajah (Evolve)",        csvNames: ["Seerone from Evolve Orthodontics"] },
  { label: "Seerone Anandarajah (Straight Smile)", csvNames: ["Seerone Anandarajah"] },
  { label: "Laura Duncan",                         csvNames: ["Laura Duncan"] },
  { label: "Wayne Chen",                           csvNames: ["Wayne Chen"] },
  { label: "Chris Orloff",                         csvNames: ["Chris Orloff"] },
  { label: "Theo Baisi",                           csvNames: ["The Ortho Practice"] },
  { label: "Zak Sullivan",                         csvNames: ["Ocean Orthodontics", "Ocean Orthodontics (old)"] },
  { label: "Shabier Shaboodien",                   csvNames: ["Shabier Shaboodien"] },
  { label: "Yann Taddei",                          csvNames: ["'@ Darwin Orthodontics"] },
  { label: "Amanda Lawrence",                      csvNames: ["Amanda Lawrence"] },
  { label: "Reuben How",                           csvNames: ["Reuben How"] },
  { label: "Lasni Kumarasinghe",                   csvNames: ["MySmile Orthodontics"] },
  { label: "David Bachmayer",                      csvNames: ["Bachmayer Orthodontics"] },
  { label: "Helen Moon",     csvNames: [] },
  { label: "Peter Wilkinson",csvNames: [] },
  { label: "Jeff Lipshatz",  csvNames: [] },
  { label: "Hashmat Popat",  csvNames: [] },
  { label: "Bruce Baker",    csvNames: [] },
  { label: "Crofton Daniels",csvNames: [] },
  { label: "Julian Todres",  csvNames: [] },
  { label: "Peter Munt",     csvNames: [] },
];

const TREATMENTS = ["Aligners","Braces","Pre-Treatment","Post-Treatment","Others"];
const T_COLORS = { Aligners:"#3B82F6", Braces:"#6366F1", "Pre-Treatment":"#0EA5E9", "Post-Treatment":"#8B5CF6", Others:"#94A3B8" };

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
  return lines.slice(1).map(line=>{
    const vals=[]; let inQ=false,cur="";
    for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){vals.push(cur.trim());cur="";}else cur+=ch;}
    vals.push(cur.trim());
    const obj={};headers.forEach((h,i)=>{obj[h]=vals[i]||"";});return obj;
  });
}
function fmt(n){return n===null||n===undefined?"—":n.toLocaleString();}
function fmtMonth(m){
  if(!m)return"";const[y,mo]=m.split("-");
  return`${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]} ${y}`;
}

// ─── Range Slider ─────────────────────────────────────────────────────────────
function RangeSlider({min,max,values,onChange,labels}){
  const trackRef=useRef(null),dragging=useRef(null);
  const pct=v=>max===min?0:((v-min)/(max-min))*100;
  const posToVal=clientX=>{const r=trackRef.current.getBoundingClientRect();return Math.round(min+Math.max(0,Math.min(1,(clientX-r.left)/r.width))*(max-min));};
  const onMD=(handle,e)=>{e.preventDefault();dragging.current=handle;
    const mv=ev=>{const v=posToVal(ev.clientX);if(dragging.current===0)onChange([Math.min(v,values[1]-1),values[1]]);else onChange([values[0],Math.max(v,values[0]+1)]);};
    const up=()=>{dragging.current=null;window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);};
  return(
    <div style={{padding:"8px 0 4px"}}>
      <div ref={trackRef} style={{position:"relative",height:4,background:"#E2E8F0",borderRadius:2,margin:"16px 8px"}}>
        <div style={{position:"absolute",left:`${pct(values[0])}%`,right:`${100-pct(values[1])}%`,height:"100%",background:"#3B82F6",borderRadius:2}}/>
        {[0,1].map(i=><div key={i} onMouseDown={e=>onMD(i,e)} style={{position:"absolute",left:`${pct(values[i])}%`,top:"50%",transform:"translate(-50%,-50%)",width:18,height:18,borderRadius:"50%",background:"#fff",border:"2.5px solid #3B82F6",boxShadow:"0 2px 6px rgba(59,130,246,0.25)",cursor:"grab",zIndex:2,userSelect:"none"}}/>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
        {labels.map((l,i)=><span key={i} style={{fontSize:10,fontWeight:(i===values[0]||i===values[1])?700:400,color:(i===values[0]||i===values[1])?"#3B82F6":"#CBD5E1",transition:"color 0.15s"}}>{l}</span>)}
      </div>
    </div>
  );
}

// ─── Sparkline (table row) ────────────────────────────────────────────────────
function Sparkline({data,color}){
  if(!data||data.length<2)return<div style={{width:64}}/>;
  const vals=data.map(d=>d.value),max=Math.max(...vals,1),w=64,h=24;
  const pts=vals.map((v,i)=>`${(i/(vals.length-1))*w},${h-(v/max)*(h-2)-1}`).join(" ");
  return(<svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7}/>
    <circle cx={w} cy={h-(vals[vals.length-1]/max)*(h-2)-1} r={3} fill={color}/>
  </svg>);
}

// ─── Line Chart with Y-axis scale — pixel-accurate ───────────────────────────
function LineChart({history,color,height=200}){
  const [hov,setHov]=useState(null);
  const [W,setW]=useState(500);
  const containerRef=useRef(null);

  useEffect(()=>{
    const el=containerRef.current; if(!el)return;
    const ro=new ResizeObserver(([e])=>setW(e.contentRect.width));
    ro.observe(el); return()=>ro.disconnect();
  },[]);

  if(!history||history.length<2)return<div ref={containerRef}/>;

  const vals=history.map(h=>h.value);
  const dataMax=Math.max(...vals,1);
  const rawMin=Math.min(...vals);
  // Option C: keep 0 as baseline, proportional scale
  const dataMin=0;
  const range=dataMax-dataMin||1;

  const PADL=46,PADR=12,PADT=12,PADB=8;
  const chartW=W-PADL-PADR;
  const chartH=height-PADT-PADB;

  const toX=i=>PADL+(i/(history.length-1))*chartW;
  const toY=v=>PADT+((dataMax-v)/range)*chartH;

  const pts=history.map((h,i)=>`${toX(i)},${toY(h.value)}`).join(" ");
  const area=`${toX(0)},${height-PADB} `+history.map((h,i)=>`${toX(i)},${toY(h.value)}`).join(" ")+` ${toX(history.length-1)},${height-PADB}`;

  // Nice Y ticks
  const nTicks=4;
  const rawStep=range/nTicks;
  const mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  const tickStep=Math.ceil(rawStep/mag)*mag||1;
  const ticks=[];
  for(let t=Math.floor(dataMin/tickStep)*tickStep;t<=dataMax+tickStep;t+=tickStep){
    if(t>=dataMin-tickStep*0.1&&t<=dataMax+tickStep*0.1)ticks.push(t);
  }

  const gradId=`grad${color.replace(/[^a-z0-9]/gi,"")}`;

  // Tooltip position clamped inside container
  const hovX=hov!==null?toX(hov):0;
  const tooltipW=120;
  const tooltipLeft=Math.max(0,Math.min(W-tooltipW, hovX-tooltipW/2));

  return(
    <div ref={containerRef} style={{position:"relative",userSelect:"none",marginTop:8,marginBottom:4}}>
      {hov!==null&&(
        <div style={{
          position:"absolute",top:0,left:tooltipLeft,
          background:"#1E293B",color:"#fff",borderRadius:8,padding:"5px 10px",
          fontSize:11,fontWeight:600,whiteSpace:"nowrap",zIndex:10,pointerEvents:"none",
          boxShadow:"0 4px 12px rgba(0,0,0,0.18)",width:tooltipW,textAlign:"center"
        }}>
          <span style={{color:"#94A3B8",fontWeight:400}}>{fmtMonth(history[hov].month)} </span>{history[hov].value}
        </div>
      )}
      <svg width={W} height={height} style={{display:"block",overflow:"visible"}}
        onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
          <clipPath id={`clip${gradId}`}>
            <rect x={PADL} y={0} width={chartW} height={height}/>
          </clipPath>
        </defs>
        {/* Grid + Y ticks */}
        {ticks.map(t=>(
          <g key={t}>
            <line x1={PADL} y1={toY(t)} x2={W-PADR} y2={toY(t)} stroke="#F1F5F9" strokeWidth={1}/>
            <text x={PADL-6} y={toY(t)} textAnchor="end" fontSize={10} fill="#94A3B8" dominantBaseline="middle">{t.toLocaleString()}</text>
          </g>
        ))}
        {/* Y axis */}
        <line x1={PADL} y1={PADT} x2={PADL} y2={height-PADB} stroke="#E2E8F0" strokeWidth={1}/>
        {/* Area fill */}
        <polygon points={area} fill={`url(#${gradId})`} clipPath={`url(#clip${gradId})`}/>
        {/* Line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {/* Hover zones + dots */}
        {history.map((h,i)=>(
          <g key={i} onMouseEnter={()=>setHov(i)} style={{cursor:"pointer"}}>
            <rect x={toX(i)-chartW/history.length/2} y={0} width={chartW/history.length} height={height} fill="transparent"/>
            <circle cx={toX(i)} cy={toY(h.value)} r={hov===i?5:3}
              fill={hov===i?color:"#fff"} stroke={color} strokeWidth={2} style={{transition:"r 0.1s"}}/>
          </g>
        ))}
        {/* X axis labels */}
        {history.map((h,i)=>{
          const show=i===0||i===history.length-1||history.length<=6||i%Math.ceil(history.length/5)===0;
          return show?(
            <text key={i} x={toX(i)} y={height} textAnchor="middle" fontSize={10}
              fill={hov===i?"#3B82F6":"#94A3B8"} fontWeight={hov===i?700:400}>
              {fmtMonth(h.month).split(" ")[0]}
            </text>
          ):null;
        })}
      </svg>
    </div>
  );
}

// ─── Global Chart — pixel-accurate ───────────────────────────────────────────
function GlobalChart({history,color="#3B82F6"}){
  const [hov,setHov]=useState(null);
  const [W,setW]=useState(800);
  const containerRef=useRef(null);

  useEffect(()=>{
    const el=containerRef.current; if(!el)return;
    const ro=new ResizeObserver(([e])=>setW(e.contentRect.width));
    ro.observe(el); return()=>ro.disconnect();
  },[]);

  if(!history||history.length<2)return<div ref={containerRef}/>;

  const vals=history.map(h=>h.value);
  const dataMax=Math.max(...vals,1);
  const rawMin=Math.min(...vals);
  // Option C: keep 0 as baseline
  const dataMin=0;
  const range=dataMax-dataMin||1;
  const H=220;
  const PADL=56,PADR=16,PADT=16,PADB=20;
  const chartW=W-PADL-PADR;
  const chartH=H-PADT-PADB;

  const toX=i=>PADL+(i/(history.length-1))*chartW;
  const toY=v=>PADT+((dataMax-v)/range)*chartH;

  const pts=history.map((h,i)=>`${toX(i)},${toY(h.value)}`).join(" ");
  const area=`${toX(0)},${H-PADB} `+history.map((h,i)=>`${toX(i)},${toY(h.value)}`).join(" ")+` ${toX(history.length-1)},${H-PADB}`;

  const nTicks=5;
  const rawStep=range/nTicks;
  const mag=Math.pow(10,Math.floor(Math.log10(rawStep||1)));
  const tickStep=Math.ceil(rawStep/mag)*mag||1;
  const ticks=[];
  for(let t=Math.floor(dataMin/tickStep)*tickStep;t<=dataMax+tickStep;t+=tickStep){
    if(t>=dataMin-tickStep*0.1&&t<=dataMax+tickStep*0.1)ticks.push(t);
  }

  const hovX=hov!==null?toX(hov):0;
  const tooltipW=150;
  const tooltipLeft=Math.max(0,Math.min(W-tooltipW, hovX-tooltipW/2));

  return(
    <div ref={containerRef} style={{position:"relative",userSelect:"none"}}>
      {hov!==null&&(
        <div style={{
          position:"absolute",top:4,left:tooltipLeft,
          background:"#1E293B",color:"#fff",borderRadius:8,padding:"5px 12px",
          fontSize:11,fontWeight:600,whiteSpace:"nowrap",zIndex:10,pointerEvents:"none",
          boxShadow:"0 4px 12px rgba(0,0,0,0.18)",width:tooltipW,textAlign:"center"
        }}>
          <span style={{color:"#94A3B8",fontWeight:400}}>{fmtMonth(history[hov].month)} </span>{history[hov].value.toLocaleString()} MUSP
        </div>
      )}
      <svg width={W} height={H} style={{display:"block",overflow:"visible"}}
        onMouseLeave={()=>setHov(null)}>
        <defs>
          <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
          <clipPath id="gClip"><rect x={PADL} y={0} width={chartW} height={H}/></clipPath>
        </defs>
        {ticks.map(t=>(
          <g key={t}>
            <line x1={PADL} y1={toY(t)} x2={W-PADR} y2={toY(t)} stroke="#F1F5F9" strokeWidth={1}/>
            <text x={PADL-6} y={toY(t)} textAnchor="end" fontSize={11} fill="#94A3B8" dominantBaseline="middle">{t.toLocaleString()}</text>
          </g>
        ))}
        <line x1={PADL} y1={PADT} x2={PADL} y2={H-PADB} stroke="#E2E8F0" strokeWidth={1}/>
        <polygon points={area} fill="url(#gGrad)" clipPath="url(#gClip)"/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {history.map((h,i)=>(
          <g key={i} onMouseEnter={()=>setHov(i)} style={{cursor:"pointer"}}>
            <rect x={toX(i)-chartW/history.length/2} y={0} width={chartW/history.length} height={H} fill="transparent"/>
            <circle cx={toX(i)} cy={toY(h.value)} r={hov===i?5:3}
              fill={hov===i?color:"#fff"} stroke={color} strokeWidth={2} style={{transition:"r 0.1s"}}/>
          </g>
        ))}
        {history.map((h,i)=>{
          const show=i===0||i===history.length-1||history.length<=8||i%Math.ceil(history.length/6)===0;
          return show?(
            <text key={i} x={toX(i)} y={H} textAnchor="middle" fontSize={11}
              fill={hov===i?color:"#94A3B8"} fontWeight={hov===i?700:400}>
              {fmtMonth(h.month).split(" ")[0]}
            </text>
          ):null;
        })}
      </svg>
    </div>
  );
}

// ─── Doctor Modal (centered overlay) ─────────────────────────────────────────
function DoctorModal({doctor,onClose,dateRange,months,allRows}){
  if(!doctor)return null;
  const {label,csvNames,lastVal,firstVal,delta,pct,avgMonthly,breakdown,history}=doctor;
  const isUp=delta>0||doctor.isNewEntry,isDown=delta<0;
  const color=isUp?"#10B981":isDown?"#EF4444":"#94A3B8";
  const accentBg=isUp?"#ECFDF5":isDown?"#FEF2F2":"#F8FAFC";

  const [activeTreat,setActiveTreat]=useState(null);

  // Build per-treatment filtered history when a treatment is selected
  const chartHistory=useMemo(()=>{
    if(!activeTreat)return history;
    const selMonths=history.map(h=>h.month);
    const monthMap={};
    (allRows||[]).filter(r=>csvNames.includes(r.doctor)&&r.treat===activeTreat&&selMonths.includes(r.date))
      .forEach(r=>{monthMap[r.date]=(monthMap[r.date]||0)+r.musp;});
    return selMonths.map(m=>({month:m,value:monthMap[m]||0}));
  },[activeTreat,history,allRows,csvNames]);

  // Compute stats for the active treatment filter (or global if none)
  const filteredVals=useMemo(()=>{
    if(!activeTreat||!chartHistory||chartHistory.length===0)return{lastVal,firstVal,delta,pct,avgMonthly};
    const fLastVal=chartHistory[chartHistory.length-1]?.value??0;
    const fFirstVal=chartHistory[0]?.value??0;
    const fDelta=fLastVal-fFirstVal;
    const fPct=fFirstVal>0?fDelta/fFirstVal*100:null;
    const histVals=chartHistory.map(h=>h.value);
    const monthlyDeltas=histVals.slice(1).map((v,i)=>v-histVals[i]);
    const fAvg=monthlyDeltas.length>0?monthlyDeltas.reduce((a,b)=>a+b,0)/monthlyDeltas.length:0;
    return{lastVal:fLastVal,firstVal:fFirstVal,delta:fDelta,pct:fPct,avgMonthly:fAvg};
  },[activeTreat,chartHistory,lastVal,firstVal,delta,pct,avgMonthly]);

  const treatColor=activeTreat?T_COLORS[activeTreat]||"#3B82F6":color;
  const dispColor=activeTreat?treatColor:(isUp?"#10B981":isDown?"#EF4444":"#94A3B8");

  // close on Escape
  useEffect(()=>{
    const handler=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[onClose]);

  return(
    <>
      <style>{`
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes modalPop{from{opacity:0;transform:translate(-50%,-48%) scale(0.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      `}</style>

      {/* Backdrop — blurred */}
      <div onClick={onClose} style={{
        position:"fixed",inset:0,zIndex:200,
        background:"rgba(15,23,42,0.55)",
        backdropFilter:"blur(6px)",
        WebkitBackdropFilter:"blur(6px)",
        animation:"backdropIn 0.2s ease"
      }}/>

      {/* Close button — fixed top-right of viewport */}
      <button onClick={onClose} style={{
        position:"fixed", top:20, right:20, zIndex:210,
        border:"none", background:"rgba(255,255,255,0.95)", borderRadius:12,
        width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", boxShadow:"0 2px 12px rgba(0,0,0,0.18)",
        backdropFilter:"blur(4px)"
      }}>
        <X size={16} color="#1E293B"/>
      </button>

      {/* Modal card */}
      <div style={{
        position:"fixed",top:"50%",left:"50%",
        transform:"translate(-50%,-50%)",
        zIndex:201,
        width:"min(860px,92vw)",
        maxHeight:"88vh",
        overflowY:"auto",
        background:"#fff",
        borderRadius:24,
        boxShadow:"0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
        animation:"modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        display:"grid",
        gridTemplateColumns:"1fr 1fr",
      }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{padding:"32px 28px 32px 32px",borderRight:"1px solid #F1F5F9"}}>

          {/* Doctor name header */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
            <div style={{
              width:44,height:44,borderRadius:14,
              background:accentBg,
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0
            }}>
              <div style={{width:14,height:14,borderRadius:"50%",background:color}}/>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:700,color:"#0F172A",letterSpacing:"-0.02em",lineHeight:1.2}}>{label}</div>
              {csvNames.length>0&&<div style={{fontSize:11,color:"#94A3B8",marginTop:3}}>{csvNames.join(" + ")}</div>}
            </div>
          </div>

          {/* 4 stat tiles */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {[
              {label:"Start",value:fmt(filteredVals.firstVal),sub:fmtMonth(months[dateRange[0]]),c:"#0F172A"},
              {label:"Last",value:fmt(filteredVals.lastVal),sub:fmtMonth(months[Math.min(dateRange[1],months.length-1)]),c:"#0F172A"},
              {label:"Period Δ",value:(filteredVals.delta>0?"+":"")+filteredVals.delta,sub:filteredVals.pct!==null?`${filteredVals.pct>0?"+":""}${filteredVals.pct.toFixed(1)}%`:"—",c:dispColor},
              {label:"Avg / month",value:(filteredVals.avgMonthly>0?"+":"")+filteredVals.avgMonthly.toFixed(1),sub:"monthly average",c:filteredVals.avgMonthly>0?"#10B981":filteredVals.avgMonthly<0?"#EF4444":"#94A3B8"},
            ].map(s=>(
              <div key={s.label} style={{
                padding:"14px 16px",borderRadius:14,
                background:s.c===color?accentBg:"#F8FAFC",
                border:"1px solid",
                borderColor:s.c===color?color+"33":"#F1F5F9"
              }}>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:28,fontWeight:700,color:s.c,letterSpacing:"-0.03em",lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:10,color:"#94A3B8",marginTop:5}}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Treatment breakdown — clickable to filter chart */}
          <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>
            Treatment breakdown — {fmtMonth(months[Math.min(dateRange[1],months.length-1)])}
            {activeTreat&&<span onClick={()=>setActiveTreat(null)} style={{marginLeft:8,cursor:"pointer",color:"#3B82F6",fontWeight:700,fontSize:10}}>✕ Clear</span>}
          </div>
          {Object.keys(breakdown).length===0?(
            <div style={{fontSize:12,color:"#CBD5E1"}}>No activity for this period</div>
          ):(
            Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).map(([t,v])=>{
              const maxB=Math.max(...Object.values(breakdown),1);
              const isActive=activeTreat===t;
              return(
                <div key={t} style={{marginBottom:10,cursor:"pointer",opacity:activeTreat&&!isActive?0.4:1,transition:"opacity 0.15s"}}
                  onClick={()=>setActiveTreat(prev=>prev===t?null:t)}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:600,color:T_COLORS[t]||"#94A3B8",display:"flex",alignItems:"center",gap:6}}>
                      {isActive&&<span style={{fontSize:9,background:T_COLORS[t]||"#3B82F6",color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>ACTIVE</span>}
                      {t}
                    </span>
                    <span style={{fontSize:12,fontWeight:700,color:"#334155"}}>{v}</span>
                  </div>
                  <div style={{height:7,background:"#F1F5F9",borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:`${(v/maxB)*100}%`,height:"100%",background:T_COLORS[t]||"#3B82F6",borderRadius:4,transition:"width 0.5s",
                      boxShadow:isActive?`0 0 6px ${T_COLORS[t]||"#3B82F6"}88`:""}}/>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── RIGHT COLUMN — chart ── */}
        <div style={{padding:"32px 32px 32px 28px",display:"flex",flexDirection:"column",justifyContent:"center",gap:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em"}}>
            {activeTreat?`${activeTreat} — MUSP over period`:"MUSP over period"} — hover for details
          </div>
          <LineChart history={chartHistory} color={treatColor} height={240}/>
          {/* Period label */}
          <div style={{padding:"10px 16px",background:"#F8FAFC",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#94A3B8"}}>Period</span>
            <span style={{fontSize:12,fontWeight:600,color:"#3B82F6"}}>{fmtMonth(months[dateRange[0]])} → {fmtMonth(months[Math.min(dateRange[1],months.length-1)])}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
const Logo=()=>(
  <svg width="102" height="48" viewBox="0 0 136 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <g clipPath="url(#lc)">
      <path d="M6.92527 56.084C9.04308 56.084 10.2886 54.8564 10.2886 52.9371C10.2886 51.0178 9.04308 49.8341 6.92527 49.8341H3.16944V56.084H6.92527ZM7.15305 47.564C11.0446 47.564 13.0461 50.1117 13.0461 52.9323C13.0461 55.7528 11.0446 58.3249 7.15305 58.3249H3.16944V63.7662H0.407082V47.564H7.15305Z" fill="white"/>
      <path d="M22.8839 50.1117L25.7626 57.448H20.0295L22.8839 50.1117ZM21.1344 47.564L14.7083 63.7662H17.5628L19.1766 59.6206H26.6155L28.2245 63.7662H31.0789L24.6528 47.564H21.1296H21.1344Z" fill="white"/>
      <path d="M38.0575 49.8341V55.5531H42.2253C44.2752 55.5531 45.4044 54.4667 45.4044 52.6595C45.4044 50.8522 44.2752 49.8341 42.2253 49.8341H38.0575ZM45.1039 63.7662L40.752 57.8182H38.0575V63.7662H35.2952V47.564H42.6614C46.0926 47.564 48.2346 49.6002 48.2346 52.6546C48.2346 55.4069 46.5287 57.3067 43.6743 57.677L48.443 63.7662H45.1039Z" fill="white"/>
      <path d="M51.3459 47.564V49.8341H56.7107V63.7662H59.473V49.8341H64.7942V47.564H51.3459Z" fill="white"/>
      <path d="M80.5251 47.564V60.0639L72.5337 47.564H69.2624V63.7662H71.9812V51.3588L79.8999 63.7662H83.239V47.564H80.5251Z" fill="white"/>
      <path d="M89.1369 47.564V63.7662H100.676V61.4961H91.8992V56.7076H99.6387V54.4131H91.8992V49.8341H100.676V47.564H89.1369Z" fill="white"/>
      <path d="M108.57 49.8341V55.5531H112.738C114.788 55.5531 115.917 54.4667 115.917 52.6595C115.917 50.8522 114.788 49.8341 112.738 49.8341H108.57ZM115.617 63.7662L111.265 57.8182H108.57V63.7662H105.808V47.564H113.179C116.61 47.564 118.752 49.6002 118.752 52.6546C118.752 55.4069 117.046 57.3067 114.192 57.677L118.961 63.7662H115.622H115.617Z" fill="white"/>
      <path d="M122.828 58.281H125.547C125.731 60.478 127.296 61.7543 129.947 61.7543C132.181 61.7543 133.354 60.8287 133.354 59.3722C133.354 55.2997 123.177 59.002 123.177 52.221C123.177 49.2836 125.503 47.3351 129.302 47.3351C133.102 47.3351 135.544 49.3031 135.637 52.5669H132.898C132.806 50.6232 131.561 49.532 129.215 49.532C127.097 49.532 125.9 50.4576 125.9 51.8947C125.9 56.2935 136.01 52.45 136.01 59.002C136.01 62.0563 133.8 64 129.792 64C125.784 64 122.973 61.8712 122.838 58.281" fill="white"/>
      <path d="M0 30.5532H9.37747C9.89602 33.2276 11.2869 34.6841 14.5872 34.6841C17.0781 34.6841 18.406 33.9291 18.406 32.1218C18.406 27.002 0.344083 32.9353 0.344083 20.2503C0.344083 13.8493 5.15155 10.2981 13.3126 10.2981C21.9389 10.2981 26.5719 13.9077 27.1486 21.0053H17.9989C17.4755 18.0971 16.0314 17.1667 13.3659 17.1667C10.9331 17.1667 9.54709 18.1556 9.54709 19.729C9.54709 25.1996 27.7835 18.9155 27.7835 31.1962C27.7835 37.6557 22.8064 41.3238 14.1801 41.3238C5.55379 41.3238 0.232619 37.4218 0 30.5532Z" fill="white"/>
      <path d="M80.3555 22.5203V40.7344H70.6291V23.0416C70.6291 19.7242 68.487 18.0971 65.7101 18.0971C62.5843 18.0971 60.4423 20.0749 60.3841 24.2058V40.7344H50.6577V23.0416C50.6577 19.7242 48.5738 18.0971 45.797 18.0971C42.613 18.0971 40.4128 20.0749 40.4128 24.3227V40.7344H30.7445V10.8826H40.4128V16.2947C42.1477 11.9884 45.5062 10.2981 49.9647 10.2981C54.6559 10.2981 57.7235 12.4512 59.2259 16.1778C61.4261 12.0469 65.3612 10.2981 69.4757 10.2981C77.0019 10.2981 80.3603 15.2425 80.3603 22.5203" fill="white"/>
      <path d="M103.395 0H93.7263V40.7344H103.395V0Z" fill="white"/>
      <path d="M116.538 22.9295H126.38C126.148 18.974 124.645 17.2836 121.747 17.2836C118.68 17.2836 116.998 19.0276 116.538 22.9295ZM126.497 30.7286H135.874C134.716 37.3634 129.564 41.3189 121.864 41.3189C112.195 41.3189 106.404 35.5561 106.404 25.8377C106.404 16.1193 112.365 10.2981 121.398 10.2981C132.748 10.2981 136.625 17.4541 135.816 28.5706H116.479C116.945 32.5846 118.621 34.2165 121.922 34.2165C124.699 34.2165 126.206 33.0522 126.497 30.7237" fill="white"/>
      <path d="M77.8645 4.80316C77.9178 4.14066 78.0826 3.522 78.3588 2.95205C78.6399 2.3821 79.0373 1.86086 79.551 1.40295C80.0647 0.940172 80.6463 0.589433 81.3005 0.350736C81.9887 0.0974255 82.672 -0.00487319 83.3505 0.0438405C84.0289 0.0876827 84.6638 0.238695 85.2599 0.487135C85.856 0.735574 86.3794 1.1058 86.8252 1.58806C87.2759 2.07033 87.6103 2.62079 87.8332 3.24433C88.2936 4.5255 88.2306 5.78718 87.6297 7.04399C87.0336 8.3008 86.0498 9.17765 84.6735 9.6794C84.0192 9.9181 83.3505 10.0253 82.6623 10.0058C81.9741 9.9863 81.3393 9.84503 80.7577 9.58684C80.1762 9.32866 79.6576 8.96331 79.1924 8.48592C78.7272 8.00852 78.3782 7.44344 78.1408 6.78581C77.9033 6.12818 77.8112 5.47054 77.8645 4.80316Z" fill="white"/>
      <path d="M91.1287 10.6147C91.0124 10.6537 90.8961 10.6732 90.7749 10.717C89.0593 11.3454 87.7072 12.193 86.7331 13.255C85.759 14.3169 85.0757 15.4763 84.6929 16.7283C84.31 17.9802 84.1889 19.3101 84.3246 20.7082C84.4602 22.1063 84.7607 23.441 85.2211 24.7222L90.9978 40.6808L91.1238 40.6369V10.6147H91.1287Z" fill="white"/>
    </g>
    <defs><clipPath id="lc"><rect width="136" height="64" fill="white"/></clipPath></defs>
  </svg>
);

// ─── App ──────────────────────────────────────────────────────────────────────
export default function Dashboard(){
  const [rawData,setRawData]=useState(null);
  const [fileName,setFileName]=useState(null);
  const [isDragging,setIsDrag]=useState(false);
  const [treatment,setTreat]=useState("All");
  const [dateRange,setRange]=useState([0,1]);
  const [sortBy,setSortBy]=useState("delta");
  const [activeTab,setActiveTab]=useState("overview");
  const [filterMode,setFilter]=useState("all");
  const [activeDoctor,setActiveDoctor]=useState(null);
  const [overviewTreat,setOverviewTreat]=useState(null);

  const [csvError,setCsvError]=useState(null);

  const handleFile=useCallback(file=>{
    if(!file)return;
    setCsvError(null);
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=e=>{
      try {
        const parsed=parseCSV(e.target.result);
        if(!parsed||parsed.length===0){setCsvError("Le fichier est vide ou ne contient pas de données.");return;}
        const sample=parsed[0];
        const keys=Object.keys(sample);
        // Check column count
        if(keys.length<9){
          setCsvError(`Format incorrect — ${keys.length} colonne(s) détectée(s), 9 minimum attendu.\nVérifiez que le fichier est bien un export DETAIL_1_MUSP.`);return;
        }
        // Check date column (col 6) — must look like YYYY-MM-DD
        const dateVal=(sample[keys[6]]||"").substring(0,7);
        if(!/^\d{4}-\d{2}$/.test(dateVal)){
          setCsvError(`Colonne Date (col. 7) invalide : "${sample[keys[6]]||"vide"}".\nFormat attendu : YYYY-MM-DD.\nVérifiez que vous avez importé le bon fichier (DETAIL_1_MUSP).`);return;
        }
        // Check MUSP column (col 8) — must be numeric
        const muspVal=sample[keys[8]];
        if(muspVal===undefined||muspVal===null||isNaN(parseInt(muspVal))){
          setCsvError(`Colonne MUSP (col. 9) non numérique : "${muspVal??'vide'}".\nVérifiez que vous avez importé le bon fichier.`);return;
        }
        // Check that we have at least a few rows with dates
        const validRows=parsed.filter(r=>{const k=Object.keys(r);return /^\d{4}-\d{2}/.test((r[k[6]]||""));});
        if(validRows.length<3){
          setCsvError(`Seulement ${validRows.length} ligne(s) valide(s) trouvée(s).\nLe fichier semble vide ou dans un format inattendu.`);return;
        }
        // Check doctor name column (col 5) is non-empty in majority of rows
        const withDoctor=parsed.filter(r=>{const k=Object.keys(r);return (r[k[5]]||"").trim().length>0;});
        if(withDoctor.length<parsed.length*0.5){
          setCsvError(`La colonne Docteur (col. 6) semble vide dans la majorité des lignes.\nVérifiez que le fichier correspond au format DETAIL_1_MUSP.`);return;
        }
        setRawData(parsed);
      } catch(err) {
        setCsvError("Impossible de lire le fichier. Vérifiez qu'il s'agit bien d'un CSV valide.");
      }
    };
    reader.readAsText(file);
  },[]);

  const onDrop=useCallback(e=>{
    e.preventDefault();setIsDrag(false);
    const f=e.dataTransfer.files[0];
    if(f?.name.endsWith(".csv"))handleFile(f);
  },[handleFile]);

  const{months,stats,treatSummary,totals,globalHistory,filteredStats,filteredTotals,filteredGlobalHistory,allRows}=useMemo(()=>{
    if(!rawData)return{months:[],stats:[],treatSummary:[],totals:{},globalHistory:[],filteredStats:[],filteredTotals:{},filteredGlobalHistory:[],allRows:[]};
    const rows=rawData.map(r=>{const k=Object.keys(r);return{doctor:(r[k[5]]||"").trim(),date:(r[k[6]]||"").substring(0,7),treat:(r[k[7]]||"").trim(),musp:parseInt(r[k[8]])||0};}).filter(r=>r.date&&r.doctor);
    const allMonths=[...new Set(rows.map(r=>r.date))].sort();
    if(!allMonths.length)return{months:[],stats:[],treatSummary:[],totals:{},globalHistory:[],filteredStats:[],filteredTotals:{},filteredGlobalHistory:[],allRows:rows};
    const si=Math.min(dateRange[0],allMonths.length-1);
    const ei=Math.min(Math.max(dateRange[1],si+1),allMonths.length-1);
    const selMonths=allMonths.slice(si,ei+1);
    const firstM=allMonths[si],lastM=allMonths[ei];
    const allCsvNames=new Set(SPA_MEMBERS.flatMap(m=>m.csvNames));

    // Helper: build stats for a given row filter
    const buildStats=(rowFilter)=>{
      const tRows=rowFilter?rows.filter(rowFilter):rows;
      const memberStats=SPA_MEMBERS.map(member=>{
        const myRows=tRows.filter(r=>member.csvNames.includes(r.doctor));
        const monthMap={};myRows.forEach(r=>{monthMap[r.date]=(monthMap[r.date]||0)+r.musp;});
        const lastVal=monthMap[lastM]||0,firstVal=monthMap[firstM]||0;
        const delta=lastVal-firstVal;
        const pct=firstVal>0?(lastVal-firstVal)/firstVal*100:null;
        const isNewEntry=firstVal===0&&lastVal>0;
        const histVals=selMonths.map(m=>monthMap[m]||0);
        const monthlyDeltas=histVals.slice(1).map((v,i)=>v-histVals[i]);
        const avgMonthly=monthlyDeltas.length>0?monthlyDeltas.reduce((a,b)=>a+b,0)/monthlyDeltas.length:0;
        const breakdown={};myRows.filter(r=>r.date===lastM).forEach(r=>{breakdown[r.treat]=(breakdown[r.treat]||0)+r.musp;});
        const history=selMonths.map(m=>({month:m,value:monthMap[m]||0}));
        return{...member,lastVal,firstVal,delta,pct,isNewEntry,avgMonthly,breakdown,history};
      });
      const sorted=[...memberStats].sort((a,b)=>{
        if(sortBy==="delta")return(b.delta??-Infinity)-(a.delta??-Infinity);
        if(sortBy==="volume")return b.lastVal-a.lastVal;
        return 0;
      });
      const globalMap={};
      tRows.filter(r=>allCsvNames.has(r.doctor)).forEach(r=>{globalMap[r.date]=(globalMap[r.date]||0)+r.musp;});
      const gHistory=selMonths.map(m=>({month:m,value:globalMap[m]||0}));
      const totalFirst=sorted.reduce((s,d)=>s+d.firstVal,0);
      const totalLast=sorted.reduce((s,d)=>s+d.lastVal,0);
      const totalDelta=totalLast-totalFirst;
      const totalPct=totalFirst>0?totalDelta/totalFirst*100:null;
      const tots={totalMUSP:totalLast,totalFirst,totalDelta,totalPct,growing:sorted.filter(d=>d.delta>0||d.isNewEntry).length,declining:sorted.filter(d=>d.delta<0).length};
      return{sorted,gHistory,tots};
    };

    // Base filter: global treatment pill filter
    const baseFilter=treatment==="All"?null:r=>r.treat===treatment;

    // Stats for the doctors tab (uses global treatment filter)
    const{sorted:stats,gHistory:globalHistory,tots:totals}=buildStats(baseFilter);

    // Stats filtered by overviewTreat (for overview tab KPIs)
    const overviewFilter=overviewTreat
      ? (treatment==="All"?r=>r.treat===overviewTreat:r=>r.treat===treatment&&r.treat===overviewTreat)
      : baseFilter;
    const{sorted:filteredStats,gHistory:filteredGlobalHistory,tots:filteredTotals}=buildStats(overviewFilter);

    // Treatment summary (always based on base filter)
    const treatMap={};
    (baseFilter?rows.filter(baseFilter):rows).filter(r=>selMonths.includes(r.date)&&allCsvNames.has(r.doctor))
      .forEach(r=>{treatMap[r.treat]=(treatMap[r.treat]||0)+r.musp;});
    const tTotal=Object.values(treatMap).reduce((s,v)=>s+v,0);
    const treatSummary=Object.entries(treatMap).map(([t,v])=>({t,v,pct:tTotal>0?v/tTotal:0})).sort((a,b)=>b.v-a.v);

    return{months:allMonths,stats,treatSummary,globalHistory,totals,filteredStats,filteredTotals,filteredGlobalHistory,allRows:rows};
  },[rawData,dateRange,treatment,sortBy,overviewTreat]);

  useEffect(()=>{if(months.length>1)setRange([0,months.length-1]);},[months.length]);

  const handleKpiClick=mode=>{setFilter(f=>f===mode?"all":mode);setActiveTab("doctors");};
  const visibleStats=useMemo(()=>{
    if(filterMode==="growing")return stats.filter(d=>d.delta>0||d.isNewEntry);
    if(filterMode==="declining")return stats.filter(d=>d.delta<0);
    return stats;
  },[stats,filterMode]);

  const periodSlider=(
    <div className="card" style={{padding:"16px 20px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <span style={{fontSize:11,fontWeight:600,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.07em"}}>Period</span>
        <span style={{fontSize:13,fontWeight:600,color:"#3B82F6"}}>{fmtMonth(months[dateRange[0]])} → {fmtMonth(months[Math.min(dateRange[1],months.length-1)])}</span>
      </div>
      {months.length>1&&<RangeSlider min={0} max={months.length-1} values={dateRange} onChange={setRange} labels={months.map(m=>fmtMonth(m).split(" ")[0])}/>}
    </div>
  );

  if(!rawData) return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F8FAFC",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}.upload-zone{border:2px dashed #CBD5E1;border-radius:20px;padding:64px 40px;text-align:center;cursor:pointer;transition:all 0.2s;background:#fff;}.upload-zone:hover,.upload-zone.drag{border-color:#3B82F6;background:#EFF6FF;}`}</style>
      <div style={{background:"linear-gradient(135deg,#1E3A5F,#2563EB)",padding:"0 32px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:20}}><Logo/><div style={{width:1,height:28,background:"rgba(255,255,255,0.2)"}}/><div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>SPA Growth Monitor</div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Monthly Unique Scanned Patients</div></div></div>
        <label style={{cursor:"pointer"}}><input type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/><div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 18px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:10,color:"#fff",fontSize:12,fontWeight:600}}><Upload size={13}/> Import CSV</div></label>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 64px)",padding:40}}>
        <label style={{cursor:"pointer",width:"100%",maxWidth:480}}>
          <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          <div className={`upload-zone ${isDragging?"drag":""}`} onDragOver={e=>{e.preventDefault();setIsDrag(true);}} onDragLeave={()=>setIsDrag(false)} onDrop={onDrop}>
            <div style={{width:56,height:56,borderRadius:16,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Upload size={26} color="#3B82F6"/></div>
            <div style={{fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:8}}>Drop your CSV here</div>
            <div style={{fontSize:13,color:"#94A3B8"}}>or click to browse — DETAIL_1_MUSP format</div>
          </div>
        </label>
      </div>
    </div>
  );

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F8FAFC",minHeight:"100vh",color:"#1E293B"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#F1F5F9;}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px;}
        .card{background:#fff;border-radius:16px;border:1px solid #E2E8F0;box-shadow:0 1px 4px rgba(0,0,0,0.04);}
        .pill{border:none;background:none;padding:5px 13px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:inherit;color:#64748B;}
        .pill:hover{background:#EFF6FF;color:#3B82F6;}.pill.active{background:#EFF6FF;color:#3B82F6;font-weight:600;}
        .trow{border-bottom:1px solid #F1F5F9;transition:background 0.1s;cursor:pointer;}.trow:hover{background:#F0F7FF;}
        .sort-btn{border:1px solid #E2E8F0;background:#fff;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:500;cursor:pointer;color:#64748B;font-family:inherit;transition:all 0.15s;}
        .sort-btn.active{border-color:#3B82F6;color:#3B82F6;background:#EFF6FF;}.sort-btn:hover:not(.active){border-color:#CBD5E1;color:#334155;}
        .kpi-card{cursor:pointer;transition:all 0.15s;}.kpi-card:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.08) !important;}
        .kpi-card.active-filter{box-shadow:0 0 0 2px currentColor !important;}
        .tab-btn{border:none;background:none;padding:10px 20px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;color:#94A3B8;border-bottom:2px solid transparent;transition:all 0.15s;display:flex;align-items:center;gap:7px;}
        .tab-btn.active{color:#3B82F6;border-bottom-color:#3B82F6;}.tab-btn:hover:not(.active){color:#334155;}
        .badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;flex-shrink:0;}
        .avg-chip{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600;margin-top:3px;}
      `}</style>

      {/* Doctor modal */}
      {activeDoctor&&<DoctorModal doctor={activeDoctor} onClose={()=>setActiveDoctor(null)} dateRange={dateRange} months={months} allRows={allRows}/>}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1E3A5F,#2563EB)",padding:"0 32px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 12px rgba(37,99,235,0.18)"}}>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <Logo/>
          <div style={{width:1,height:28,background:"rgba(255,255,255,0.2)"}}/>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.95)"}}>SPA Growth Monitor</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase",marginTop:1}}>Monthly Unique Scanned Patients</div>
          </div>
        </div>
        <label style={{cursor:"pointer"}}>
          <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 18px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:10,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            <Upload size={13}/> {fileName?"Change CSV":"Import CSV"}
          </div>
        </label>
      </div>

      {/* CSV Error banner */}
      {csvError&&(
        <div style={{background:"#FEF2F2",borderBottom:"1px solid #FECACA",padding:"12px 32px",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{fontSize:18,lineHeight:1,flexShrink:0}}>⚠️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#DC2626",marginBottom:2}}>Format de fichier incorrect</div>
            <div style={{fontSize:12,color:"#EF4444",whiteSpace:"pre-line"}}>{csvError}</div>
          </div>
          <button onClick={()=>{setCsvError(null);setFileName(null);}} style={{border:"none",background:"none",cursor:"pointer",color:"#EF4444",fontSize:18,lineHeight:1,padding:"0 4px",flexShrink:0}}>✕</button>
        </div>
      )}

      <div style={{padding:"24px 32px",maxWidth:1400,margin:"0 auto"}}>

        {/* KPI row — dark hero banner + 3 stat pills */}
        <div style={{marginBottom:20}}>

          {/* Hero banner */}
          <div style={{
            background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 60%,#2563EB 100%)",
            borderRadius:20,padding:"28px 36px",marginBottom:12,
            display:"flex",alignItems:"stretch",gap:0,
            boxShadow:"0 8px 32px rgba(37,99,235,0.18)"
          }}>
            {/* Total */}
            <div style={{flex:"0 0 auto",paddingRight:40}}>
              <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Portfolio Total MUSP</div>
              <div style={{fontSize:52,fontWeight:800,color:"#fff",letterSpacing:"-0.04em",lineHeight:1}}>{fmt(totals.totalMUSP)}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:8,fontWeight:500}}>{fmtMonth(months[Math.min(dateRange[1],months.length-1)])}</div>
            </div>

            {/* Divider */}
            <div style={{width:1,background:"rgba(255,255,255,0.1)",margin:"0 40px",flexShrink:0}}/>

            {/* Stats row */}
            <div style={{flex:1,display:"flex",alignItems:"center",gap:0}}>
              {[
                {label:"Period Δ",value:(totals.totalDelta>=0?"+":"")+fmt(totals.totalDelta),color:totals.totalDelta>=0?"#34D399":"#F87171",sub:`${fmt(totals.totalFirst)} → ${fmt(totals.totalMUSP)}`},
                {label:"Growth",value:totals.totalPct!==null?`${totals.totalPct>=0?"+":""}${totals.totalPct.toFixed(1)}%`:"—",color:totals.totalPct>=0?"#34D399":"#F87171",sub:"over selected period"},
                {label:"Period",value:null,color:"#94A3B8",sub:null,isDate:true},
              ].map((s,i)=>(
                <div key={s.label} style={{flex:1,paddingLeft:i===0?0:32,borderLeft:i>0?"1px solid rgba(255,255,255,0.08)":"",[i>0?"paddingLeft":""]:""}}>
                  <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{s.label}</div>
                  {s.isDate?(
                    <div style={{fontSize:15,fontWeight:600,color:"#fff",lineHeight:1.7}}>
                      {fmtMonth(months[dateRange[0]])}<br/>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>→ </span>
                      {fmtMonth(months[Math.min(dateRange[1],months.length-1)])}
                    </div>
                  ):(
                    <>
                      <div style={{fontSize:34,fontWeight:700,color:s.color,letterSpacing:"-0.03em",lineHeight:1}}>{s.value}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:8}}>{s.sub}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3 stat pills */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {label:"Doctors tracked",value:SPA_MEMBERS.length,color:"#6366F1",bg:"#EEF2FF",mode:null,badge:"👨‍⚕️",sub:"SPA members"},
              {label:"Growing",value:totals.growing??0,color:"#10B981",bg:"#ECFDF5",mode:"growing",badge:"↑",sub:"click to filter"},
              {label:"Declining",value:totals.declining??0,color:"#EF4444",bg:"#FEF2F2",mode:"declining",badge:"↓",sub:"click to filter"},
            ].map(k=>(
              <div key={k.label}
                className={`card kpi-card ${filterMode===k.mode&&k.mode?"active-filter":""}`}
                style={{
                  padding:"18px 22px",
                  display:"flex",alignItems:"center",gap:14,
                  cursor:k.mode?"pointer":"default",
                  borderLeft:`3px solid ${k.color}`,
                  transition:"all 0.15s"
                }}
                onClick={()=>k.mode&&handleKpiClick(k.mode)}>
                <div style={{
                  width:42,height:42,borderRadius:12,flexShrink:0,
                  background:k.bg,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:k.badge.length>1?20:18,fontWeight:700,color:k.color
                }}>{k.badge}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>{k.label}</div>
                  <div style={{fontSize:32,fontWeight:800,color:k.color,letterSpacing:"-0.03em",lineHeight:1}}>{k.value}</div>
                </div>
                {k.mode&&filterMode===k.mode&&(
                  <div style={{fontSize:9,background:k.color,color:"#fff",borderRadius:6,padding:"2px 7px",fontWeight:700,flexShrink:0}}>ACTIVE</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #E2E8F0",marginBottom:16,background:"#fff",borderRadius:"16px 16px 0 0",padding:"0 8px"}}>
          <button className={`tab-btn ${activeTab==="overview"?"active":""}`} onClick={()=>setActiveTab("overview")}>
            <Globe size={14}/> Portfolio Overview
          </button>
          <button className={`tab-btn ${activeTab==="doctors"?"active":""}`} onClick={()=>setActiveTab("doctors")}>
            <List size={14}/> Doctors
            {filterMode!=="all"&&<span style={{fontSize:10,background:"#EFF6FF",color:"#3B82F6",borderRadius:10,padding:"1px 7px",fontWeight:700}}>{filterMode}</span>}
          </button>
        </div>

        {/* ── DOCTORS TAB ── */}
        {activeTab==="doctors"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16,alignItems:"start"}}>
            <div style={{position:"sticky",top:0}}>
              {/* Sticky controls — always visible */}
              <div style={{position:"sticky",top:0,zIndex:20,background:"#F8FAFC",paddingBottom:8}}>
                {periodSlider}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:2,background:"#fff",border:"1px solid #E2E8F0",borderRadius:24,padding:"3px"}}>
                    {["All",...TREATMENTS].map(t=><button key={t} className={`pill ${treatment===t?"active":""}`} onClick={()=>setTreat(t)}>{t}</button>)}
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    {[["delta","↑↓ Growth"],["volume","Volume"]].map(([v,l])=><button key={v} className={`sort-btn ${sortBy===v?"active":""}`} onClick={()=>setSortBy(v)}>{l}</button>)}
                    {filterMode!=="all"&&<button className="sort-btn active" onClick={()=>setFilter("all")} style={{borderColor:"#F59E0B",color:"#F59E0B",background:"#FFFBEB"}}>✕ Clear filter</button>}
                  </div>
                </div>
              </div>

              {/* Scrollable doctor table */}
              <div className="card" style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 76px 76px 160px 72px",padding:"10px 20px",borderBottom:"1px solid #F1F5F9",position:"sticky",top:0,background:"#fff",zIndex:10}}>
                  {["Doctor","First","Last","Period change","Trend"].map((h,i)=><span key={h} style={{fontSize:10,fontWeight:600,color:"#CBD5E1",textTransform:"uppercase",letterSpacing:"0.07em",textAlign:i>0?"right":"left"}}>{h}</span>)}
                </div>
                <div style={{overflowY:"auto",maxHeight:"calc(100vh - 340px)"}}>
                {visibleStats.length===0&&<div style={{padding:"40px",textAlign:"center",color:"#CBD5E1",fontSize:13}}>No doctors match this filter.</div>}
                {visibleStats.map(d=>{
                  const isUp=d.delta>0||d.isNewEntry,isDown=d.delta<0;
                  const dot=isUp?"#10B981":isDown?"#EF4444":"#CBD5E1";
                  const dColor=isUp?"#10B981":isDown?"#EF4444":"#94A3B8";
                  const avgColor=d.avgMonthly>0?"#10B981":d.avgMonthly<0?"#EF4444":"#94A3B8";
                  return(
                    <div key={d.label} className="trow" onClick={()=>setActiveDoctor(d)}
                      style={{display:"grid",gridTemplateColumns:"1fr 76px 76px 160px 72px",padding:"12px 20px",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0}}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:500,color:"#1E293B"}}>{d.label}</div>
                          {d.csvNames.length>0&&<div style={{fontSize:10,color:"#CBD5E1",marginTop:1}}>{d.csvNames.join(" + ")}</div>}
                        </div>
                      </div>
                      <span style={{textAlign:"right",fontSize:13,color:"#94A3B8"}}>{fmt(d.firstVal)}</span>
                      <span style={{textAlign:"right",fontSize:14,fontWeight:700,color:"#0F172A"}}>{fmt(d.lastVal)}</span>
                      <div style={{textAlign:"right"}}>
                        <div>
                          <span style={{fontSize:13,fontWeight:700,color:dColor}}>{d.delta>0?"+":""}{d.delta}</span>
                          {d.pct!==null&&<span style={{fontSize:10,color:dColor,opacity:0.65,marginLeft:4}}>({d.pct>0?"+":""}{d.pct.toFixed(0)}%)</span>}
                          {d.isNewEntry&&<span style={{fontSize:10,background:"#ECFDF5",color:"#10B981",borderRadius:4,padding:"1px 5px",marginLeft:4,fontWeight:600}}>NEW</span>}
                        </div>
                        {Math.abs(d.avgMonthly)>0.1&&(
                          <span className="avg-chip" style={{background:avgColor+"18",color:avgColor}}>
                            avg {d.avgMonthly>0?"+":""}{d.avgMonthly.toFixed(1)}/mo
                          </span>
                        )}
                      </div>
                      <div style={{display:"flex",justifyContent:"flex-end"}}><Sparkline data={d.history} color={dot}/></div>
                    </div>
                  );
                })}
                </div>{/* end scrollable rows */}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="card" style={{padding:"18px 20px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Treatment breakdown</div>
                {treatSummary.map(({t,v,pct})=>(
                  <div key={t} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:11,fontWeight:600,color:T_COLORS[t]||"#94A3B8"}}>{t}</span>
                      <span style={{fontSize:11,color:"#64748B"}}>{v} <span style={{color:"#CBD5E1"}}>({(pct*100).toFixed(0)}%)</span></span>
                    </div>
                    <div style={{height:5,background:"#F1F5F9",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${pct*100}%`,height:"100%",background:T_COLORS[t]||"#3B82F6",borderRadius:3}}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{padding:"18px 20px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>
                  <TrendingUp size={11} style={{display:"inline",marginRight:5,color:"#10B981"}}/>Top growth
                </div>
                {stats.filter(d=>d.delta>0).slice(0,6).map(d=>(
                  <div key={d.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #F1F5F9"}}>
                    <span style={{fontSize:12,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:155}}>{d.label}</span>
                    <span className="badge" style={{background:"#ECFDF5",color:"#10B981"}}>+{d.delta}</span>
                  </div>
                ))}
                {stats.filter(d=>d.delta>0).length===0&&<div style={{fontSize:12,color:"#CBD5E1"}}>No growth detected</div>}
              </div>
              <div className="card" style={{padding:"18px 20px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>
                  <TrendingDown size={11} style={{display:"inline",marginRight:5,color:"#EF4444"}}/>Declining
                </div>
                {stats.filter(d=>d.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,6).map(d=>(
                  <div key={d.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #F1F5F9"}}>
                    <span style={{fontSize:12,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:155}}>{d.label}</span>
                    <span className="badge" style={{background:"#FEF2F2",color:"#EF4444"}}>{d.delta}</span>
                  </div>
                ))}
                {stats.filter(d=>d.delta<0).length===0&&<div style={{fontSize:12,color:"#CBD5E1"}}>No decline detected</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{gridColumn:"1/-1"}}>{periodSlider}</div>
            <div className="card" style={{padding:"20px 24px",gridColumn:"1/-1"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>
                    Total Portfolio MUSP {overviewTreat&&<span style={{color:T_COLORS[overviewTreat]||"#3B82F6"}}>— {overviewTreat}</span>}
                  </div>
                  <div style={{fontSize:28,fontWeight:700,color:"#0F172A"}}>{fmt(filteredTotals.totalMUSP)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:"#94A3B8",marginBottom:2}}>{fmtMonth(months[dateRange[0]])} → {fmtMonth(months[Math.min(dateRange[1],months.length-1)])}</div>
                  <div style={{fontSize:20,fontWeight:700,color:filteredTotals.totalDelta>=0?"#10B981":"#EF4444"}}>
                    {filteredTotals.totalDelta>=0?"+":""}{fmt(filteredTotals.totalDelta)} ({filteredTotals.totalPct!==null?`${filteredTotals.totalPct>=0?"+":""}${filteredTotals.totalPct.toFixed(1)}%`:"—"})
                  </div>
                </div>
              </div>
              <GlobalChart history={filteredGlobalHistory} color={overviewTreat?T_COLORS[overviewTreat]||"#3B82F6":undefined}/>
            </div>
            <div className="card" style={{padding:"20px 24px"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                Treatment breakdown
                {overviewTreat&&<span onClick={()=>setOverviewTreat(null)} style={{cursor:"pointer",color:"#3B82F6",fontSize:10,fontWeight:700}}>✕ Clear</span>}
              </div>
              {treatSummary.map(({t,v,pct})=>{
                const isActive=overviewTreat===t;
                return(
                  <div key={t} style={{marginBottom:14,cursor:"pointer",opacity:overviewTreat&&!isActive?0.4:1,transition:"opacity 0.15s"}}
                    onClick={()=>setOverviewTreat(prev=>prev===t?null:t)}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:600,color:T_COLORS[t]||"#94A3B8",display:"flex",alignItems:"center",gap:6}}>
                        {isActive&&<span style={{fontSize:9,background:T_COLORS[t]||"#3B82F6",color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>●</span>}
                        {t}
                      </span>
                      <span style={{fontSize:12,color:"#64748B",fontWeight:600}}>{v.toLocaleString()} <span style={{color:"#CBD5E1",fontWeight:400}}>({(pct*100).toFixed(0)}%)</span></span>
                    </div>
                    <div style={{height:8,background:"#F1F5F9",borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${pct*100}%`,height:"100%",background:T_COLORS[t]||"#3B82F6",borderRadius:4,
                        boxShadow:isActive?`0 0 6px ${T_COLORS[t]||"#3B82F6"}88`:""}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{padding:"20px 24px"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>All doctors — period change</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {[...filteredStats].sort((a,b)=>b.delta-a.delta).map(d=>{
                  const isUp=d.delta>0,isDown=d.delta<0;
                  const color=isUp?"#10B981":isDown?"#EF4444":"#94A3B8";
                  const maxAbs=Math.max(...filteredStats.map(s=>Math.abs(s.delta)),1);
                  return(
                    <div key={d.label} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:"1px solid #F8FAFC",cursor:"pointer"}}
                      onClick={()=>{setActiveDoctor(d);}}>
                      <span style={{fontSize:11,color:"#334155",width:190,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</span>
                      <div style={{flex:1,height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${(Math.abs(d.delta)/maxAbs)*100}%`,height:"100%",background:color,borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color,width:50,textAlign:"right"}}>{d.delta>0?"+":""}{d.delta}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding:"16px 32px",
        borderTop:"1px solid #E2E8F0",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        maxWidth:1400,margin:"24px auto 0",
        background:"transparent"
      }}>
        <span style={{fontSize:11,color:"#CBD5E1",fontWeight:500,letterSpacing:"0.03em"}}>SPA Growth Monitor — v2.0</span>
        <span style={{fontSize:11,color:"#CBD5E1"}}>Made with 🤙 by Antoine Heritier</span>
      </div>
    </div>
  );
}
