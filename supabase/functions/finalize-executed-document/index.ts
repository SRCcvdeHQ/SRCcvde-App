import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";


const allowed=new Set(["https://app.srccvde.com","http://localhost:5173","http://127.0.0.1:5173"]);
const cors=(origin:string)=>({"access-control-allow-origin":allowed.has(origin)?origin:"https://app.srccvde.com","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"});
const json=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),"content-type":"application/json"}});

function safeName(s:string){return s.replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim().slice(0,120)||"Client"}
function pdfText(value:unknown){return String(value??"").replace(/[—–]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/•/g,"*").replace(/…/g,"...").replace(/[^\x09\x0A\x0D\x20-\x7E]/g,"")}
function wrap(text:string,font:any,size:number,max:number){text=pdfText(text);const out:string[]=[];for(const para of text.replace(/\r/g,"").split("\n")){if(!para){out.push("");continue}let line="";for(const word of para.split(/\s+/)){const test=line?line+" "+word:word;if(font.widthOfTextAtSize(test,size)<=max)line=test;else{if(line)out.push(line);line=word}}if(line)out.push(line)}return out}
function fmt(v:string|null|undefined){if(!v)return "—";return new Date(v).toLocaleString("en-US",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})}
async function sha256(bytes:Uint8Array){const d=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("")}

async function makeOriginalPdf(doc:any,version:any,client:any,project:any){
 const pdf=await PDFDocument.create();pdf.setTitle(doc.name+" - ORIGINAL");pdf.setAuthor("SRCcvde");pdf.setSubject("Immutable source document");pdf.setCreator("SRCcvde Client Operating System");
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,M=54,ink=rgb(.07,.09,.08),muted=rgb(.36,.41,.38),green=rgb(.09,.24,.18),tan=rgb(.56,.49,.37);
 let page=pdf.addPage([W,H]),y=H-78;
 const header=()=>{page.drawText("SRCcvde",{x:M,y:H-38,size:16,font:bold,color:green});page.drawText("Because you dreamt.",{x:W-M-100,y:H-36,size:8,font:regular,color:muted});page.drawLine({start:{x:M,y:H-48},end:{x:W-M,y:H-48},thickness:.7,color:rgb(.8,.8,.77)});y=H-78};
 const next=()=>{page=pdf.addPage([W,H]);header()};header();
 page.drawText(pdfText(doc.name),{x:M,y,size:23,font:bold,color:ink});y-=28;
 page.drawText("ORIGINAL - IMMUTABLE SOURCE",{x:M,y,size:8,font:bold,color:tan});y-=24;
 const meta=[["Client",client.name],["Project",project?.name||"-"],["Version",String(version.version_number)],["Source document SHA-256",version.content_sha256],["Document ID",doc.id],["Version ID",version.id]];
 for(const [k,v] of meta){page.drawText(pdfText(k).toUpperCase(),{x:M,y,size:7,font:bold,color:muted});y-=11;for(const line of wrap(String(v),regular,8.5,W-M*2)){page.drawText(line,{x:M,y,size:8.5,font:regular,color:ink});y-=11}y-=5}
 y-=4;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1,color:green});y-=24;
 for(const line of wrap(version.content_snapshot,regular,10,W-M*2)){if(y<72)next();page.drawText(line,{x:M,y,size:10,font:regular,color:ink});y-=15}
 const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:M,y:38},end:{x:W-M,y:38},thickness:.5,color:rgb(.82,.82,.79)});p.drawText("ORIGINAL | "+doc.id.slice(0,8)+" | Page "+(i+1)+" of "+pages.length,{x:M,y:23,size:7,font:regular,color:muted});});
 return new Uint8Array(await pdf.save());
}

async function makePdf(doc:any,version:any,client:any,project:any,requests:any[],events:any[]){
 const pdf=await PDFDocument.create();pdf.setTitle(doc.name+" - EXECUTED");pdf.setAuthor("SRCcvde");pdf.setSubject("Fully executed electronic document and signature certificate");pdf.setCreator("SRCcvde Client Operating System");
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,M=54,ink=rgb(.07,.09,.08),muted=rgb(.36,.41,.38),green=rgb(.09,.24,.18),tan=rgb(.56,.49,.37),paper=rgb(.965,.955,.925);
 let page=pdf.addPage([W,H]),y=H-78;
 const header=()=>{page.drawText("SRCcvde",{x:M,y:H-38,size:16,font:bold,color:green});page.drawText("Because you dreamt.",{x:W-M-100,y:H-36,size:8,font:regular,color:muted});page.drawLine({start:{x:M,y:H-48},end:{x:W-M,y:H-48},thickness:.7,color:rgb(.8,.8,.77)});y=H-78};
 const next=()=>{page=pdf.addPage([W,H]);header()};header();
 page.drawText(pdfText(doc.name),{x:M,y,size:23,font:bold,color:ink});y-=28;
 page.drawText("FULLY EXECUTED DOCUMENT",{x:M,y,size:8,font:bold,color:tan});y-=24;
 const meta=[["Client",client.name],["Project",project?.name||"-"],["Version",String(version.version_number)],["Source document SHA-256",version.content_sha256],["Document ID",doc.id],["Finalized",fmt(doc.fully_executed_at)]];
 for(const [k,v] of meta){page.drawText(pdfText(k).toUpperCase(),{x:M,y,size:7,font:bold,color:muted});y-=11;for(const line of wrap(String(v),regular,8.5,W-M*2)){page.drawText(line,{x:M,y,size:8.5,font:regular,color:ink});y-=11}y-=5}
 y-=4;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1,color:green});y-=24;
 for(const line of wrap(version.content_snapshot,regular,10,W-M*2)){if(y<72)next();page.drawText(line,{x:M,y,size:10,font:regular,color:ink});y-=15}

 next();page.drawText("Electronic Signature Certificate",{x:M,y,size:22,font:bold,color:ink});y-=24;
 page.drawText("Audit record for the exact immutable source document identified above.",{x:M,y,size:9.5,font:regular,color:muted});y-=28;
 for(const r of [...requests].sort((a,b)=>a.sequence-b.sequence)){
   if(y<190)next();
   const boxH=112;page.drawRectangle({x:M,y:y-boxH+12,width:W-M*2,height:boxH,color:paper,borderColor:rgb(.84,.82,.75),borderWidth:.7});
   page.drawText(pdfText((r.signer_side==="client"?"CLIENT":"SRCCVDE")+" - "+(r.signature_kind==="acknowledgment"?"ACKNOWLEDGED":"SIGNED")),{x:M+16,y:y-10,size:8,font:bold,color:tan});y-=30;
   const rows=[["Legal name",r.legal_name||r.signer_name],["Email",r.signer_email],["Signed",fmt(r.signed_at)],["Source SHA-256",r.signed_content_sha256||version.content_sha256]];
   for(const [k,v] of rows){page.drawText(pdfText(k),{x:M+16,y,size:8,font:bold,color:muted});for(const line of wrap(String(v),regular,8.5,W-M*2-132)){page.drawText(line,{x:M+122,y,size:8.5,font:regular,color:ink});y-=11}y-=3}
   y-=18;
 }
 if(y<210)next();page.drawText("Audit trail",{x:M,y,size:14,font:bold,color:ink});y-=18;
 page.drawLine({start:{x:M,y:y+6},end:{x:W-M,y:y+6},thickness:.6,color:rgb(.82,.82,.79)});
 for(const e of events){if(y<76)next();const line=fmt(e.created_at)+"  *  "+String(e.event_type).replaceAll("_"," ")+"  *  "+(e.legal_name||"authenticated account");for(const l of wrap(line,regular,8.25,W-M*2)){page.drawText(l,{x:M,y,size:8.25,font:regular,color:ink});y-=11}y-=2}
 y-=10;if(y<145)next();page.drawText("Integrity & verification",{x:M,y,size:11,font:bold,color:ink});y-=17;
 const integrity="The Source document SHA-256 identifies the exact immutable document version the parties reviewed and signed. SRCcvde separately computes and stores the SHA-256 of this final executed PDF in its artifact registry; that final-file hash is not embedded inside the PDF because changing the PDF to include its own hash would change the hash itself. Signature events and both document artifacts are retained as part of the audit record.";
 for(const l of wrap(integrity,regular,8.5,W-M*2)){page.drawText(l,{x:M,y,size:8.5,font:regular,color:muted});y-=12}
 const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:M,y:38},end:{x:W-M,y:38},thickness:.5,color:rgb(.82,.82,.79)});p.drawText("EXECUTED | "+doc.id.slice(0,8)+" | Page "+(i+1)+" of "+pages.length,{x:M,y:23,size:7,font:regular,color:muted});});
 return new Uint8Array(await pdf.save());
}

async function googleAccessToken(admin:any){
 const {data:creds,error}=await admin.rpc("google_drive_oauth_credentials");const c=creds?.[0];
 if(error||!c?.client_id||!c?.client_secret||!c?.refresh_token)return null;
 const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:"refresh_token"})});
 if(!res.ok)throw new Error("Google OAuth refresh failed: "+await res.text());
 return (await res.json()).access_token as string;
}
async function driveJson(token:string,url:string,init:RequestInit={}){const r=await fetch(url,{...init,headers:{authorization:"Bearer "+token,"content-type":"application/json",...(init.headers||{})}});if(!r.ok)throw new Error("Google Drive: "+await r.text());return r.json()}
async function ensureFolder(token:string,parent:string,name:string){
 const q=encodeURIComponent("'"+parent+"' in parents and name='"+name.replace(/'/g,"\\'")+"' and mimeType='application/vnd.google-apps.folder' and trashed=false");
 const found=await driveJson(token,"https://www.googleapis.com/drive/v3/files?q="+q+"&fields=files(id,name)&pageSize=1");
 if(found.files?.[0]?.id)return found.files[0].id as string;
 const made=await driveJson(token,"https://www.googleapis.com/drive/v3/files?fields=id,name",{method:"POST",body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parent]})});
 return made.id as string;
}
async function uploadDrivePdf(token:string,parent:string,name:string,bytes:Uint8Array){
 const boundary="srccvde_"+crypto.randomUUID().replaceAll("-","");
 const body=new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n",JSON.stringify({name,parents:[parent]}),"\r\n--"+boundary+"\r\nContent-Type: application/pdf\r\n\r\n",bytes,"\r\n--"+boundary+"--"]);
 const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"multipart/related; boundary="+boundary},body});
 if(!r.ok)throw new Error("Google Drive upload: "+await r.text());return r.json();
}
async function syncDrive(admin:any,artifact:any,client:any,doc:any,executedBytes:Uint8Array,originalBytes?:Uint8Array){
 const token=await googleAccessToken(admin);if(!token)return {status:"not_configured"};
 const {data:integration}=await admin.from("app_integrations").select("root_folder_id,status").eq("provider","google_drive").maybeSingle();
 if(!integration?.root_folder_id||integration.status!=="connected")return {status:"not_configured"};
 const ROOT_DRIVE_FOLDER=integration.root_folder_id;
 try{
  const clientFolder=client.drive_folder_id||await ensureFolder(token,ROOT_DRIVE_FOLDER,safeName(client.name));
  const folders=["01 — Agreements","02 — Scope & Proposals","03 — Project Files","04 — Client Uploads","05 — Change Requests","06 — Invoices","07 — Handoff"];
  const ids:Record<string,string>={};for(const f of folders)ids[f]=await ensureFolder(token,clientFolder,f);
  const category=String(doc.category||"").toLowerCase();const target=category==="agreement"?ids["01 — Agreements"]:category==="proposal"||category==="scope"?ids["02 — Scope & Proposals"]:ids["03 — Project Files"];
  let originalFileId=artifact.drive_original_file_id||null;
  if(originalBytes&&!originalFileId){const original=await uploadDrivePdf(token,target,safeName(doc.name)+" - ORIGINAL.pdf",originalBytes);originalFileId=original.id}
  let executedFileId=artifact.drive_file_id||null;
  if(!executedFileId){const executed=await uploadDrivePdf(token,target,safeName(doc.name)+" - EXECUTED.pdf",executedBytes);executedFileId=executed.id}
  await admin.from("clients").update({drive_folder_id:clientFolder}).eq("id",client.id);
  await admin.from("executed_document_artifacts").update({drive_sync_status:"synced",drive_file_id:executedFileId,drive_original_file_id:originalFileId,drive_folder_id:target,drive_synced_at:new Date().toISOString(),drive_error:null}).eq("id",artifact.id);
  await admin.from("client_documents").update({drive_file_id:executedFileId}).eq("id",doc.id);
  return {status:"synced",file_id:executedFileId,original_file_id:originalFileId};
 }catch(e){const msg=e instanceof Error?e.message:String(e);await admin.from("executed_document_artifacts").update({drive_sync_status:"failed",drive_error:msg.slice(0,2000)}).eq("id",artifact.id);return {status:"failed",error:msg}}
}

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??"";if(req.method==="OPTIONS")return json({},200,origin);if(req.method!=="POST")return json({error:"Method not allowed"},405,origin);if(origin&&!allowed.has(origin))return json({error:"Origin not allowed"},403,origin);
 const auth=req.headers.get("authorization");if(!auth?.startsWith("Bearer "))return json({error:"Unauthorized"},401,origin);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:u}=await admin.auth.getUser(auth.slice(7));if(!u.user)return json({error:"Unauthorized"},401,origin);
 let body:{document_id?:string};try{body=await req.json()}catch{return json({error:"Invalid request"},400,origin)}if(!body.document_id)return json({error:"document_id is required"},400,origin);
 const {data:doc,error:de}=await admin.from("client_documents").select("*").eq("id",body.document_id).single();if(de||!doc)return json({error:"Document not found"},404,origin);
 const {data:staff}=await admin.from("app_memberships").select("role,status").eq("user_id",u.user.id).maybeSingle();
 const isStaff=!!staff&&staff.status==="active"&&["owner","admin","staff"].includes(staff.role);
 const {data:member}=await admin.from("client_memberships").select("client_id").eq("client_id",doc.client_id).eq("user_id",u.user.id).maybeSingle();
 if(!isStaff&&!member)return json({error:"Forbidden"},403,origin);
 if(doc.state!=="final")return json({error:"Document is not fully executed"},409,origin);

 const {data:existing}=await admin.from("executed_document_artifacts").select("*").eq("document_id",doc.id).maybeSingle();
 if(existing){
  const [{data:versionForExisting},{data:clientForExisting},{data:projectForExisting}]=await Promise.all([
   admin.from("document_versions").select("*").eq("id",existing.document_version_id).single(),
   admin.from("clients").select("*").eq("id",doc.client_id).single(),
   doc.project_id?admin.from("projects").select("*").eq("id",doc.project_id).single():Promise.resolve({data:null})
  ]);
  let originalPath=existing.original_storage_path as string|null,originalHash=existing.original_sha256 as string|null,originalBytes:Uint8Array|undefined;
  if(versionForExisting&&clientForExisting&&!originalPath){
   originalBytes=await makeOriginalPdf(doc,versionForExisting,clientForExisting,projectForExisting);
   originalHash=await sha256(originalBytes);originalPath=clientForExisting.id+"/"+doc.id+"/"+pdfText(safeName(doc.name))+"-ORIGINAL.pdf";
   const {error:originalUpload}=await admin.storage.from("executed-documents").upload(originalPath,originalBytes,{contentType:"application/pdf",upsert:false});
   if(originalUpload&&originalUpload.message!=="The resource already exists")return json({error:"Could not archive ORIGINAL PDF",detail:originalUpload.message},500,origin);
   await admin.from("executed_document_artifacts").update({original_storage_path:originalPath,original_sha256:originalHash}).eq("id",existing.id);
  }else if(originalPath){
   const {data:storedOriginal}=await admin.storage.from(existing.storage_bucket).download(originalPath);if(storedOriginal)originalBytes=new Uint8Array(await storedOriginal.arrayBuffer());
  }
  const {data:storedExecuted}=await admin.storage.from(existing.storage_bucket).download(existing.storage_path);
  if(!storedExecuted)return json({error:"Executed PDF is missing from secure storage"},500,origin);
  const executedBytes=new Uint8Array(await storedExecuted.arrayBuffer());
  let drive:any=null;
  if(clientForExisting&&(!existing.drive_file_id||!existing.drive_original_file_id||existing.drive_sync_status!=="synced")){
   drive=await syncDrive(admin,{...existing,original_storage_path:originalPath,original_sha256:originalHash},clientForExisting,doc,executedBytes,originalBytes);
   if(drive.status==="not_configured")await admin.from("executed_document_artifacts").update({drive_sync_status:"not_configured"}).eq("id",existing.id);
  }
  const {data:fresh}=await admin.from("executed_document_artifacts").select("*").eq("id",existing.id).single();
  const {data:url}=await admin.storage.from(existing.storage_bucket).createSignedUrl(existing.storage_path,300,{download:safeName(doc.name)+" - EXECUTED.pdf"});
  return json({ok:true,artifact:fresh||existing,drive,download_url:url?.signedUrl},200,origin)
 }

 const [{data:version},{data:client},{data:project},{data:requests}]=await Promise.all([
  admin.from("document_versions").select("*").eq("document_id",doc.id).order("version_number",{ascending:false}).limit(1).single(),
  admin.from("clients").select("*").eq("id",doc.client_id).single(),
  doc.project_id?admin.from("projects").select("*").eq("id",doc.project_id).single():Promise.resolve({data:null}),
  admin.from("signature_requests").select("*").eq("document_id",doc.id).eq("status","signed").order("sequence")
 ]);
 if(!version||!client||!requests?.length)return json({error:"Execution record is incomplete"},409,origin);
 const requestIds=requests.map((r:any)=>r.id);const {data:events}=await admin.from("signature_events").select("*").in("signature_request_id",requestIds).order("created_at");
 let bytes:Uint8Array,originalBytes:Uint8Array;try{[bytes,originalBytes]=await Promise.all([makePdf(doc,version,client,project,requests,events||[]),makeOriginalPdf(doc,version,client,project)])}catch(e){const detail=e instanceof Error?e.message:String(e);console.error("pdf-generation-failed",detail);return json({error:"PDF generation failed",detail},500,origin)}
 const [finalHash,originalHash]=await Promise.all([sha256(bytes),sha256(originalBytes)]);
 const path=client.id+"/"+doc.id+"/"+pdfText(safeName(doc.name))+"-EXECUTED.pdf";
 const originalPath=client.id+"/"+doc.id+"/"+pdfText(safeName(doc.name))+"-ORIGINAL.pdf";
 const {error:originalUp}=await admin.storage.from("executed-documents").upload(originalPath,originalBytes,{contentType:"application/pdf",upsert:false});if(originalUp){console.error("storage-original-upload-failed",originalUp.message);return json({error:"Could not archive ORIGINAL PDF",detail:originalUp.message},500,origin)}
 const {error:up}=await admin.storage.from("executed-documents").upload(path,bytes,{contentType:"application/pdf",upsert:false});if(up){await admin.storage.from("executed-documents").remove([originalPath]);console.error("storage-upload-failed",up.message);return json({error:"Could not archive EXECUTED PDF",detail:up.message},500,origin)}
 const {data:artifact,error:ae}=await admin.from("executed_document_artifacts").insert({document_id:doc.id,document_version_id:version.id,client_id:client.id,project_id:doc.project_id,storage_path:path,final_sha256:finalHash,byte_size:bytes.length,original_storage_path:originalPath,original_sha256:originalHash,generated_by:u.user.id,drive_sync_status:"pending",metadata:{source_sha256:version.content_sha256}}).select("*").single();
 if(ae||!artifact){await admin.storage.from("executed-documents").remove([path,originalPath]);return json({error:"Could not record executed artifact"},500,origin)}
 await admin.from("client_documents").update({executed_artifact_id:artifact.id}).eq("id",doc.id);
 const drive=await syncDrive(admin,artifact,client,doc,bytes,originalBytes);
 if(drive.status==="not_configured")await admin.from("executed_document_artifacts").update({drive_sync_status:"not_configured"}).eq("id",artifact.id);
 const {data:url}=await admin.storage.from("executed-documents").createSignedUrl(path,300,{download:safeName(doc.name)+" - EXECUTED.pdf"});
 return json({ok:true,artifact:{...artifact,drive_sync_status:drive.status},drive,download_url:url?.signedUrl},200,origin);
});