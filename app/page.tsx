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
  members: number;
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
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
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
  const [statusMessage, setStatusMessage] = useState('Connect to your club workspace.');
  const [busy, setBusy] = useState(false);

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
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
      supabase.from('organizations').select('id, name, theme, signup_limit, active_day').order('created_at', { ascending: false })
    ]);
    if (profileResult.error) throw profileResult.error;
    if (orgResult.error) throw orgResult.error;
    const orgRows = orgResult.data ?? [];
    const orgIds = orgRows.map((org) => org.id);
    const membershipResult = orgIds.length
      ? await supabase.from('org_members').select('organization_id, user_id').in('organization_id', orgIds)
      : { data: [], error: null };
    if (membershipResult.error) throw membershipResult.error;
    const memberCounts = new Map<string, number>();
    (membershipResult.data ?? []).forEach((row) => memberCounts.set(row.organization_id, (memberCounts.get(row.organization_id) ?? 0) + 1));
    const nextOrganizations: Organization[] = orgRows.map((org) => ({
      ...org,
      members: memberCounts.get(org.id) ?? 0
    }));
    setOrganizations(nextOrganizations);
    if (!selectedOrgId && nextOrganizations.length) setSelectedOrgId(nextOrganizations[0].id);
    if (selectedOrgId && !nextOrganizations.some((org) => org.id === selectedOrgId)) {
      setSelectedOrgId(nextOrganizations[0]?.id ?? '');
    }
    const profileName = profileResult.data?.display_name ?? user.user_metadata?.display_name ?? '';
    setDisplayName(profileName);
    const orgId = selectedOrgId || nextOrganizations[0]?.id;
    if (!orgId) {
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
    for (const result of [postsResult, messagesResult, filesResult, signupResult, profilesResult]) {
      if (result.error) throw result.error;
    }
    setFeed(postsResult.data ?? []);
    setMessages(messagesResult.data ?? []);
    setDriveFiles(filesResult.data ?? []);
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
    loadWorkspace()
      .then(() => setStatusMessage('Connected to your live club workspace.'))
      .catch((error: Error) => setStatusMessage(error.message))
      .finally(() => setLoading(false));
  }, [user, loadWorkspace]);

  useEffect(() => {
    if (!user || !selectedOrgId) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`workspace-${selectedOrgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_members', filter: `organization_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files', filter: `org_id=eq.${selectedOrgId}` }, () => { void loadWorkspace(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, selectedOrgId, loadWorkspace]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    setAuthLoading(true);
    try {
      const supabase = getSupabase();
      if (isSignUp) {
        const normalized = username.trim().toLowerCase();
        if (normalized.length < 3 || blockedNameWords.some((word) => normalized.includes(word))) {
          throw new Error('Choose a display name with at least 3 characters that is appropriate for a club.');
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: username.trim() } }
        });
        if (error) throw error;
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({ id: data.user.id, display_name: username.trim() });
          if (profileError) throw profileError;
        }
        setStatusMessage(data.session
          ? 'Account created. If email confirmation is enabled, verify your guardian email to sign in.'
          : 'Check the guardian email inbox to confirm the account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to authenticate.');
    } finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    setStatusMessage(error?.message ?? 'You have signed out.');
  };

  const handleCreateOrg = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !newOrgName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await getSupabase().from('organizations')
        .insert({ name: newOrgName.trim(), theme: newOrgTheme, created_by: user.id })
        .select('id').single();
      if (error) throw error;
      setNewOrgName(''); setSelectedOrgId(data.id);
      setStatusMessage('Club created and saved to the shared workspace.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not create club.'); }
    finally { setBusy(false); }
  };

  const handleJoinOrg = async () => {
    if (!selectedOrg) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().rpc('join_organization', { target_organization: selectedOrg.id });
      if (error) throw error;
      await loadWorkspace();
      setStatusMessage('You joined the club.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not join this club.'); }
    finally { setBusy(false); }
  };

  const handleDailySignup = async () => {
    if (!selectedOrg) return;
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
    if (!user || !selectedOrg || !newPost.trim()) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().from('posts').insert({ org_id: selectedOrg.id, author_id: user.id, message: newPost.trim() });
      if (error) throw error;
      setNewPost(''); await loadWorkspace(); setStatusMessage('Update posted to the shared club feed.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not post update.'); }
    finally { setBusy(false); }
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !selectedOrg || !newMessage.trim()) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().from('messages').insert({ org_id: selectedOrg.id, author_id: user.id, message: newMessage.trim() });
      if (error) throw error;
      setNewMessage(''); await loadWorkspace(); setStatusMessage('Message sent to club chat.');
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Could not send message.'); }
    finally { setBusy(false); }
  };

  const handleDriveUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !user || !selectedOrg) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setStatusMessage('Upload an MP4, MOV, or WebM video.'); input.value = ''; return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatusMessage('Videos must be 50 MB or smaller.'); input.value = ''; return;
    }
    setBusy(true);
    const path = `${selectedOrg.id}/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
      const supabase = getSupabase();
      const { error: uploadError } = await supabase.storage.from('org-media').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from('media_files').insert({
        org_id: selectedOrg.id, owner_id: user.id, object_path: path,
        original_name: file.name, content_type: file.type, size_bytes: file.size
      });
      if (metadataError) {
        await supabase.storage.from('org-media').remove([path]);
        throw metadataError;
      }
      await loadWorkspace(); setStatusMessage(`Uploaded ${file.name} to the private club library.`);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(false); input.value = ''; }
  };

  const openVideo = async (path: string) => {
    const { data, error } = await getSupabase().storage.from('org-media').createSignedUrl(path, 60);
    if (error) setStatusMessage(error.message);
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (!configured) return (
    <main className="page-shell"><section className="panel setup-panel">
      <p className="eyebrow">LEGO FUN CLUB</p><h1>Connect your Supabase project</h1>
      <p>This app no longer uses sample or mock data. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> for local development and to Vercel Environment Variables for deployment, then run the database setup in <code>supabase/migrations/</code>.</p>
      <p>Only use Supabase’s public anon/publishable key here. Never put a service-role key in browser-visible environment variables.</p>
    </section></main>
  );
  if (loading) return <main className="page-shell"><section className="panel"><p>Connecting to the live workspace…</p></section></main>;

  if (!user) return (
    <main className="page-shell"><section className="hero panel"><div>
      <p className="eyebrow">LEGO FUN CLUB</p><h1>Build teams, plan projects, and share wins.</h1>
      <p className="hero-copy">A private club workspace for families, guardians, and their builders.</p>
      <p className="safety-note"><strong>Guardian-managed accounts:</strong> use a parent or guardian email address. Do not enter a child’s email or other sensitive personal information.</p>
    </div><div className="panel auth-panel"><h2>{isSignUp ? 'Create a guardian account' : 'Sign in'}</h2>
      <form className="stack-form" onSubmit={handleAuth}>
        {isSignUp && <input required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Builder display name" autoComplete="nickname" />}
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Guardian email" autoComplete="email" />
        <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" autoComplete={isSignUp ? 'new-password' : 'current-password'} />
        <button disabled={authLoading} type="submit">{authLoading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button>
      </form>
      <button className="text-button" type="button" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? 'Already have an account? Sign in' : 'New here? Create a guardian account'}</button>
      <p role="status">{statusMessage}</p>
    </div></section></main>
  );

  return (
    <main className="page-shell">
      <section className="hero panel"><div><p className="eyebrow">LEGO FUN CLUB</p><h1>Build teams, plan projects, and share wins.</h1>
        <p className="hero-copy">A shared workspace for clubs, build-day signups, updates, chat, and private video sharing.</p>
        <p className="safety-note">Guardian-managed account · Keep personal information private · Report concerns to your club’s adult organizer.</p>
      </div><div className="status-card"><div className="pill success">Supabase connected</div><strong>{statusMessage}</strong><span>Signed in as {displayName || user.email}</span><button className="secondary" type="button" onClick={handleSignOut}>Sign out</button></div></section>

      <section className="stats-grid"><div className="panel stat-card"><span>Clubs</span><strong>{organizations.length}</strong></div><div className="panel stat-card"><span>Members in selected club</span><strong>{selectedOrg?.members ?? 0}</strong></div><div className="panel stat-card"><span>Today’s signups</span><strong>{signedUpToday ? 'Signed up' : 'Not signed up'}</strong></div><div className="panel stat-card"><span>Shared videos</span><strong>{driveFiles.length}</strong></div></section>

      <section className="content-grid"><div className="panel"><h2>Your builder profile</h2><form className="stack-form" onSubmit={async (event) => {
        event.preventDefault(); const trimmed = username.trim();
        if (trimmed.length < 3 || blockedNameWords.some((word) => trimmed.toLowerCase().includes(word))) { setStatusMessage('Choose an appropriate display name of at least 3 characters.'); return; }
        setBusy(true); const { error } = await getSupabase().from('profiles').upsert({ id: user.id, display_name: trimmed });
        if (error) setStatusMessage(error.message); else { setDisplayName(trimmed); setStatusMessage('Profile saved.'); }
        setBusy(false);
      }}><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={displayName || 'Builder display name'} maxLength={32} /><button disabled={busy} type="submit">Save display name</button></form><p className="muted">Guardian account: {user.email}</p></div>
      <div className="panel"><h2>Create a club</h2><form onSubmit={handleCreateOrg} className="stack-form"><input required maxLength={80} value={newOrgName} onChange={(event) => setNewOrgName(event.target.value)} placeholder="Club name" /><select value={newOrgTheme} onChange={(event) => setNewOrgTheme(event.target.value)}><option>Space</option><option>City</option><option>Castle</option><option>Animals</option><option>Vehicles</option></select><button disabled={busy} type="submit">Create club</button></form></div></section>

      <section className="content-grid advanced-grid"><div className="panel wide-panel"><h2>Organizations</h2>{organizations.length === 0 ? <p>No clubs yet. Create one, or ask a club organizer to invite your account.</p> : <><div className="org-list">{organizations.map((org) => <button key={org.id} className={`org-card ${selectedOrgId === org.id ? 'selected' : ''}`} type="button" onClick={() => setSelectedOrgId(org.id)}><div><strong>{org.name}</strong><p>{org.theme} project team · {org.active_day}</p></div><span>{org.members}/{org.signup_limit}</span></button>)}</div><div className="join-row"><button disabled={busy || !selectedOrg} type="button" onClick={handleJoinOrg}>Join selected club</button><button disabled={busy || !selectedOrg || signedUpToday} type="button" className="secondary" onClick={handleDailySignup}>{signedUpToday ? 'Signed up today' : 'Signup for build day (max 15)'}</button></div></>}</div>
      <div className="panel"><h2>Team chat</h2>{!selectedOrg ? <p>Select a club to view chat.</p> : <><div className="chat-box">{messages.map((msg) => <div className="chat-item" key={msg.id}><strong>{profiles[msg.author_id] || 'Club member'}</strong><p>{msg.message}</p><small>{formatTime(msg.created_at)}</small></div>)}</div><form onSubmit={handleSendMessage} className="stack-form compact"><input required maxLength={2000} value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Message the team" /><button disabled={busy} type="submit">Send</button></form></>}</div></section>

      <section className="content-grid advanced-grid"><div className="panel wide-panel"><h2>Club updates</h2>{!selectedOrg ? <p>Select a club to view updates.</p> : <><form onSubmit={handleAddPost} className="stack-form compact"><input required maxLength={2000} value={newPost} onChange={(event) => setNewPost(event.target.value)} placeholder="Share a build update or event note" /><button disabled={busy} type="submit">Post update</button></form><div className="feed-stream">{feed.map((item) => <article key={item.id} className="feed-item"><div className="feed-header"><span className="feed-emoji">🧱</span><div><strong>{profiles[item.author_id] || 'Club member'}</strong><small>{formatTime(item.created_at)}</small></div></div><p>{item.message}</p></article>)}</div></>}</div>
      <div className="panel"><h2>Private video library</h2><p className="muted">MP4, MOV, or WebM · 50 MB maximum · visible only to club members.</p><label className="upload-box"><input type="file" onChange={handleDriveUpload} accept="video/mp4,video/quicktime,video/webm" disabled={!selectedOrg || busy} /><span>{busy ? 'Please wait…' : 'Upload a video'}</span></label><div className="drive-list">{driveFiles.map((file) => <button key={file.id} className="drive-item media-button" type="button" onClick={() => void openVideo(file.object_path)}><strong>{file.original_name}</strong><span>Video</span><small>{formatSize(file.size_bytes)} · {formatTime(file.created_at)} · Open secure link</small></button>)}</div></div></section>
      <p className="muted setup-footnote">This app provides technical access controls, not child-safety certification. An adult should moderate clubs and review applicable privacy, consent, and legal requirements before inviting children.</p>
    </main>
  );
}
