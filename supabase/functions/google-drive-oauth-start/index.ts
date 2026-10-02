import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const APP="https://app.srccvde.com";
const CALLBACK="https://pszxarjungpoqvbwoblf.supabase.co/functions/v1/google-drive-oauth-callback";
const allowed=new Set([APP,"http://localhost:5173","http://127.0.0.1:5173"]);
const reply=(b:unknown,s=200,o="")=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","access-control-allow-origin":allowed.has(o)?o:APP,"access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"}});
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";if(req.method==="OPTIONS")return reply({},200,origin);if(req.method!=="POST")return reply({error:"Method not allowed"},405,origin);
 const auth=req.headers.get("authorization");if(!auth?.startsWith("Bearer "))return reply({error:"Unauthorized"},401,origin);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const {data:u}=await admin.auth.getUser(auth.slice(7));if(!u.user)return reply({error:"Unauthorized"},401,origin);
 const {data:m}=await admin.from("app_memberships").select("role,status").eq("user_id",u.user.id).maybeSingle();
 if(!m||m.status!=="active"||!["owner","admin"].includes(m.role))return reply({error:"Owner or admin access required"},403,origin);
 const {data:creds,error:ce}=await admin.rpc("google_drive_oauth_credentials");const c=creds?.[0];if(ce||!c?.client_id||!c?.client_secret)return reply({error:"Save the Google OAuth Client ID and Client Secret first."},409,origin);
 const state=crypto.randomUUID()+crypto.randomUUID();const expires=new Date(Date.now()+10*60*1000).toISOString();
 const {error:se}=await admin.from("oauth_connection_states").insert({state,provider:"google_drive",user_id:u.user.id,expires_at:expires});if(se)return reply({error:"Could not start secure connection."},500,origin);
 const p=new URLSearchParams({client_id:c.client_id,redirect_uri:CALLBACK,response_type:"code",scope:"https://www.googleapis.com/auth/drive.file",access_type:"offline",prompt:"consent",state,trigger_onepick:"true",allow_folder_selection:"true",file_ids:"1j23qs5KZowr6BuVbbRnQdQvGN6mHhsG2"});
 return reply({authorization_url:"https://accounts.google.com/o/oauth2/v2/auth?"+p.toString()},200,origin);
});