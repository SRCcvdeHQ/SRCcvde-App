import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const allowed=new Set(["https://app.srccvde.com","http://localhost:5173","http://127.0.0.1:5173"]);
const respond=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","access-control-allow-origin":allowed.has(origin)?origin:"https://app.srccvde.com","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"}});
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??"";
 if(req.method==="OPTIONS")return respond({},200,origin);
 if(req.method!=="POST")return respond({error:"Method not allowed"},405,origin);
 if(origin&&!allowed.has(origin))return respond({error:"Origin not allowed"},403,origin);
 const auth=req.headers.get("authorization"); if(!auth?.startsWith("Bearer "))return respond({error:"Unauthorized"},401,origin);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:u,error:ue}=await admin.auth.getUser(auth.slice(7)); if(ue||!u.user)return respond({error:"Unauthorized"},401,origin);
 const {data:staff}=await admin.from("app_memberships").select("role,status").eq("user_id",u.user.id).maybeSingle();
 if(!staff||staff.status!=="active"||!["owner","admin","staff"].includes(staff.role))return respond({error:"Forbidden"},403,origin);
 let body:{inquiry_id?:string};try{body=await req.json()}catch{return respond({error:"Invalid request"},400,origin)}
 if(!body.inquiry_id)return respond({error:"inquiry_id is required"},400,origin);
 const {data:lead,error:le}=await admin.from("project_inquiries").select("id,name,email").eq("id",body.inquiry_id).single();
 if(le||!lead)return respond({error:"Lead not found"},404,origin);
 const {data:profile}=await admin.from("profiles").select("id").ilike("email",lead.email).maybeSingle();
 let userId=profile?.id as string|undefined;let invitationSent=false;let accessEmailSent=false;
 if(userId){
   const {error:re}=await admin.auth.resetPasswordForEmail(lead.email,{redirectTo:"https://app.srccvde.com/set-password"});
   if(re)return respond({error:re.message},400,origin);
   accessEmailSent=true;
 }
 if(!userId){
   const {data:invite,error:ie}=await admin.auth.admin.inviteUserByEmail(lead.email,{redirectTo:"https://app.srccvde.com/set-password",data:{full_name:lead.name,inquiry_id:lead.id}});
   if(ie)return respond({error:ie.message},400,origin);
   userId=invite.user?.id;invitationSent=true;accessEmailSent=true;
 }
 if(!userId)return respond({error:"Unable to provision user"},500,origin);
 const {error:me}=await admin.from("app_memberships").upsert({user_id:userId,role:"client",status:"active"},{onConflict:"user_id"});if(me)return respond({error:me.message},500,origin);
 const {error:ie2}=await admin.from("inquiry_memberships").upsert({inquiry_id:lead.id,user_id:userId},{onConflict:"inquiry_id,user_id"});if(ie2)return respond({error:ie2.message},500,origin);
 await admin.from("crm_activity").insert({entity_type:"lead",entity_id:lead.id,action:"portal_invited",summary:invitationSent?"Applicant portal invitation sent":"Existing account linked to applicant portal",actor_user_id:u.user.id,metadata:{email:lead.email}});
 return respond({ok:true,invitation_sent:invitationSent,access_email_sent:accessEmailSent},200,origin);
});