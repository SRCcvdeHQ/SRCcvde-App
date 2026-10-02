import { FormEvent,useEffect,useMemo,useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Role='owner'|'admin'|'staff'|'client'
type Membership={role:Role;status:'invited'|'active'|'suspended'}
type Profile={full_name:string|null;email:string|null}
type Inquiry={id:string;name:string;email:string;company:string|null;project_type:string;budget_range:string;timeline:string;involvement:string;details:string;status:string;created_at:string;updated_at:string}
type Client={id:string;name:string;primary_contact_name:string;primary_email:string;status:string;drive_folder_id:string|null;created_at:string}
type Project={id:string;client_id:string;name:string;project_type:string|null;status:string;phase:string;progress:number;created_at:string}
type Note={id:string;body:string;created_at:string}
type Activity={id:string;entity_type:string;entity_id:string;action:string;summary:string;created_at:string}
type DocumentRow={id:string;client_id:string;name:string;category:string;state:string;client_visible:boolean;created_at:string}
type Communication={id:string;channel:string;direction:string;subject:string|null;body:string;created_at:string}

const leadStatuses=['new','contacted','discovery','proposal','contract','won','lost','archived']
const stages=['Inquiry','Discovery','Proposal','Contract','Kickoff','Build','Launch']
const label=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const date=(s:string)=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(s))
const path=()=>window.location.pathname.replace(/\/+$/,'')||'/'

function Brand(){return <a className="brand" href="/" onClick={e=>{e.preventDefault();history.pushState({},'', '/');dispatchEvent(new PopStateEvent('popstate'))}} aria-label="SRCcvde workspace"><span>SRC</span>cvde<i/></a>}
function Avatar({name}:{name:string}){return <div className="avatar">{name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div>}
function Empty({children}:{children:string}){return <div className="empty">{children}</div>}
function StatusPill({value}:{value:string}){return <span className={'pill '+value}>{label(value)}</span>}

function Login(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');const{error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setMessage(error.message)}
 async function reset(){if(!email){setMessage('Enter your email first.');return}setBusy(true);const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:'https://app.srccvde.com/'});setBusy(false);setMessage(error?error.message:'Password reset email sent.')}
 return <main className="auth-page"><section className="auth-copy"><Brand/><p className="eyebrow">SRCcvde Workspace</p><h1>Your project has a home.</h1><p>One secure place for progress, documents, approvals, change requests and everything we build together.</p><div className="stage-preview">{stages.map((s,i)=><div key={s}><b>{String(i+1).padStart(2,'0')}</b><span>{s}</span></div>)}</div></section><section className="auth-panel"><form onSubmit={submit}><p className="eyebrow">Private access</p><h2>Welcome back.</h2><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><button className="text-button" type="button" onClick={reset} disabled={busy}>Forgot password?</button>{message&&<p className="form-message">{message}</p>}<p className="fine">Accounts are created by SRCcvde. Project applicants receive access when their workspace is ready.</p></form></section></main>
}

function Sidebar({role,current,navigate,onSignOut}:{role:Role;current:string;navigate:(p:string)=>void;onSignOut:()=>void}){
 const admin=role!=='client'
 const items=admin?[['Overview','/'],['Leads','/leads'],['Clients','/clients'],['Projects','/projects'],['Documents','/documents'],['Activity','/activity']]:[['Overview','/'],['Project','/project'],['Documents','/documents'],['Activity','/activity']]
 return <aside className="sidebar"><Brand/><nav>{items.map(([name,p])=><button className={(p==='/'?current==='/':current.startsWith(p))?'active':''} onClick={()=>navigate(p)} key={p}><span>{name[0]}</span>{name}</button>)}</nav><div className="sidebar-bottom"><small>{admin?'SRCcvde team':'Client workspace'}</small><button onClick={onSignOut}>Sign out</button></div></aside>
}

function AdminOverview({profile,navigate}:{profile:Profile|null;navigate:(p:string)=>void}){
 const[inquiries,setInquiries]=useState<Inquiry[]>([]),[clients,setClients]=useState(0),[projects,setProjects]=useState(0),[loading,setLoading]=useState(true)
 useEffect(()=>{Promise.all([
  supabase.from('project_inquiries').select('*').order('created_at',{ascending:false}).limit(6),
  supabase.from('clients').select('*',{count:'exact',head:true}).in('status',['onboarding','active']),
  supabase.from('projects').select('*',{count:'exact',head:true}).in('status',['planning','active','launching'])
 ]).then(([i,c,p])=>{setInquiries((i.data||[]) as Inquiry[]);setClients(c.count||0);setProjects(p.count||0);setLoading(false)})},[])
 const first=profile?.full_name?' '+profile.full_name.split(' ')[0]:''
 return <><header className="topbar"><div><p className="eyebrow">Command center</p><h1>Good to see you{first}.</h1></div><span className="live-dot">Live workspace</span></header>
 <section className="metric-grid"><article><small>New inquiries</small><strong>{loading?'—':inquiries.filter(x=>x.status==='new').length}</strong><span>recent queue</span></article><article><small>Active clients</small><strong>{loading?'—':clients}</strong><span>onboarding + active</span></article><article><small>Active projects</small><strong>{loading?'—':projects}</strong><span>current workspaces</span></article><article><small>Needs attention</small><strong>{loading?'—':inquiries.filter(x=>['new','contract'].includes(x.status)).length}</strong><span>new + contract stage</span></article></section>
 <section className="panel"><div className="section-head"><div><p className="eyebrow">CRM</p><h2>Latest inquiries</h2></div><button className="ghost" onClick={()=>navigate('/leads')}>View pipeline →</button></div>{loading?<p className="muted">Loading inquiries…</p>:inquiries.length===0?<Empty>No inquiries yet.</Empty>:<div className="lead-list">{inquiries.map(x=><button className="lead-row" key={x.id} onClick={()=>navigate('/leads/'+x.id)}><Avatar name={x.name}/><div><b>{x.name}</b><small>{x.company||x.email}</small></div><span>{x.project_type}</span><StatusPill value={x.status}/></button>)}</div>}</section></>
}

function LeadsPage({navigate}:{navigate:(p:string)=>void}){
 const[leads,setLeads]=useState<Inquiry[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{supabase.from('project_inquiries').select('*').order('created_at',{ascending:false}).then(({data})=>{setLeads((data||[]) as Inquiry[]);setLoading(false)})},[])
 return <><PageTitle eyebrow="CRM" title="Leads" copy="Every project inquiry, from first hello to signed client."/><div className="pipeline">{leadStatuses.slice(0,5).map(status=><section className="pipeline-col" key={status}><div className="pipeline-head"><b>{label(status)}</b><span>{leads.filter(x=>x.status===status).length}</span></div>{leads.filter(x=>x.status===status).map(x=><button className="lead-card" key={x.id} onClick={()=>navigate('/leads/'+x.id)}><div><Avatar name={x.name}/><span><b>{x.name}</b><small>{x.company||x.project_type}</small></span></div><p>{x.details}</p><footer><small>{date(x.created_at)}</small><small>{x.budget_range}</small></footer></button>)}{!loading&&!leads.some(x=>x.status===status)&&<div className="pipeline-empty">Nothing here</div>}</section>)}</div>
 <section className="panel"><div className="section-head"><h2>Closed & archived</h2><span className="status">{leads.filter(x=>['won','lost','archived'].includes(x.status)).length}</span></div><div className="compact-list">{leads.filter(x=>['won','lost','archived'].includes(x.status)).map(x=><button key={x.id} onClick={()=>navigate('/leads/'+x.id)}><span>{x.name}</span><StatusPill value={x.status}/></button>)}</div></section></>
}

function LeadDetail({id,navigate}:{id:string;navigate:(p:string)=>void}){
 const[lead,setLead]=useState<Inquiry|null>(null),[notes,setNotes]=useState<Note[]>([]),[activity,setActivity]=useState<Activity[]>([]),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const load=async()=>{const[l,n,a]=await Promise.all([supabase.from('project_inquiries').select('*').eq('id',id).single(),supabase.from('lead_notes').select('id,body,created_at').eq('inquiry_id',id).order('created_at',{ascending:false}),supabase.from('crm_activity').select('*').eq('entity_type','lead').eq('entity_id',id).order('created_at',{ascending:false})]);setLead(l.data as Inquiry);setNotes((n.data||[]) as Note[]);setActivity((a.data||[]) as Activity[])}
 useEffect(()=>{load()},[id])
 async function changeStatus(status:string){if(!lead)return;setBusy(true);const{error}=await supabase.from('project_inquiries').update({status}).eq('id',id);setBusy(false);if(error)setMessage(error.message);else load()}
 async function addNote(e:FormEvent){e.preventDefault();if(!note.trim())return;setBusy(true);const{error}=await supabase.from('lead_notes').insert({inquiry_id:id,body:note.trim()});setBusy(false);if(error)setMessage(error.message);else{setNote('');load()}}
 async function convert(){if(!lead)return;setBusy(true);setMessage('');const{data,error}=await supabase.rpc('convert_lead_to_client',{p_inquiry_id:id});setBusy(false);if(error)setMessage(error.message);else navigate('/clients/'+data)}
 if(!lead)return <p className="muted">Loading lead…</p>
 return <><button className="back" onClick={()=>navigate('/leads')}>← Leads</button><header className="detail-head"><div className="identity"><Avatar name={lead.name}/><div><p className="eyebrow">Lead</p><h1>{lead.name}</h1><p>{lead.company||lead.email}</p></div></div><div className="detail-actions"><select value={lead.status} disabled={busy} onChange={e=>changeStatus(e.target.value)}>{leadStatuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select>{lead.status!=='won'&&<button className="primary inline" disabled={busy} onClick={convert}>Convert to client</button>}</div></header>
 {message&&<p className="form-message">{message}</p>}<div className="detail-grid"><section className="panel flush"><p className="eyebrow">Project brief</p><div className="facts"><Fact k="Email" v={lead.email}/><Fact k="Project type" v={lead.project_type}/><Fact k="Budget" v={lead.budget_range}/><Fact k="Timeline" v={lead.timeline}/><Fact k="Involvement" v={lead.involvement}/><Fact k="Received" v={date(lead.created_at)}/></div><div className="brief"><small>What they want to build</small><p>{lead.details}</p></div></section>
 <aside><section className="panel flush"><p className="eyebrow">Internal notes</p><form className="note-form" onSubmit={addNote}><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a private note…" maxLength={5000}/><button className="primary" disabled={busy||!note.trim()}>Add note</button></form>{notes.map(n=><div className="note" key={n.id}><p>{n.body}</p><small>{date(n.created_at)}</small></div>)}</section><ActivityFeed rows={activity}/></aside></div></>
}

function ClientsPage({navigate}:{navigate:(p:string)=>void}){
 const[clients,setClients]=useState<Client[]>([])
 useEffect(()=>{supabase.from('clients').select('*').order('created_at',{ascending:false}).then(({data})=>setClients((data||[]) as Client[]))},[])
 return <><PageTitle eyebrow="Relationships" title="Clients" copy="Accepted clients and the workspaces attached to them."/><section className="panel"><div className="client-list">{clients.map(c=><button className="client-row" key={c.id} onClick={()=>navigate('/clients/'+c.id)}><Avatar name={c.name}/><div><b>{c.name}</b><small>{c.primary_contact_name} · {c.primary_email}</small></div><StatusPill value={c.status}/><span>Open →</span></button>)}{clients.length===0&&<Empty>No clients yet. Convert a lead when you're ready.</Empty>}</div></section></>
}

function ClientDetail({id,navigate}:{id:string;navigate:(p:string)=>void}){
 const[client,setClient]=useState<Client|null>(null),[projects,setProjects]=useState<Project[]>([]),[docs,setDocs]=useState<DocumentRow[]>([]),[comms,setComms]=useState<Communication[]>([]),[activity,setActivity]=useState<Activity[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const load=async()=>{const[c,p,d,m,a]=await Promise.all([supabase.from('clients').select('*').eq('id',id).single(),supabase.from('projects').select('*').eq('client_id',id).order('created_at'),supabase.from('client_documents').select('*').eq('client_id',id).order('created_at',{ascending:false}),supabase.from('client_communications').select('*').eq('client_id',id).order('created_at',{ascending:false}),supabase.from('crm_activity').select('*').eq('entity_type','client').eq('entity_id',id).order('created_at',{ascending:false})]);setClient(c.data as Client);setProjects((p.data||[]) as Project[]);setDocs((d.data||[]) as DocumentRow[]);setComms((m.data||[]) as Communication[]);setActivity((a.data||[]) as Activity[])}
 useEffect(()=>{load()},[id])
 async function invite(){setBusy(true);setMessage('');const{data,error}=await supabase.functions.invoke('invite-client',{body:{client_id:id}});setBusy(false);setMessage(error?error.message:(data?.invitation_sent?'Portal invitation sent.':'Client account linked.'));if(!error)load()}
 if(!client)return <p className="muted">Loading client…</p>
 return <><button className="back" onClick={()=>navigate('/clients')}>← Clients</button><header className="detail-head"><div className="identity"><Avatar name={client.name}/><div><p className="eyebrow">Client record</p><h1>{client.name}</h1><p>{client.primary_contact_name} · {client.primary_email}</p></div></div><button className="primary inline" disabled={busy} onClick={invite}>{busy?'Working…':'Invite to portal'}</button></header>{message&&<p className="success-message">{message}</p>}
 <section className="record-grid"><RecordCard title="Projects" count={projects.length} detail={projects[0]?projects[0].name:'No projects'}/><RecordCard title="Documents" count={docs.length} detail={client.drive_folder_id?'Drive connected':'Drive vault not provisioned'}/><RecordCard title="Communications" count={comms.length} detail="Client history"/><RecordCard title="Agreements" count={docs.filter(x=>x.category==='agreement').length} detail="Contracts + approvals"/></section>
 <div className="detail-grid"><section><section className="panel flush"><div className="section-head"><div><p className="eyebrow">Projects</p><h2>Workspace</h2></div></div>{projects.map(p=><div className="project-row" key={p.id}><div><b>{p.name}</b><small>{label(p.phase)} · {p.project_type}</small></div><div className="progress"><i style={{width:p.progress+'%'}}/></div><StatusPill value={p.status}/></div>)}</section><section className="panel"><p className="eyebrow">Document vault</p>{docs.length?docs.map(d=><div className="doc-row" key={d.id}><span>{d.name}</span><small>{label(d.state)}</small></div>):<Empty>Google Drive-backed documents will appear here.</Empty>}</section></section><aside><ActivityFeed rows={activity}/></aside></div></>
}

function ProjectsPage(){const[rows,setRows]=useState<Project[]>([]);useEffect(()=>{supabase.from('projects').select('*').order('created_at',{ascending:false}).then(({data})=>setRows((data||[]) as Project[]))},[]);return <><PageTitle eyebrow="Delivery" title="Projects" copy="Every active build, its phase and current progress."/><section className="panel">{rows.map(p=><div className="project-row" key={p.id}><div><b>{p.name}</b><small>{p.project_type||'Custom project'} · {label(p.phase)}</small></div><div className="progress"><i style={{width:p.progress+'%'}}/></div><strong>{p.progress}%</strong><StatusPill value={p.status}/></div>)}{!rows.length&&<Empty>No projects yet.</Empty>}</section></>}
function DocumentsPage(){const[rows,setRows]=useState<DocumentRow[]>([]);useEffect(()=>{supabase.from('client_documents').select('*').order('created_at',{ascending:false}).then(({data})=>setRows((data||[]) as DocumentRow[]))},[]);return <><PageTitle eyebrow="Vault" title="Documents" copy="The app index for files stored in the SRCcvde Google Drive vault."/><section className="panel">{rows.map(d=><div className="doc-row" key={d.id}><div><b>{d.name}</b><small>{label(d.category)}</small></div><StatusPill value={d.state}/></div>)}{!rows.length&&<Empty>No documents indexed yet.</Empty>}</section></>}
function ActivityPage(){const[rows,setRows]=useState<Activity[]>([]);useEffect(()=>{supabase.from('crm_activity').select('*').order('created_at',{ascending:false}).limit(100).then(({data})=>setRows((data||[]) as Activity[]))},[]);return <><PageTitle eyebrow="Audit trail" title="Activity" copy="A timestamped history of meaningful CRM and client actions."/><ActivityFeed rows={rows}/></>}

function ActivityFeed({rows}:{rows:Activity[]}){return <section className="panel activity-panel"><p className="eyebrow">Activity</p>{rows.length?rows.map(a=><div className="activity-item" key={a.id}><i/><div><b>{a.summary}</b><small>{date(a.created_at)} · {label(a.action)}</small></div></div>):<Empty>No activity yet.</Empty>}</section>}
function PageTitle({eyebrow,title,copy}:{eyebrow:string;title:string;copy:string}){return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></header>}
function Fact({k,v}:{k:string;v:string}){return <div><small>{k}</small><b>{v}</b></div>}
function RecordCard({title,count,detail}:{title:string;count:number;detail:string}){return <article><small>{title}</small><strong>{count}</strong><span>{detail}</span></article>}

function ClientDashboard({profile,navigate}:{profile:Profile|null;navigate:(p:string)=>void}){
 const[client,setClient]=useState<Client|null>(null),[project,setProject]=useState<Project|null>(null),[docs,setDocs]=useState<DocumentRow[]>([])
 useEffect(()=>{(async()=>{const{data:members}=await supabase.from('client_memberships').select('client_id').limit(1);const clientId=members?.[0]?.client_id;if(!clientId)return;const[c,p,d]=await Promise.all([supabase.from('clients').select('*').eq('id',clientId).single(),supabase.from('projects').select('*').eq('client_id',clientId).order('created_at').limit(1),supabase.from('client_documents').select('*').eq('client_id',clientId).eq('client_visible',true).order('created_at',{ascending:false})]);setClient(c.data as Client);setProject((p.data?.[0]||null) as Project|null);setDocs((d.data||[]) as DocumentRow[])})()},[])
 const first=profile?.full_name?' '+profile.full_name.split(' ')[0]:''
 return <><header className="topbar"><div><p className="eyebrow">Client workspace</p><h1>Welcome{first}.</h1></div><span className="live-dot">Secure workspace</span></header>{project?<><section className="timeline-card"><div className="section-head"><div><p className="eyebrow">Current project</p><h2>{project.name}</h2></div><StatusPill value={project.status}/></div><div className="client-progress"><div><span>{label(project.phase)}</span><strong>{project.progress}%</strong></div><div className="progress"><i style={{width:project.progress+'%'}}/></div></div></section><section className="two-col"><article className="panel"><p className="eyebrow">Next step</p><h2>{project.progress===0?'Project kickoff':'Work in progress'}</h2><p className="muted">Your SRCcvde workspace will keep growing as milestones, approvals and deliverables are added.</p></article><article className="panel"><p className="eyebrow">Documents</p><h2>{docs.length} available</h2><p className="muted">Client-visible agreements, scope and deliverables live here.</p><button className="ghost" onClick={()=>navigate('/documents')}>Open documents →</button></article></section></>:<section className="timeline-card"><div className="section-head"><div><p className="eyebrow">Your journey</p><h2>{client?'Workspace ready':'Application received'}</h2></div><span className="status">In review</span></div><div className="timeline">{stages.slice(0,5).map((s,i)=><div className={i===0?'current':''} key={s}><i/><b>{s}</b><small>{i===0?'We have your brief':i===1?'Next step':'Upcoming'}</small></div>)}</div></section>}</>
}

function PendingAccess({email}:{email?:string}){return <main className="pending"><Brand/><p className="eyebrow">Workspace access</p><h1>You're signed in.</h1><p>{email} does not have an active SRCcvde workspace membership yet.</p><button className="primary" onClick={()=>supabase.auth.signOut()}>Sign out</button></main>}

function AdminRouter({route,profile,navigate}:{route:string;profile:Profile|null;navigate:(p:string)=>void}){
 const lead=route.match(/^\/leads\/([0-9a-f-]+)$/i),client=route.match(/^\/clients\/([0-9a-f-]+)$/i)
 if(lead)return <LeadDetail id={lead[1]} navigate={navigate}/>
 if(client)return <ClientDetail id={client[1]} navigate={navigate}/>
 if(route==='/leads')return <LeadsPage navigate={navigate}/>
 if(route==='/clients')return <ClientsPage navigate={navigate}/>
 if(route==='/projects')return <ProjectsPage/>
 if(route==='/documents')return <DocumentsPage/>
 if(route==='/activity')return <ActivityPage/>
 return <AdminOverview profile={profile} navigate={navigate}/>
}

export default function App(){
 const[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[membership,setMembership]=useState<Membership|null>(null),[profile,setProfile]=useState<Profile|null>(null),[route,setRoute]=useState(path())
 useEffect(()=>{const pop=()=>setRoute(path());addEventListener('popstate',pop);return()=>removeEventListener('popstate',pop)},[])
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(!s){setMembership(null);setProfile(null)}});return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(!session)return;Promise.all([supabase.from('app_memberships').select('role,status').eq('user_id',session.user.id).maybeSingle(),supabase.from('profiles').select('full_name,email').eq('id',session.user.id).maybeSingle()]).then(([m,p])=>{setMembership(m.data as Membership|null);setProfile(p.data as Profile|null)})},[session])
 const active=useMemo(()=>membership?.status==='active'?membership:null,[membership])
 const navigate=(p:string)=>{history.pushState({},'',p);setRoute(p)}
 if(loading)return <main className="loading"><Brand/><span>Opening workspace…</span></main>
 if(!session)return <Login/>
 if(!active)return <PendingAccess email={session.user.email}/>
 return <div className="app-shell"><Sidebar role={active.role} current={route} navigate={navigate} onSignOut={()=>supabase.auth.signOut()}/><main className="workspace">{active.role==='client'?<ClientDashboard profile={profile} navigate={navigate}/>:<AdminRouter route={route} profile={profile} navigate={navigate}/>}</main></div>
}
