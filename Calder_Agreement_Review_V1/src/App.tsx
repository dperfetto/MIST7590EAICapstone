import { useEffect,useState,type ReactNode } from "react";
import Workspace from "./workspace/Workspace";
import { authLinkError, connected, openedFromRecoveryLink, supabase } from "./lib/supabaseClient";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Gavel } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

export default function App(){
  const[ready,setReady]=useState(!connected),[signedIn,setSignedIn]=useState(!connected),[recovering,setRecovering]=useState(openedFromRecoveryLink);
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSignedIn(Boolean(data.session));setReady(true)});const {data}=supabase.auth.onAuthStateChange((event,s)=>{setSignedIn(Boolean(s));if(event==="PASSWORD_RECOVERY")setRecovering(true)});return()=>data.subscription.unsubscribe()},[]);
  useEffect(()=>{const signOut=(event:MouseEvent)=>{const link=(event.target as HTMLElement).closest('a[href^="/signout-with-chatgpt"]');if(!link)return;event.preventDefault();if(supabase)supabase.auth.signOut();else{localStorage.removeItem("calder-demo-v1");location.reload()}};document.addEventListener("click",signOut);return()=>document.removeEventListener("click",signOut)},[]);
  if(!ready)return <div className="loading"><div className="loader"/><p>Preparing Calder workspace…</p></div>;
  // A reset link signs the user in for one purpose: choosing a new password.
  if(recovering&&signedIn)return <SetNewPassword onDone={()=>setRecovering(false)}/>;
  if(!signedIn){
    const notice=authLinkError?`That link didn't work: ${authLinkError}. You can request a new password reset link below.`:recovering?"That password reset link is invalid or has expired. You can request a new one below.":"";
    return <SignIn key={notice} notice={notice} startMode={notice?"reset":"signin"}/>;
  }
  return <Workspace/>;
}

function AuthFrame({children}:{children:ReactNode}){
  return <main className="auth-page">
    <section className="auth-shell">
      <aside className="auth-intro">
        <div className="auth-logo"><span><Gavel size={23}/></span><div><strong>Calder</strong><small>Agreement Review</small></div></div>
        <div className="auth-copy"><h1>Review vendor agreements.</h1><p>Calder finds key provisions and links each one to its source. Your team makes every decision.</p></div>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-mobile-logo"><span><Gavel size={20}/></span><strong>Calder</strong></div>
        {children}
        <p className="auth-privacy">Authorized users only</p>
      </section>
    </section>
  </main>;
}

type AuthMode="signin"|"create"|"reset";
const authCopy:Record<AuthMode,{title:string;lead:string;action:string}>={
  signin:{title:"Welcome back",lead:"Sign in to your workspace.",action:"Sign in"},
  create:{title:"Create your account",lead:"New accounts start with Submitter access. An Administrator can change your role.",action:"Create account"},
  reset:{title:"Reset your password",lead:"We'll email you a link to choose a new password.",action:"Send reset link"},
};

function SignIn({notice="",startMode="signin"}:{notice?:string;startMode?:AuthMode}){const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[mode,setMode]=useState<AuthMode>(startMode),[message,setMessage]=useState(notice),[busy,setBusy]=useState(false);
  const switchMode=(next:AuthMode)=>{setMode(next);setMessage("")};
  const submit=async()=>{setBusy(true);setMessage("");
    if(mode==="reset"){
      // The reset link returns to this app; its origin must be listed under
      // Supabase Authentication > URL Configuration > Redirect URLs.
      const {error}=await supabase!.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
      // The same reply whether or not the account exists, so the form cannot be used to discover accounts.
      setMessage(error?.message||`If an account exists for ${email}, we've emailed a link to reset your password. It can take a few minutes, so check your spam folder too.`);
    }else{
      const result=mode==="create"?await supabase!.auth.signUp({email,password,options:{data:{full_name:name}}}):await supabase!.auth.signInWithPassword({email,password});
      setMessage(result.error?.message||(mode==="create"?"Account created with Submitter access. An administrator must assign any additional permissions.":"Signed in."));
    }
    setBusy(false)};
  const copy=authCopy[mode];
  return <AuthFrame>
    <header><h2 id="auth-title">{copy.title}</h2><p>{copy.lead}</p></header>
    <form onSubmit={(event)=>{event.preventDefault();void submit()}}>
      {mode==="create"&&<div className="auth-field"><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name"/></div>}
      <div className="auth-field"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></div>
      {mode!=="reset"&&<div className="auth-field"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode==="create"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></div>}
      {mode==="signin"&&<button type="button" className="auth-link" onClick={()=>switchMode("reset")}>Forgot password?</button>}
      {message&&<div className="auth-message" role="status">{message}</div>}
      <Button className="auth-primary" type="submit" disabled={busy||!email||(mode!=="reset"&&!password)||(mode==="create"&&!name)}>{busy?"Please wait…":copy.action}</Button>
    </form>
    <div className="auth-divider"><span>{mode==="signin"?"New to Calder?":mode==="create"?"Already have an account?":"Remembered your password?"}</span></div>
    <Button className="auth-secondary" type="button" variant="outline" disabled={busy} onClick={()=>switchMode(mode==="signin"?"create":"signin")}>{mode==="signin"?"Create an account":"Back to sign in"}</Button>
  </AuthFrame>}

function SetNewPassword({onDone}:{onDone:()=>void}){const[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const tooShort=password.length>0&&password.length<MIN_PASSWORD_LENGTH,mismatch=confirm.length>0&&confirm!==password;
  const submit=async()=>{setBusy(true);setMessage("");const {error}=await supabase!.auth.updateUser({password});setBusy(false);if(error){setMessage(error.message);return}onDone()};
  return <AuthFrame>
    <header><h2 id="auth-title">Set a new password</h2><p>You'll go straight to your workspace afterwards.</p></header>
    <form onSubmit={(event)=>{event.preventDefault();void submit()}}>
      <div className="auth-field"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}/></div>
      <div className="auth-field"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Enter it again"/></div>
      {(tooShort||mismatch||message)&&<div className="auth-message" role="status">{message||(tooShort?`Use at least ${MIN_PASSWORD_LENGTH} characters.`:"The two passwords don't match.")}</div>}
      <Button className="auth-primary" type="submit" disabled={busy||password.length<MIN_PASSWORD_LENGTH||confirm!==password}>{busy?"Please wait…":"Save new password"}</Button>
    </form>
    <div className="auth-divider"><span>Didn't ask to reset it?</span></div>
    <Button className="auth-secondary" type="button" variant="outline" disabled={busy} onClick={()=>{setBusy(true);void supabase!.auth.signOut().then(onDone)}}>Cancel and sign out</Button>
  </AuthFrame>}
