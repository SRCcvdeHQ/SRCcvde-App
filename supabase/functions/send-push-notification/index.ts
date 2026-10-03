import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"https://app.srccvde.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const categories=["project_updates","documents","approvals","messages","billing","security","marketing"];

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey=Deno.env.get("VAPID_PUBLIC_KEY"), privateKey=Deno.env.get("VAPID_PRIVATE_KEY");
  if(!publicKey||!privateKey) throw new Error("Web Push is not configured");
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await caller.auth.getUser();
  if(!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
  const {data:member}=await caller.from("app_memberships").select("role,status").eq("user_id",user.id).maybeSingle();
  if(!member||member.status!=="active") return new Response(JSON.stringify({error:"Forbidden"}),{status:403,headers:cors});
  const isStaff=["owner","admin","staff"].includes(member.role);
  if(!isStaff&&target!==user.id) return new Response(JSON.stringify({error:"Forbidden"}),{status:403,headers:cors});
  const body=await req.json(), target=body.user_id, category=String(body.category||"project_updates");
  if(!target||!body.title||!body.body||!categories.includes(category)) return new Response(JSON.stringify({error:"Invalid notification request"}),{status:400,headers:cors});
  const admin=createClient(url,service);
  const {data:pref}=await admin.from("notification_preferences").select(category).eq("user_id",target).maybeSingle();
  if(pref&&pref[category]===false) return new Response(JSON.stringify({sent:0,skipped:"preference_disabled"}),{headers:cors});
  const {data:subs,error}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id",target).eq("enabled",true);
  if(error) throw error;
  webpush.setVapidDetails("mailto:admin@srccvde.com",publicKey,privateKey);
  let sent=0,disabled=0;
  for(const sub of subs||[]){
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify({title:String(body.title).slice(0,120),body:String(body.body).slice(0,240),url:body.url||"/",tag:body.tag||category}));
    sent++;
   }catch(e){
    if(e?.statusCode===404||e?.statusCode===410){await admin.from("push_subscriptions").update({enabled:false,revoked_at:new Date().toISOString()}).eq("id",sub.id);disabled++}
    else { const code=Number(e?.statusCode||0); const message=e instanceof Error?e.message:String(e); console.error("push_delivery_failed",{code,message}); throw new Error(`Push provider rejected delivery${code?` (${code})`:""}: ${message}`); }
   }
  }
  return new Response(JSON.stringify({sent,disabled}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Push failed"}),{status:500,headers:cors})}
});