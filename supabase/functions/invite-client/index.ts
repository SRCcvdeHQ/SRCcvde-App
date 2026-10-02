import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowed = new Set(["https://app.srccvde.com","http://localhost:5173","http://127.0.0.1:5173"]);
const json = (body: unknown, status=200, origin="") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type":"application/json",
    "access-control-allow-origin": allowed.has(origin) ? origin : "https://app.srccvde.com",
    "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods":"POST, OPTIONS",
    "vary":"Origin"
  }
});

Deno.serve(async (req: Request) => {
  const origin=req.headers.get("origin") ?? "";
  if(req.method==="OPTIONS") return json({},200,origin);
  if(req.method!=="POST") return json({error:"Method not allowed"},405,origin);
  if(origin && !allowed.has(origin)) return json({error:"Origin not allowed"},403,origin);

  const auth=req.headers.get("authorization");
  if(!auth?.startsWith("Bearer ")) return json({error:"Unauthorized"},401,origin);

  const url=Deno.env.get("SUPABASE_URL")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const token=auth.slice(7);
  const {data:userData,error:userError}=await admin.auth.getUser(token);
  if(userError || !userData.user) return json({error:"Unauthorized"},401,origin);

  const {data:staff}=await admin.from("app_memberships").select("role,status").eq("user_id",userData.user.id).maybeSingle();
  if(!staff || staff.status!=="active" || !["owner","admin","staff"].includes(staff.role)) return json({error:"Forbidden"},403,origin);

  let body:{client_id?:string};
  try { body=await req.json(); } catch { return json({error:"Invalid request"},400,origin); }
  if(!body.client_id) return json({error:"client_id is required"},400,origin);

  const {data:client,error:clientError}=await admin.from("clients").select("id,primary_email,primary_contact_name").eq("id",body.client_id).single();
  if(clientError || !client) return json({error:"Client not found"},404,origin);

  const {data:existing}=await admin.from("profiles").select("id").ilike("email",client.primary_email).maybeSingle();
  let userId=existing?.id as string|undefined;
  let invitationSent=false;

  if(!userId){
    const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(client.primary_email,{
      redirectTo:"https://app.srccvde.com/",
      data:{full_name:client.primary_contact_name,client_id:client.id}
    });
    if(inviteError) return json({error:inviteError.message},400,origin);
    userId=invite.user?.id;
    invitationSent=true;
  }
  if(!userId) return json({error:"Unable to provision user"},500,origin);

  const {error:memberError}=await admin.from("app_memberships").upsert({user_id:userId,role:"client",status:"active"},{onConflict:"user_id"});
  if(memberError) return json({error:memberError.message},500,origin);
  const {error:clientMemberError}=await admin.from("client_memberships").upsert({client_id:client.id,user_id:userId,role:"client"},{onConflict:"client_id,user_id"});
  if(clientMemberError) return json({error:clientMemberError.message},500,origin);

  await admin.from("crm_activity").insert({
    entity_type:"client",entity_id:client.id,action:"portal_invited",
    summary: invitationSent ? "Client portal invitation sent" : "Existing account linked to client",
    actor_user_id:userData.user.id,metadata:{email:client.primary_email}
  });

  return json({ok:true,invitation_sent:invitationSent},200,origin);
});
