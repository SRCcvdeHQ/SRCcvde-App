import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const allowedOrigins=new Set(["https://app.srccvde.com","http://localhost:5173","http://localhost:3000"]);
function cors(req:Request){const origin=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://app.srccvde.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Vary":"Origin"}}
Deno.serve(async(req:Request)=>{
 const headers=cors(req);
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...headers,"Content-Type":"application/json"}});
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await userClient.auth.getUser();if(!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...headers,"Content-Type":"application/json"}});
  const {deliverable_id}=await req.json();if(!deliverable_id)return new Response(JSON.stringify({error:"Missing deliverable_id"}),{status:400,headers:{...headers,"Content-Type":"application/json"}});
  const admin=createClient(url,service);
  const {data:item,error}=await admin.from("project_deliverables").select("id,client_id,storage_bucket,storage_path,client_visible").eq("id",deliverable_id).single();
  if(error||!item)return new Response(JSON.stringify({error:"File not found"}),{status:404,headers:{...headers,"Content-Type":"application/json"}});
  const {data:appMember}=await admin.from("app_memberships").select("role,status").eq("user_id",user.id).maybeSingle();
  let allowed=!!appMember&&appMember.status==="active"&&["owner","admin","staff"].includes(appMember.role);
  if(!allowed&&item.client_visible){const {data:membership}=await admin.from("client_memberships").select("client_id").eq("client_id",item.client_id).eq("user_id",user.id).maybeSingle();allowed=!!membership}
  if(!allowed)return new Response(JSON.stringify({error:"File not available"}),{status:403,headers:{...headers,"Content-Type":"application/json"}});
  const {data:signed,error:signError}=await admin.storage.from(item.storage_bucket).createSignedUrl(item.storage_path,300);
  if(signError||!signed?.signedUrl)throw new Error("Could not create download");
  return new Response(JSON.stringify({url:signed.signedUrl}),{headers:{...headers,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Request failed"}),{status:500,headers:{...headers,"Content-Type":"application/json"}})}
});