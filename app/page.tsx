'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/app/lib/supabase';

type Organization = { id: string; name: string; theme: string; signup_limit: number };
type Post = { id: string; body: string; created_at: string; author_id: string };
type ChatMessage = { id: string; body: string; created_at: string; author_id: string };
type Media = { id: string; name: string; object_path: string; size_bytes: number; content_type: string; created_at: string };
const themes = ['Space', 'City', 'Castle', 'Animals', 'Vehicles'];
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [signupCount, setSignupCount] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [orgTheme, setOrgTheme] = useState(themes[0]);
  const [postText, setPostText] = useState('');
  const [messageText, setMessageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Connect an account to get started.');

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId) ?? null;

  const loadOrganizations = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase.from('organizations').select('id,name,theme,signup_limit').order('created_at', { ascending: false });
    if (error) { setNotice(error.message); return; }
    const rows = (data ?? []) as Organization[];
    setOrganizations(rows);
    setSelectedOrgId((current) => rows.some((org) => org.id === current) ? current : (rows[0]?.id ?? ''));
  }, [supabase, user]);

  const loadOrganizationData = useCallback(async () => {
    if (!supabase || !selectedOrgId) {
      setPosts([]); setMessages([]); setMedia([]); setSignupCount(0);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const [postResult, messageResult, mediaResult, signupResult] = await Promise.all([
      supabase.from('posts').select('id,body,created_at,author_id').eq('org_id', selectedOrgId).order('created_at', { ascending: false }).limit(50),
      supabase.from('chat_messages').select('id,body,created_at,author_id').eq('org_id', selectedOrgId).order('created_at', { ascending: true }).limit(100),
      supabase.from('media_files').select('id,name,object_path,size_bytes,content_type,created_at').eq('org_id', selectedOrgId).order('created_at', { ascending: false }).limit(50),
      supabase.from('daily_signups').select('user_id', { count: 'exact', head: true }).eq('org_id', selectedOrgId).eq('signup_date', today)
    ]);
    const error = postResult.error ?? messageResult.error ?? mediaResult.error ?? signupResult.error;
    if (error) setNotice(error.message);
    setPosts((postResult.data ?? []) as Post[]);
    setMessages((messageResult.data ?? []) as ChatMessage[]);
    setMedia((mediaResult.data ?? []) as Media[]);
    setSignupCount(signupResult.count ?? 0);
  }, [supabase, selectedOrgId]);

  useEffect(() => {
    if (!supabase) { setInitializing(false); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setUser(data.session?.user ?? null); setInitializing(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => { void loadOrganizationData(); }, [loadOrganizationData]);

  useEffect(() => {
    if (!supabase || !selectedOrgId) return;
    const channel = supabase.channel(`org-${selectedOrgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadOrganizationData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadOrganizationData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadOrganizationData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, selectedOrgId, loadOrganizationData]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const result = isSignUp
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setNotice(result.error.message); return; }
    if (isSignUp && !result.data.session) setNotice('Check your email to confirm your caregiver account, then sign in.');
    else setNotice(isSignUp ? 'Account created.' : 'Signed in.');
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setNotice(error?.message ?? 'Signed out.');
    setOrganizations([]); setSelectedOrgId('');
  }

  async function handleCreateOrg(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !orgName.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('create_organization', { p_name: orgName.trim(), p_theme: orgTheme });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setOrgName('');
    setSelectedOrgId(data as string);
    setNotice('Organization created.');
    await loadOrganizations();
  }

  async function handleJoinOrg() {
    if (!supabase || !selectedOrgId) return;
    setBusy(true);
    const { error } = await supabase.rpc('join_organization', { p_org_id: selectedOrgId });
    setBusy(false);
    setNotice(error?.message ?? 'You joined this organization.');
    if (!error) await loadOrganizations();
  }

  async function handleSignup() {
    if (!supabase || !selectedOrgId) return;
    setBusy(true);
    const { error } = await supabase.rpc('signup_for_day', { p_org_id: selectedOrgId });
    setBusy(false);
    setNotice(error?.message ?? 'Daily signup recorded.');
    if (!error) await loadOrganizationData();
  }

  async function handlePost(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selectedOrgId || !postText.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('posts').insert({ org_id: selectedOrgId, body: postText.trim() });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setPostText(''); setNotice('Update posted.'); await loadOrganizationData();
  }

  async function handleMessage(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selectedOrgId || !messageText.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('chat_messages').insert({ org_id: selectedOrgId, body: messageText.trim() });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setMessageText(''); setNotice('Message sent.'); await loadOrganizationData();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!supabase || !selectedOrgId || !user || !file) return;
    if (!file.type.startsWith('video/') || file.size > MAX_VIDEO_BYTES) {
      setNotice('Choose a video smaller than 100 MB.'); return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${selectedOrgId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
    setBusy(true);
    const uploaded = await supabase.storage.from('shared-media').upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploaded.error) { setBusy(false); setNotice(uploaded.error.message); return; }
    const inserted = await supabase.from('media_files').insert({ org_id: selectedOrgId, name: file.name, object_path: objectPath, size_bytes: file.size, content_type: file.type });
    if (inserted.error) {
      await supabase.storage.from('shared-media').remove([objectPath]);
      setBusy(false); setNotice(inserted.error.message); return;
    }
    setBusy(false); setNotice('Video uploaded to this organization.'); await loadOrganizationData();
  }

  async function openMedia(item: Media) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from('shared-media').createSignedUrl(item.object_path, 60);
    if (error) { setNotice(error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  if (!supabase) return <main className="page-shell"><section className="panel"><h1>Backend setup required</h1><p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your local environment and Vercel project settings. Then run <code>supabase/schema.sql</code> in your Supabase SQL editor.</p></section></main>;
  if (initializing) return <main className="page-shell"><p role="status">Loading account…</p></main>;

  return <main className="page-shell">
    <section className="hero panel"><div><p className="eyebrow">LEGO FUN CLUB</p><h1>Build teams, plan projects, and share wins.</h1><p className="hero-copy">Private organization spaces with persistent posts, realtime chat, daily signups, and video storage.</p></div><div className="status-card"><div className={`pill ${user ? 'success' : 'info'}`}>{user ? 'Supabase connected' : 'Sign in required'}</div><strong role="status" aria-live="polite">{notice}</strong>{user && <button className="secondary" type="button" onClick={handleSignOut}>Sign out</button>}</div></section>
    {!user ? <section className="panel auth-panel"><h2>{isSignUp ? 'Create caregiver account' : 'Sign in'}</h2><p>Use a caregiver-managed account. Do not enter a child’s personal email or sensitive information.</p><form className="stack-form" onSubmit={handleAuth}>{isSignUp && <label>Display name<input required minLength={2} maxLength={40} autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>}<label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input required type="password" minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label><button disabled={busy} type="submit">{busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button></form><button className="link-button" type="button" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? 'Already have an account? Sign in' : 'Need a caregiver account? Sign up'}</button></section> : <>
      <section className="stats-grid"><div className="panel stat-card"><span>Organizations</span><strong>{organizations.length}</strong></div><div className="panel stat-card"><span>Today’s signups</span><strong>{signupCount}/{selectedOrg?.signup_limit ?? 15}</strong></div><div className="panel stat-card"><span>Posts</span><strong>{posts.length}</strong></div><div className="panel stat-card"><span>Videos</span><strong>{media.length}</strong></div></section>
      <section className="content-grid"><div className="panel"><h2>Create organization</h2><form onSubmit={handleCreateOrg} className="stack-form"><label>Organization name<input required minLength={2} maxLength={80} value={orgName} onChange={(e) => setOrgName(e.target.value)} /></label><label>Theme<select value={orgTheme} onChange={(e) => setOrgTheme(e.target.value)}>{themes.map((theme) => <option key={theme}>{theme}</option>)}</select></label><button disabled={busy} type="submit">Create organization</button></form></div><div className="panel"><h2>Organizations</h2>{organizations.length ? <><label>Select organization<select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.theme}</option>)}</select></label><div className="join-row"><button disabled={busy || !selectedOrg} type="button" onClick={handleJoinOrg}>Join selected org</button><button disabled={busy || !selectedOrg} className="secondary" type="button" onClick={handleSignup}>Signup for today</button></div></> : <p>No organizations yet. Create one to begin.</p>}</div></section>
      {selectedOrg && <section className="content-grid advanced-grid"><div className="panel"><h2>Team chat</h2><div className="chat-box" aria-live="polite">{messages.map((item) => <article className="chat-item" key={item.id}><strong>{item.author_id === user.id ? 'You' : 'Organization member'}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}{messages.length === 0 && <p>No messages yet.</p>}</div><form onSubmit={handleMessage} className="stack-form compact"><label>Message<input required maxLength={2000} value={messageText} onChange={(e) => setMessageText(e.target.value)} /></label><button disabled={busy} type="submit">Send</button></form></div>
      <div className="panel"><h2>Organization updates</h2><form onSubmit={handlePost} className="stack-form compact"><label>Share a build update<input required maxLength={2000} value={postText} onChange={(e) => setPostText(e.target.value)} /></label><button disabled={busy} type="submit">Post update</button></form><div className="feed-stream">{posts.map((item) => <article className="feed-item" key={item.id}><strong>{item.author_id === user.id ? 'You' : 'Organization member'}</strong><small>{new Date(item.created_at).toLocaleString()}</small><p>{item.body}</p></article>)}{posts.length === 0 && <p>No updates yet.</p>}</div></div>
      <div className="panel"><h2>Shared videos</h2><label className="upload-box">Upload a video (up to 100 MB)<input type="file" accept="video/*" onChange={handleUpload} disabled={busy} /></label><div className="drive-list">{media.map((item) => <button className="drive-item media-button" key={item.id} type="button" onClick={() => void openMedia(item)}><strong>{item.name}</strong><span>{(item.size_bytes / 1024 / 1024).toFixed(1)} MB</span><small>{new Date(item.created_at).toLocaleString()} · Open securely</small></button>)}{media.length === 0 && <p>No videos uploaded yet.</p>}</div></div></section>}
    </>}
  </main>;
}
