// Desktop Social Hour manager. Shares Supabase Preview with VIPpl Android.
// No secret keys, direct table access, or browser-side admin bypasses.
const markets=['Los Angeles','San Francisco','New York City','Chicago','Miami','Dallas','Frisco','Buckhead'];
const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const timezones={'Los Angeles':'America/Los_Angeles','San Francisco':'America/Los_Angeles','New York City':'America/New_York',Chicago:'America/Chicago',Miami:'America/New_York',Dallas:'America/Chicago',Frisco:'America/Chicago',Buckhead:'America/New_York'};
const html=(tag,text,attrs={})=>{const n=document.createElement(tag);n.textContent=String(text??'');for(const [k,v] of Object.entries(attrs)){if(k==='className')n.className=v;else n.setAttribute(k,v)}return n};
const formField=(form,label,key,initial='',type='text')=>{const wrap=html('label',label,{className:'sh-field'});const input=html('input','',{name:key,type,value:String(initial??'')});input.value=String(initial??'');wrap.append(input);form.append(wrap);return input};
const choice=(form,label,key,options,value)=>{const wrap=html('label',label,{className:'sh-field'}),el=html('select','',{name:key});for(const option of options){const o=html('option',option,{value:option});el.append(o)}el.value=value||options[0];wrap.append(el);form.append(wrap);return el};
const minutes=v=>{if(!v)return null;const a=/^(\d{2}):(\d{2})$/.exec(v);if(!a)return null;const h=Number(a[1]),m=Number(a[2]);return h<24&&m<60?h*60+m:null};
const clock=n=>Number.isInteger(n)?String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):'';
export function createSocialHourAdmin(client,container,notify){
 let market='Los Angeles',search='',records=[],editing=null,requestId=0;
 const cache=new Map();
 container.replaceChildren();
 const header=html('div','',{className:'row sh-header'}),title=html('h2','Social Hour · City Audit'),add=html('button','+ Add venue'),reload=html('button','Refresh all cities',{className:'secondary'});
 header.append(title,add,reload);container.append(header);
 container.append(html('p','Review every city in one place. Expand a city to inspect venues, reported schedules, source links and incomplete locations. Edit changes are saved to Preview and reflected in the mobile app on its next refresh.'));
 const summary=html('div','',{className:'sh-summary'});container.append(summary);
 const filters=html('div','',{className:'row sh-filters'}),query=html('input','',{type:'search',placeholder:'Search all cities by venue or address'}),onlyIssues=html('label','',{className:'sh-filter-label'});
 const issueCheck=html('input','',{type:'checkbox'});onlyIssues.append(issueCheck,html('span','Show only listings needing an audit'));
 filters.append(query,onlyIssues);container.append(filters);
 const state=html('div','',{className:'muted'}),list=html('div','',{className:'sh-list'}),edit=html('div','',{className:'card hidden',id:'shEditor'});
 container.append(state,list,edit);
 const safeError=e=>notify(e?.message||String(e),true);
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data};
 const needsAudit=item=>!item.promotion_hours||!String(item.promotion_hours).trim()||
   !Number.isFinite(item.latitude)||!Number.isFinite(item.longitude)||
   /not confirmed/i.test(item.address||'')||item.status!=='open';
 async function load(){
  const id=++requestId;state.textContent='Loading eight city inventories…';
  try{
   const allowed=await rpc('vippl_social_hour_is_admin');if(!allowed)throw Error('Social Hour requires an authorized administrator.');
   const results=await Promise.allSettled(markets.map(m=>rpc('vippl_social_hour_admin_list',{p_market:m,p_search:'',p_offset:0})));
   if(id!==requestId)return;
   cache.clear();const errors=[];
   for(let i=0;i<markets.length;i++){
    const result=results[i];
    if(result.status==='fulfilled'&&Array.isArray(result.value))cache.set(markets[i],result.value);
    else errors.push(markets[i]+': '+(result.reason?.message||'Query failed'));
   }
   if(errors.length){state.textContent='Some cities could not load: '+errors.join('; ');notify('Partial Social Hour inventory — retry failed cities.',true)}
   else state.textContent='All eight city inventories loaded · Preview database';
   render();
  }catch(e){cache.clear();render();state.textContent='Could not load Social Hour: '+(e?.message||e);safeError(e)}
 }
 function render(){
  list.replaceChildren();summary.replaceChildren();
  const all=markets.flatMap(m=>cache.get(m)||[]);
  const total=all.length,issues=all.filter(needsAudit).length,located=all.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).length;
  for(const [label,value] of [['Total venues',total],['Need audit',issues],['With coordinates',located],['Cities loaded',cache.size]]){
   const box=html('div','',{className:'sh-stat'});box.append(html('div',value,{className:'metric'}),html('div',label,{className:'muted'}));summary.append(box);
  }
  const term=query.value.trim().toLowerCase(),issueOnly=issueCheck.checked;
  for(const city of markets){
   const rows=cache.get(city);const section=html('details','',{className:'sh-city'});
   section.open=Boolean(term)||city===market;
   const heading=html('summary','',{className:'sh-city-heading'});
   const cityTitle=html('strong',city),badge=html('span',rows?rows.length+' venues · '+rows.filter(needsAudit).length+' need audit':'Unavailable',{className:'sh-count'});
   heading.append(cityTitle,badge);section.append(heading);
   const body=html('div','',{className:'sh-city-body'}),filtered=(rows||[]).filter(item=>
    (!term||[item.name,item.address,item.promotion_hours,item.venue_key].some(v=>String(v||'').toLowerCase().includes(term)))&&(!issueOnly||needsAudit(item)));
   if(!filtered.length)body.append(html('p',rows?'No matching venues in this city.':'Inventory unavailable; retry refresh.',{className:'muted'}));
   for(const item of filtered){
    const row=html('div','',{className:'sh-venue'});
    const info=html('div','',{className:'sh-venue-info'});info.append(html('strong',item.name));
    info.append(html('div',item.address,{className:'muted'}));
    info.append(html('div',item.promotion_hours||'Hours missing · needs review',{className:'muted'}));
    info.append(html('div',[
      item.status||'open',item.verification||'reported',
      item.edited?'Manually edited':'Directory source',
      Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)?'Location mapped':'Coordinates missing'
    ].join(' · '),{className:'muted'}));
    const controls=html('div','',{className:'row'}),source=html('a','Source',{href:item.source_url,target:'_blank',rel:'noopener noreferrer',className:'sh-source'}),button=html('button','Edit',{className:'secondary'});
    button.onclick=()=>{market=city;openEditor(item)};controls.append(source,button);row.append(info,controls);body.append(row);
   }
   section.append(body);list.append(section);
  }
 }
 function openEditor(item=null){
  editing=item;edit.replaceChildren();edit.classList.remove('hidden');edit.append(html('h3',item?'Edit '+item.name:'Add a Social Hour venue'));
  const form=html('form','',{className:'sh-form'}),grid=html('div','',{className:'sh-grid'});
  const m=choice(grid,'City','market',markets,item?.market||market);
  const name=formField(grid,'Venue name','name',item?.name||'');
  const address=formField(grid,'Street address','address',item?.address||'');
  const url=formField(grid,'Official / source URL (https)','url',item?.source_url||'','url');
  const hours=formField(grid,'Reported promotion details','hours',item?.promotion_hours||'');
  const lat=formField(grid,'Latitude (optional)','lat',item?.latitude??'','number');lat.step='any';
  const lon=formField(grid,'Longitude (optional)','lon',item?.longitude??'','number');lon.step='any';
  const verification=choice(grid,'Schedule confidence','verification',['reported','verified'],item?.verification||'reported');
  const status=choice(grid,'Listing status','status',['open','needs_review','closed'],item?.status||'open');
  const zone=choice(grid,'Venue timezone','timezone',['America/Los_Angeles','America/Chicago','America/New_York'],item?.timezone||timezones[item?.market||market]);
  m.onchange=()=>{if(!item)zone.value=timezones[m.value]};
  const start=formField(grid,'Promotion starts (24h HH:MM)','start',clock(item?.start_minutes),'time');
  const end=formField(grid,'Promotion ends (24h HH:MM)','end',clock(item?.end_minutes),'time');
  const note=formField(grid,'Internal note','note',item?.note||'');
  const days=html('fieldset','',{className:'sh-days'});days.append(html('legend','Applicable promotion days'));
  const checks=dayNames.map((day,i)=>{const label=html('label','');const check=html('input','',{type:'checkbox',value:String(i)});check.checked=(item?.weekdays||[]).includes(i);label.append(check,html('span',day));days.append(label);return check});
  form.append(grid,days);
  const hint=html('p','“Verified” requires explicit days, start/end times and a source. Use “reported” for directory information. Closing a venue removes it from the app; it does not delete source evidence.',{className:'muted'});
  form.append(hint);
  if(item){const history=html('div','',{className:'sh-history'});
   const toggle=html('button','View edit history',{type:'button',className:'secondary'});
   const output=html('div','',{className:'muted'});
   toggle.onclick=async()=>{toggle.disabled=true;output.textContent='Loading…';try{
    const entries=await rpc('vippl_social_hour_admin_audit',{p_market:item.market,p_key:item.venue_key});
    output.replaceChildren();
    if(!entries?.length){output.textContent='No manual edits recorded.';return}
    for(const record of entries){const block=html('div','',{className:'historyentry'});
     block.append(html('strong',new Date(record.changed_at).toLocaleString()));
     const prev=record.previous||{},current=record.current||{};
     for(const key of ['name','address','promotion_hours','weekdays','start_minutes','end_minutes','verification','status']){
      if(JSON.stringify(prev[key])!==JSON.stringify(current[key]))
       block.append(html('div',key+': '+JSON.stringify(prev[key]??null)+' → '+JSON.stringify(current[key]??null),{className:'muted'}));
     }
     output.append(block);
    }
   }catch(err){output.textContent='History unavailable';safeError(err)}finally{toggle.disabled=false}};
   history.append(toggle,output);form.append(history);
  }
  const actions=html('div','',{className:'row'}),save=html('button','Save to Preview',{type:'submit'}),cancel=html('button','Cancel',{type:'button',className:'secondary'});
  cancel.onclick=()=>edit.classList.add('hidden');actions.append(save,cancel);form.append(actions);edit.append(form);edit.scrollIntoView({behavior:'smooth',block:'start'});
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{
   if(!name.value.trim()||!address.value.trim()||!url.value.trim())throw Error('Venue name, address and source URL are required.');
   if(!/^https:\/\//i.test(url.value))throw Error('Source URL must use HTTPS.');
   const selected=checks.flatMap((c,i)=>c.checked?[i]:[]);
   const begin=minutes(start.value),finish=minutes(end.value);
   if(selected.length===0&&(start.value||end.value))throw Error('Select schedule days or clear both times.');
   if(selected.length>0&&(begin===null||finish===null||begin===finish))throw Error('Select valid promotion start and end times.');
   if(verification.value==='verified'&&selected.length===0)throw Error('Verified schedules need specific days and times.');
   if(Boolean(lat.value)!==Boolean(lon.value))throw Error('Enter both coordinates, or neither.');
   if(item?.status!=='closed'&&status.value==='closed'&&!confirm('Close this venue? It will disappear from the mobile Social Hour catalog.'))return;
   if(item?.market!==m.value&&item)throw Error('To move an existing venue to another city, create a new record and close the old one.');
   await rpc('vippl_social_hour_admin_save',{p_market:m.value,p_key:item?.venue_key||'',p_name:name.value.trim(),
    p_address:address.value.trim(),p_source_url:url.value.trim(),p_hours:hours.value.trim()||null,
    p_days:selected.length?selected:null,p_start:begin,p_end:finish,p_timezone:selected.length?zone.value:null,
    p_lat:lat.value?Number(lat.value):null,p_lon:lon.value?Number(lon.value):null,
    p_verification:verification.value,p_status:status.value,p_note:note.value.slice(0,500)});
   notify('Saved to Preview. App and desktop use the same member feed.');edit.classList.add('hidden');market=m.value;await load();
  }catch(err){safeError(err)}finally{save.disabled=false}};
 }
 add.onclick=()=>openEditor();reload.onclick=()=>load();
 query.oninput=render;issueCheck.onchange=render;
 void load();
 return {refresh:load};
}
