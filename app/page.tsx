'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/app/lib/supabase';

type Organization = {
  id: string;
  name: string;
  theme: string;
  signup_limit: number;
  active_day: string;
  invite_code: string;
  is_member: boolean;
};
type FeedItem = { id: string; org_id: string; author_id: string; message: string; created_at: string };
type ChatMessage = { id: string; org_id: string; author_id: string; message: string; created_at: string };
type DriveFile = { id: string; org_id: string; owner_id: string; object_path: string; original_name: string; content_type: string; size_bytes: number; created_at: string };
type Profile = { id: string; display_name: string };

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const blockedNameWords = ['subins', 'sub-ins', 'fake', 'bot', 'admin'];
const formatTime = (value: string) => new Date(value).toLocaleString();
const formatSize = (size: number) => `${Math.max(1, Math.round(size / 1024))} KB`;

export default function HomePage() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [signedUpToday, setSignedUpToday] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTheme, setNewOrgTheme] = useState('Space');
  const [inviteCode, setInviteCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('Connect to your club workspace.');
  const [busy, setBusy] = useState(false);

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setStatusMessage(error.message);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    const [profileResult, orgResult] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('id', user.id).maybeSingle(),
      supabase.from('organizations').select('id, name, theme, signup_limit, active_day, invite_code').order('created_at', { ascending: false })
    ]);
    if (profileResult.error) throw profileResult.error;
    if (orgResult.error) throw orgResult.error;
    const orgRows = orgResult.data ?? [];
    const orgIds = orgRows.map((org) => org.id);
    const memberResult = orgIds.length
      ? await supabase.from('org_members').select('organization_id').eq('user_id', user.id).in('organization_id', orgIds)
      : { data: [], error: null };
    if (memberResult.error) throw memberResult.error;
    const membershipIds = new Set((memberResult.data ?? []).map((row) => row.organization_id));
    const nextOrganizations: Organization[] = orgRows.map((org) => ({ ...org, is_member: membershipIds.has(org.id) }));
    setOrganizations(nextOrganizations);
    if (!selectedOrgId && nextOrganizations.length) setSelectedOrgId(nextOrganizations[0].id);
    if (selectedOrgId && !nextOrganizations.some((org) => org.id === selectedOrgId)) setSelectedOrgId(nextOrganizations[0]?.id ?? '');
    const profileName = profileResult.data?.display_name ?? user.user_metadata?.display_name ?? '';
    setDisplayName(profileName);
    const orgId = selectedOrgId || nextOrganizations[0]?.id;
    const selected = nextOrganizations.find((org) => org.id === orgId);
    if (!orgId || !selected?.is_member) {
      setFeed([]); setMessages([]); setDriveFiles([]); setSignedUpToday(false);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const [postsResult, messagesResult, filesResult, signupResult, profilesResult] = await Promise.all([
      supabase.from('posts').select('id, org_id, author_id, message, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
      supabase.from('messages').select('id, org_id, author_id, message, created_at').eq('org_id', orgId).order('created_at', { ascending: true }).limit(100),
      supabase.from('media_files').select('id, org_id, owner_id, object_path, original_name, content_type, size_bytes, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
      supabase.from('daily_signups').select('id').eq('organization_id', orgId).eq('user_id', user.id).eq('signup_date', today).maybeSingle(),
      supabase.from('profiles').select('id, display_name')
    ]);
    for (const result of [postsResult, messagesResult, filesResult, signupResult, profilesResult]) if (result.error) throw result.error;
    setFeed(postsResult.data ?? []); setMessages(messagesResult.data ?? []); setDriveFiles(filesResult.data ?? []);
    setSignedUpToday(Boolean(signupResult.data));
    const nameMap: Record<string, string> = {};
    (profilesResult.data ?? []).forEach((profile: Profile) => { nameMap[profile.id] = profile.display_name; });
    setProfiles(nameMap);
  }, [user, selectedOrgId]);

  useEffect(() => {
    if (!user) {
      setOrganizations([]); setFeed([]); setMessages([]); setDriveFiles([]); setDisplayName('');
      return;
    }
    setLoading(true);
    loadWorkspace().then(() => setStatusMessage('Connected to your live club workspace.'))
      .catch((error: Error) => setStatusMessage(error.message)).finally(() => setLoading(false));
  }, [user, loadWorkspace]);

  useEffect(() => {
    if (!user || !selectedOrgId || !selectedOrg?.is_member) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`workspace-${selectedOrgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_members', filter: `organization_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, selectedOrgId, selectedOrg, loadWorkspace]);

  const handleContinue = async () => {
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInAnonymously();
      if (error) throw error;
      setStatusMessage('Private guest session created. Choose a display name to get started.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not start a guest session.'); }
    finally { setBusy(false); }
  };

  const handleSignOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    setStatusMessage(error?.message ?? 'You have signed out.');
  };

  const handleSaveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = username.trim();
    if (name.length < 3 || name.length > 32 || blockedNameWords.some((word) => name.toLowerCase().includes(word))) {
      setStatusMessage('Choose an appropriate display name of 3–32 characters.'); return;
    }
    setBusy(true);
    try {
      const { error } = await getSupabase().from('profiles').upsert({ id: user.id, display_name: name });
      if (error) throw error;
      setDisplayName(name); setUsername(''); setStatusMessage('Display name saved.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not save your display name.'); }
    finally { setBusy(false); }
  };

  const handleCreateOrg = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !newOrgName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await getSupabase().from('organizations')
        .insert({ name: newOrgName.trim(), theme: newOrgTheme, created_by: user.id })
        .select('id, invite_code').single();
      if (error) throw error;
      setNewOrgName(''); setSelectedOrgId(data.id);
      await loadWorkspace();
      setStatusMessage(`Club created. Share invite code ${data.invite_code} with people you trust.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not create club.'); }
    finally { setBusy(false); }
  };

  const handleJoinOrg = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await getSupabase().rpc('join_organization_by_code', { code: inviteCode.trim().toUpperCase() });
      if (error) throw error;
      setInviteCode(''); setSelectedOrgId(data); await loadWorkspace();
      setStatusMessage('You joined the club. The feed and chat are now shared live.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not join this club. Check the invite code.'); }
    finally { setBusy(false); }
  };

  const handleDailySignup = async () => {
    if (!selectedOrg?.is_member) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().rpc('signup_for_day', { target_organization: selectedOrg.id });
      if (error) throw error;
      setSignedUpToday(true); setStatusMessage('Your signup has been saved.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not sign up today.'); }
    finally { setBusy(false); }
  };

  const handleAddPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !selectedOrg?.is_member || !newPost.trim()) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().from('posts').insert({ org_id: selectedOrg.id, author_id: user.id, message: newPost.trim() });
      if (error) throw error;
      setNewPost(''); await loadWorkspace(); setStatusMessage('Update posted to the shared live feed.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not post update.'); }
    finally { setBusy(false); }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !selectedOrg?.is_member || !newMessage.trim()) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().from('messages').insert({ org_id: selectedOrg.id, author_id: user.id, message: newMessage.trim() });
      if (error) throw error;
      setNewMessage(''); await loadWorkspace(); setStatusMessage('Message sent to the live club chat.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not send message.'); }
    finally { setBusy(false); }
  };

  const handleDriveUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !user || !selectedOrg?.is_member) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) { setStatusMessage('Upload an MP4, MOV, or WebM video.'); input.value = ''; return; }
    if (file.size > MAX_UPLOAD_BYTES) { setStatusMessage('Videos must be 50 MB or smaller.'); input.value = ''; return; }
    setBusy(true);
    const path = `${selectedOrg.id}/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
      const supabase = getSupabase();
      const { error: uploadError } = await supabase.storage.from('org-media').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from('media_files').insert({ org_id: selectedOrg.id, owner_id: user.id, object_path: path, original_name: file.name, content_type: file.type, size_bytes: file.size });
      if (metadataError) { await supabase.storage.from('org-media').remove([path]); throw metadataError; }
      await loadWorkspace(); setStatusMessage(`Uploaded ${file.name} to the private club library.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(false); input.value = ''; }
  };

  const openVideo = async (path: string) => {
    const { data, error } = await getSupabase().storage.from('org-media').createSignedUrl(path, 60);
    if (error) setStatusMessage(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (!configured) return <main className="page-shell"><section className="panel setup-panel"><p className="eyebrow">LEGO FUN CLUB</p><h1>Connect your Supabase project</h1><p>This app has no sample or mock data. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> and Vercel, then run both SQL migrations in <code>supabase/migrations/</code>.</p><p>Use only the public anon/publishable key. Never expose a service-role key.</p></section></main>;
  if (loading) return <main className="page-shell"><section className="panel"><p>Connecting to the live workspace…</p></section></main>;

  if (!user) return <main className="page-shell"><section className="hero panel"><div><p className="eyebrow">LEGO FUN CLUB</p><h1>Build teams, plan projects, and share wins.</h1><p className="hero-copy">Create a private guest profile with no email address, then share a club invite code with people you trust.</p><p className="safety-note"><strong>Guest accounts are anonymous.</strong> If you clear this browser or lose its session, you may not be able to recover the account. Use a display name only; do not share personal information.</p></div><div className="panel auth-panel"><h2>Continue without email</h2><p>{statusMessage}</p><button disabled={busy} type="button" onClick={handleContinue}>{busy ? 'Connecting…' : 'Continue as guest'}</button><p className="muted">Guest sign-in must be enabled in Supabase Authentication settings.</p></div></section></main>;

  return <main className="page-shell">
    <section className="hero panel"><div><p className="eyebrow">LEGO FUN CLUB</p><h1>Build teams, plan projects, and share wins.</h1><p className="hero-copy">A live shared workspace for clubs, build-day signups, updates, chat, and private video sharing.</p><p className="safety-note">Guest account · Use a display name only · Share invite codes only with people you trust.</p></div><div className="status-card"><div className="pill success">Supabase connected</div><strong>{statusMessage}</strong><span>{displayName || 'Choose a display name'} · Guest session</span><button className="secondary" type="button" onClick={handleSignOut}>Sign out</button></div></section>

    <section className="stats-grid"><div className="panel stat-card"><span>My clubs</span><strong>{organizations.filter((org) => org.is_member).length}</strong></div><div className="panel stat-card"><span>Posts in selected club</span><strong>{selectedOrg?.is_member ? feed.length : 0}</strong></div><div className="panel stat-card"><span>Today’s signup</span><strong>{signedUpToday ? 'Signed up' : 'Not signed up'}</strong></div><div className="panel stat-card"><span>Shared videos</span><strong>{driveFiles.length}</strong></div></section>

    <section className="content-grid"><div className="panel"><h2>Builder profile</h2><form className="stack-form" onSubmit={handleSaveName}><input required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder={displayName || 'Choose a display name'} /><button disabled={busy} type="submit">Save display name</button></form><p className="muted">No email is attached to this guest account.</p></div><div className="panel"><h2>Create a club</h2><form onSubmit={handleCreateOrg} className="stack-form"><input required maxLength={80} value={newOrgName} onChange={(event) => setNewOrgName(event.target.value)} placeholder="Club name" /><select value={newOrgTheme} onChange={(event) => setNewOrgTheme(event.target.value)}><option>Space</option><option>City</option><option>Castle</option><option>Animals</option><option>Vehicles</option></select><button disabled={busy} type="submit">Create club</button></form></div></section>

    <section className="content-grid advanced-grid"><div className="panel wide-panel"><h2>Join a club</h2><p>Ask a club member for its invite code.</p><form onSubmit={handleJoinOrg} className="stack-form compact"><input required maxLength={10} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Club invite code" /><button disabled={busy} type="submit">Join with code</button></form><h2 className="section-heading">My clubs</h2>{organizations.filter((org) => org.is_member).length === 0 ? <p>You haven’t joined a club yet. Create one or use an invite code.</p> : <div className="org-list">{organizations.filter((org) => org.is_member).map((org) => <button key={org.id} className={`org-card ${selectedOrgId === org.id ? 'selected' : ''}`} type="button" onClick={() => setSelectedOrgId(org.id)}><div><strong>{org.name}</strong><p>{org.theme} project team · {org.active_day}</p><small>Invite code: {org.invite_code}</small></div><span>Member</span></button>)}</div>}{selectedOrg?.is_member && <div className="join-row"><button disabled={busy} type="button" className="secondary" onClick={handleDailySignup}>{signedUpToday ? 'Signed up today' : 'Signup for build day (max 15)'}</button></div>}</div>
      <div className="panel"><h2>Team chat</h2>{!selectedOrg?.is_member ? <p>Join or create a club to use its live chat.</p> : <><div className="chat-box">{messages.map((msg) => <div className="chat-item" key={msg.id}><strong>{profiles[msg.author_id] || 'Club member'}</strong><p>{msg.message}</p><small>{formatTime(msg.created_at)}</small></div>)}</div><form onSubmit={handleSendMessage} className="stack-form compact"><input required maxLength={2000} value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Message the team" /><button disabled={busy} type="submit">Send</button></form></>}</div></section>

    <section className="content-grid advanced-grid"><div className="panel wide-panel"><h2>Live club stream</h2>{!selectedOrg?.is_member ? <p>Join or create a club to post and view updates.</p> : <><form onSubmit={handleAddPost} className="stack-form compact"><input required maxLength={2000} value={newPost} onChange={(event) => setNewPost(event.target.value)} placeholder="Share a build update or event note" /><button disabled={busy} type="submit">Post update</button></form><div className="feed-stream">{feed.map((item) => <article key={item.id} className="feed-item"><div className="feed-header"><span className="feed-emoji">🧱</span><div><strong>{profiles[item.author_id] || 'Club member'}</strong><small>{formatTime(item.created_at)}</small></div></div><p>{item.message}</p></article>)}</div></>}</div>
      <div className="panel"><h2>Private video library</h2><p className="muted">MP4, MOV, or WebM · 50 MB maximum · visible only to club members.</p><label className="upload-box"><input type="file" onChange={handleDriveUpload} accept="video/mp4,video/quicktime,video/webm" disabled={!selectedOrg?.is_member || busy} /><span>{busy ? 'Please wait…' : 'Upload a video'}</span></label><div className="drive-list">{driveFiles.map((file) => <button key={file.id} className="drive-item media-button" type="button" onClick={() => void openVideo(file.object_path)}><strong>{file.original_name}</strong><span>Video</span><small>{formatSize(file.size_bytes)} · {formatTime(file.created_at)} · Open secure link</small></button>)}</div></div></section>
    <p className="muted setup-footnote">This app’s technical controls are not child-safety certification. Have an adult moderate clubs and review privacy and consent requirements before inviting children.</p>
  </main>;
}
