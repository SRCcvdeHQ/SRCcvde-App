import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import JSZip from "npm:jszip@3.10.1";

const allowed=new Set(["https://app.srccvde.com","http://localhost:5173","http://127.0.0.1:5173"]);
const cors=(origin:string)=>({"access-control-allow-origin":allowed.has(origin)?origin:"https://app.srccvde.com","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"});
const json=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),"content-type":"application/json"}});
const safe=(value:string)=>value.replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim().slice(0,100)||"Document";

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
  if(req.method!=="POST")return json({error:"Method not allowed"},405,origin);
  try{
    const auth=req.headers.get("authorization")||"";
    if(!auth.startsWith("Bearer "))return json({error:"Unauthorized"},401,origin);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const{data:{user},error:userError}=await admin.auth.getUser(auth.slice(7));
    if(userError||!user)return json({error:"Unauthorized"},401,origin);

    const body=await req.json();
    const clientId=String(body.client_id||"").trim();
    if(!clientId)return json({error:"client_id is required"},400,origin);

    const[{data:membership},{data:clientMembership}]=await Promise.all([
      admin.from("app_memberships").select("role,status").eq("user_id",user.id).maybeSingle(),
      admin.from("client_memberships").select("client_id").eq("user_id",user.id).eq("client_id",clientId).maybeSingle()
    ]);
    const staff=Boolean(membership&&membership.status==="active"&&["owner","admin","staff"].includes(membership.role));
    const activeClient=Boolean(clientMembership&&membership&&membership.status==="active"&&membership.role==="client");
    if(!staff&&!activeClient)return json({error:"Not authorized for this client"},403,origin);

    const[{data:client,error:clientError},{data:handoff}]=await Promise.all([
      admin.from("clients").select("id,name").eq("id",clientId).single(),
      admin.from("client_handoffs").select("id").eq("client_id",clientId).maybeSingle()
    ]);
    if(clientError||!client)return json({error:"Client not found"},404,origin);
    if(!handoff)return json({error:"Handoff has not been started yet"},409,origin);

    const{data:docs,error:docsError}=await admin.from("client_documents")
      .select("id,name,category,state,created_at")
      .eq("client_id",clientId)
      .eq("state","final")
      .order("created_at",{ascending:true});
    if(docsError)throw docsError;
    if(!docs?.length)return json({error:"No fully executed documents are available yet"},409,origin);

    const ids=docs.map((d:any)=>d.id);
    const{data:artifacts,error:artifactError}=await admin.from("executed_document_artifacts")
      .select("document_id,storage_bucket,storage_path,final_sha256,generated_at")
      .in("document_id",ids);
    if(artifactError)throw artifactError;
    const byDocument=new Map((artifacts||[]).map((a:any)=>[a.document_id,a]));
    const zip=new JSZip();
    const manifest:string[]=[
      "SRCcvde Client Handoff Contract Archive",
      "Client: "+client.name,
      "Generated: "+new Date().toISOString(),
      "",
      "This archive contains the fully executed PDFs available in the SRCcvde document vault at generation time.",
      ""
    ];
    let count=0;
    for(const doc of docs as any[]){
      const artifact:any=byDocument.get(doc.id);
      if(!artifact?.storage_bucket||!artifact?.storage_path)continue;
      const{data:file,error:fileError}=await admin.storage.from(artifact.storage_bucket).download(artifact.storage_path);
      if(fileError||!file)continue;
      count++;
      const filename=String(count).padStart(2,"0")+" - "+safe(doc.name)+".pdf";
      zip.file(filename,new Uint8Array(await file.arrayBuffer()));
      manifest.push(filename+" | "+doc.category+" | SHA-256 "+(artifact.final_sha256||"unavailable")+" | "+(artifact.generated_at||doc.created_at));
    }
    if(!count)return json({error:"Executed PDFs exist, but none could be read from secure storage"},409,origin);
    zip.file("ARCHIVE-MANIFEST.txt",manifest.join("\n"));
    const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
    if(bytes.byteLength>50*1024*1024)return json({error:"Contract archive is larger than the 50 MB handoff limit"},413,origin);

    const fileName=safe(client.name)+" - SRCcvde Handoff Contracts.zip";
    const storagePath=clientId+"/"+Date.now()+"-"+fileName.replace(/\s+/g,"-");
    const{error:uploadError}=await admin.storage.from("handoff-archives").upload(storagePath,bytes,{contentType:"application/zip",upsert:false});
    if(uploadError)throw uploadError;
    const{data:signed,error:signedError}=await admin.storage.from("handoff-archives").createSignedUrl(storagePath,3600,{download:fileName});
    if(signedError||!signed?.signedUrl)throw signedError||new Error("Could not create archive download link");

    await admin.from("client_handoffs").update({archive_generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("client_id",clientId);
    return json({url:signed.signedUrl,file_name:fileName,document_count:count,expires_in:3600},200,origin);
  }catch(e){
    return json({error:e instanceof Error?e.message:"Archive generation failed"},400,origin);
  }
});