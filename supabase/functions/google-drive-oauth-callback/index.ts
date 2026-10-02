import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const APP="https://app.srccvde.com";
const CALLBACK="https://pszxarjungpoqvbwoblf.supabase.co/functions/v1/google-drive-oauth-callback";
const go=(q:string)=>Response.redirect(APP+"/documents?"+q,302);
Deno.serve(async req=>{
 const url=new URL(req.url),state=url.searchParams.get("state"),code=url.searchParams.get("code"),error=url.searchParams.get("error"),picked=(url.searchParams.get("picked_file_ids")||"").split(",").filter(Boolean)[0];
 if(error)return go("drive=error&reason="+encodeURIComponent(error));if(!state||!code)return go("drive=error&reason=missing_oauth_response");
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const {data:s}=await admin.from("oauth_connection_states").select("*").eq("state",state).eq("provider","google_drive").maybeSingle();
 if(!s||s.used_at||new Date(s.expires_at).getTime()<Date.now())return go("drive=error&reason=invalid_or_expired_state");
 await admin.from("oauth_connection_states").update({used_at:new Date().toISOString()}).eq("state",state);
 const {data:creds}=await admin.rpc("google_drive_oauth_credentials");const c=creds?.[0];if(!c?.client_id||!c?.client_secret)return go("drive=error&reason=oauth_credentials_missing");
 const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,code,grant_type:"authorization_code",redirect_uri:CALLBACK})});
 if(!tokenRes.ok){await admin.from("app_integrations").upsert({provider:"google_drive",status:"error",display_name:"Google Drive",last_error:"OAuth token exchange failed",updated_at:new Date().toISOString()});return go("drive=error&reason=token_exchange_failed")}
 const token=await tokenRes.json();if(!token.refresh_token)return go("drive=error&reason=refresh_token_missing");
 const {error:store}=await admin.rpc("store_google_drive_refresh_token",{p_refresh_token:token.refresh_token});if(store)return go("drive=error&reason=secure_token_storage_failed");
 let folderId=picked||"1j23qs5KZowr6BuVbbRnQdQvGN6mHhsG2",folderName="03 — Clients";
 if(token.access_token&&folderId){const fr=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(folderId)+"?fields=id,name,mimeType",{headers:{authorization:"Bearer "+token.access_token}});if(fr.ok){const f=await fr.json();folderName=f.name||folderName;if(f.mimeType!=="application/vnd.google-apps.folder")return go("drive=error&reason=please_select_a_folder")}}
 await admin.from("app_integrations").upsert({provider:"google_drive",status:"connected",display_name:"Google Drive",root_folder_id:folderId,root_folder_name:folderName,connected_at:new Date().toISOString(),connected_by:s.user_id,last_error:null,updated_at:new Date().toISOString()});
 return go("drive=connected");
});