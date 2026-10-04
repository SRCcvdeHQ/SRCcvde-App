import "jsr:@supabase/functions-js/edge-runtime.d.ts";import{createClient}from"npm:@supabase/supabase-js@2";import{PDFDocument,StandardFonts,rgb}from"npm:pdf-lib@1.17.1";
const origins=new Set(["https://app.srccvde.com","http://localhost:5173","http://localhost:3000"]);const cors=(r:Request)=>({"Access-Control-Allow-Origin":origins.has(r.headers.get("origin")||"")?(r.headers.get("origin")||""):"https://app.srccvde.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100);const b64=(u:Uint8Array)=>{let s="";for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s)};async function hash(u:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",u))).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function receipt(inv:any,p:any){
 const d=await PDFDocument.create(),pg=d.addPage([612,792]),r=await d.embedFont(StandardFonts.Helvetica),b=await d.embedFont(StandardFonts.HelveticaBold);
 const dark=rgb(.06,.08,.07),green=rgb(.12,.45,.27),muted=rgb(.38,.4,.39),line=rgb(.86,.88,.87),soft=rgb(.95,.97,.96);
 const left=54,right=558,width=504;
 const safe=(v:any)=>String(v??"").replace(/[\r\n]+/g," ").trim();
 const clip=(text:string,font:any,size:number,max:number)=>{let s=safe(text);while(s.length>1&&font.widthOfTextAtSize(s,size)>max)s=s.slice(0,-1);return s!==safe(text)?s.slice(0,-3)+"...":s};
 const rightText=(text:string,y:number,size=10,font=b,color=dark)=>{const s=safe(text),w=font.widthOfTextAtSize(s,size);pg.drawText(s,{x:Math.max(left,right-w),y,size,font,color})};
 const labelValue=(label:string,value:string,y:number)=>{pg.drawText(label,{x:left,y,size:9,font:r,color:muted});rightText(value,y,10,b,dark)};
 pg.drawText("SRC",{x:left,y:738,size:23,font:b,color:dark});pg.drawText("cvde",{x:97,y:738,size:23,font:r,color:dark});pg.drawRectangle({x:left,y:729,width:28,height:3,color:green});
 rightText("PAYMENT RECEIPT",742,9,b,muted);
 pg.drawText("Payment received",{x:left,y:650,size:24,font:b,color:dark});
 pg.drawText(money(p.amount_cents),{x:left,y:606,size:32,font:b,color:green});
 pg.drawRectangle({x:left,y:525,width,height:58,color:soft});
 pg.drawText("INVOICE",{x:left+16,y:560,size:8,font:b,color:muted});
 pg.drawText(clip(inv.invoice_number,b,11,270),{x:left+16,y:541,size:11,font:b,color:dark});
 const client=clip(inv.clients?.name||"Client",r,10,180);rightText(client,541,10,r,dark);
 let y=492;
 const rows:any[]=[
  ["Payment method",""+(p.method_label||"Payment")+""],
  ["Received",new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric"}).format(new Date(p.paid_at))]
 ];
 if(p.reference)rows.push(["Reference",clip(p.reference,r,9,285)]);
 for(const [label,value] of rows){labelValue(label,safe(value),y);y-=24}
 pg.drawLine({start:{x:left,y:y-2},end:{x:right,y:y-2},thickness:1,color:line});y-=36;
 const rem=Math.max(0,inv.total_cents-inv.amount_paid_cents);
 labelValue("Invoice total",money(inv.total_cents),y);y-=26;
 labelValue("Total paid",money(inv.amount_paid_cents),y);y-=26;
 pg.drawText("Remaining",{x:left,y,size:10,font:b,color:dark});rightText(money(rem),y,11,b,rem===0?green:dark);y-=58;
 if(rem===0){pg.drawRectangle({x:left,y,width,height:44,color:soft});const paid="PAID IN FULL",pw=b.widthOfTextAtSize(paid,13);pg.drawText(paid,{x:left+(width-pw)/2,y:y+15,size:13,font:b,color:green})}
 pg.drawText("Thank you for building with SRCcvde.",{x:left,y:78,size:10,font:r,color:muted});
 pg.drawLine({start:{x:left,y:58},end:{x:right,y:58},thickness:.7,color:line});
 pg.drawText("SRCcvde  |  app.srccvde.com",{x:left,y:38,size:8,font:r,color:muted});
 return new Uint8Array(await d.save())
}
Deno.serve(async(req:Request)=>{const h=cors(req);if(req.method==="OPTIONS")return new Response("ok",{headers:h});const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...h,"Content-Type":"application/json"}});try{const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return json({error:"Unauthorized"},401);const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,resend=Deno.env.get("RESEND_API_KEY");const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});const{data:{user}}=await caller.auth.getUser();if(!user)return json({error:"Unauthorized"},401);const admin=createClient(url,service);const{data:m}=await admin.from("app_memberships").select("role,status").eq("user_id",user.id).maybeSingle();if(!m||m.status!=="active"||!["owner","admin","staff"].includes(m.role))return json({error:"Staff access required"},403);const body=await req.json();const cents=Math.round(Number(body.amount_cents));if(!body.invoice_id||!Number.isFinite(cents)||cents<=0)return json({error:"Invalid payment"},400);
const{data:pid,error:pe}=await caller.rpc("record_billing_payment",{p_invoice_id:body.invoice_id,p_amount_cents:cents,p_method_label:body.method_label||"Zelle for Business",p_paid_at:body.paid_at||new Date().toISOString(),p_reference:body.reference||null,p_note:body.note||null});if(pe)return json({error:pe.message},400);
const{data:p}=await admin.from("billing_payments").select("*").eq("id",pid).single();const{data:inv}=await admin.from("billing_invoices").select("*,clients(name,primary_contact_name,primary_email),projects(name)").eq("id",body.invoice_id).single();if(!p||!inv)return json({error:"Payment recorded but receipt data could not be loaded",payment_id:pid},500);
const bytes=await receipt(inv,p),path=inv.client_id+"/"+inv.id+"/"+p.id+".pdf",sha=await hash(bytes);const{error:up}=await admin.storage.from("billing-receipts").upload(path,bytes,{contentType:"application/pdf",upsert:false});if(!up)await admin.from("billing_payments").update({artifact_bucket:"billing-receipts",artifact_path:path,artifact_sha256:sha}).eq("id",p.id);
if(resend&&inv.clients?.primary_email){const remaining=Math.max(0,inv.total_cents-inv.amount_paid_cents),subject=remaining===0?`Payment received · ${inv.invoice_number} paid in full`:`Payment received · ${inv.invoice_number}`,txt=`SRCcvde payment receipt\n\nWe received ${money(p.amount_cents)} toward invoice ${inv.invoice_number}.\nTotal paid: ${money(inv.amount_paid_cents)}\nRemaining balance: ${money(remaining)}\n\nThank you for building with SRCcvde.`;const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json"},body:JSON.stringify({from:"SRCcvde <hello@srccvde.com>",to:[inv.clients.primary_email],reply_to:"hello@srccvde.com",subject,text:txt,html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>SRCcvde</h2><p>Payment received for <b>${inv.invoice_number}</b>.</p><h1>${money(p.amount_cents)}</h1><p>Total paid: <b>${money(inv.amount_paid_cents)}</b><br>Remaining: <b>${money(remaining)}</b></p>${remaining===0?"<h3>PAID IN FULL</h3>":""}<p>Your receipt is attached and available in your Billing workspace.</p></div>`,attachments:[{filename:"SRCcvde-receipt-"+inv.invoice_number+".pdf",content:b64(bytes)}]})});const out=await rr.json().catch(()=>({}));if(rr.ok)await admin.from("client_communications").insert({client_id:inv.client_id,project_id:inv.project_id,channel:"email",direction:"outbound",subject,body:txt,created_by:user.id,recipient_email:inv.clients.primary_email,delivery_status:"sent",provider:"resend",provider_message_id:out?.id||null,sent_at:new Date().toISOString(),client_visible:true})}
return json({recorded:true,payment_id:pid,remaining_cents:Math.max(0,inv.total_cents-inv.amount_paid_cents),paid_in_full:inv.amount_paid_cents>=inv.total_cents,receipt_archived:!up})}catch(e){return json({error:e instanceof Error?e.message:"Request failed"},500)}});