import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://app.srccvde.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const headers={...cors,"Content-Type":"application/json"};
 try{
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const{data:{user},error:uerr}=await sb.auth.getUser(auth.slice(7)); if(uerr||!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
  const body=await req.json(); const documentId=String(body.document_id||""); const variant=body.variant==="original"?"original":"executed";
  const{data:mem}=await sb.from("client_memberships").select("client_id").eq("user_id",user.id).limit(1).maybeSingle();
  if(!mem?.client_id)return new Response(JSON.stringify({error:"Client membership required"}),{status:403,headers});
  const{data:doc}=await sb.from("client_documents").select("id").eq("id",documentId).eq("client_id",mem.client_id).eq("client_visible",true).maybeSingle();
  if(!doc)return new Response(JSON.stringify({error:"Not authorized"}),{status:403,headers});
  const{data:a}=await sb.from("executed_document_artifacts").select("storage_bucket,storage_path,original_storage_path").eq("document_id",documentId).maybeSingle();
  const path=variant==="original"?a?.original_storage_path:a?.storage_path;
  if(!a?.storage_bucket||!path)return new Response(JSON.stringify({error:"PDF not available yet"}),{status:404,headers});
  const{data:signed,error}=await sb.storage.from(a.storage_bucket).createSignedUrl(path,300);
  if(error||!signed?.signedUrl)throw error||new Error("Could not create document link");
  return new Response(JSON.stringify({url:signed.signedUrl}),{headers});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Request failed"}),{status:400,headers});}
});