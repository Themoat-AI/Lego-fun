'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { getSupabaseStatus } from '@/app/lib/supabase';
import { getFirebaseStatus } from '@/app/lib/firebase';
import {
  initialFeed,
  initialOrganizations,
  initialDriveFiles,
  initialMessages,
  initialUser,
  type DriveFile,
  type FeedItem,
  type Message,
  type Organization
} from '@/app/lib/mock-data';

const blockedNameWords = ['subins', 'sub-ins', 'fake', 'bot', 'admin'];

export default function HomePage() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(initialUser.displayName);
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [feed, setFeed] = useState<FeedItem[]>(initialFeed);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>(initialDriveFiles);
  const [selectedOrgId, setSelectedOrgId] = useState(initialOrganizations[0].id);
  const [newPost, setNewPost] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgTheme, setNewOrgTheme] = useState('Space');
  const [signupCount, setSignupCount] = useState(12);
  const [statusMessage, setStatusMessage] = useState('Ready for team signups.');

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) ?? organizations[0],
    [selectedOrgId, organizations]
  );

  const supabaseStatus = getSupabaseStatus();
  const firebaseStatus = getFirebaseStatus();

  const handleUsernameSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();

    if (!normalized) {
      setStatusMessage('Choose a username before continuing.');
      return;
    }

    const hasBlocked = blockedNameWords.some((word) => normalized.includes(word));
    if (hasBlocked || normalized.length < 3) {
      setStatusMessage('That name is not allowed. Please use a real, kid-safe username.');
      return;
    }

    setDisplayName(username.trim());
    setStatusMessage(`Welcome aboard, ${username.trim()}! Your profile is ready.`);
    setUsername('');
  };

  const handleCreateOrg = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) {
      setStatusMessage('Give your organization a name first.');
      return;
    }

    const createdOrg: Organization = {
      id: `org-${Date.now()}`,
      name: trimmed,
      theme: newOrgTheme,
      members: 1,
      projects: ['Launch meeting notes', 'Brick list'],
      signupLimit: 15,
      activeDay: 'Saturday'
    };

    setOrganizations((current) => [createdOrg, ...current]);
    setSelectedOrgId(createdOrg.id);
    setNewOrgName('');
    setNewOrgTheme('Space');
    setStatusMessage(`${trimmed} is live! Invite friends to join.`);
  };

  const handleJoinOrg = (orgId: string) => {
    setOrganizations((current) =>
      current.map((org) => {
        if (org.id !== orgId) return org;
        if (org.members >= org.signupLimit) {
          setStatusMessage(`This team is full for today. Max ${org.signupLimit} signups.`);
          return org;
        }
        return { ...org, members: org.members + 1 };
      })
    );
    setStatusMessage('You joined the organization successfully.');
  };

  const handleAddPost = (event: FormEvent) => {
    event.preventDefault();
    if (!newPost.trim()) return;

    const nextPost: FeedItem = {
      id: `post-${Date.now()}`,
      author: displayName || 'Builder Kid',
      orgId: selectedOrg.id,
      message: newPost.trim(),
      time: 'Just now',
      emoji: '🚀'
    };

    setFeed((current) => [nextPost, ...current]);
    setNewPost('');
    setStatusMessage('Your classroom-style update is now live.');
  };

  const handleSendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    const nextMessage: Message = {
      id: `msg-${Date.now()}`,
      author: displayName || 'Builder Kid',
      text: newMessage.trim(),
      time: 'Now'
    };

    setMessages((current) => [...current, nextMessage]);
    setNewMessage('');
    setStatusMessage('Message sent to the team chat.');
  };

  const handleDailySignup = () => {
    if (signupCount >= 15) {
      setStatusMessage('Daily signup is full. No more than 15 people can sign up per day.');
      return;
    }

    setSignupCount((count) => count + 1);
    setStatusMessage('Your day signup was added successfully.');
  };

  const handleDriveUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextFile: DriveFile = {
      id: `drive-${Date.now()}`,
      name: file.name,
      type: file.type.startsWith('video/') ? 'Movie' : 'File',
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      uploadedAt: 'Just now'
    };

    setDriveFiles((current) => [nextFile, ...current]);
    setStatusMessage(`Uploaded ${file.name} to the shared drive folder.`);
  };

  return (
    <main className="page-shell">
      <section className="hero panel">
        <div>
          <p className="eyebrow">LEGO FUN CLUB</p>
          <h1>Build teams, plan projects, and share wins.</h1>
          <p className="hero-copy">
            Kids can create real usernames, join LEGO organizations, plan build days, share needs,
            and stay connected in a school-like stream.
          </p>
        </div>

        <div className="status-card">
          <div className="pill success">{supabaseStatus.label}</div>
          <div className="pill info">{firebaseStatus.label}</div>
          <strong>{statusMessage}</strong>
        </div>
      </section>

      <section className="stats-grid">
        <div className="panel stat-card">
          <span>Open orgs</span>
          <strong>{organizations.length}</strong>
        </div>
        <div className="panel stat-card">
          <span>Members</span>
          <strong>{organizations.reduce((sum, org) => sum + org.members, 0)}</strong>
        </div>
        <div className="panel stat-card">
          <span>Daily signups</span>
          <strong>{signupCount}/15</strong>
        </div>
        <div className="panel stat-card">
          <span>Drive uploads</span>
          <strong>{driveFiles.length}</strong>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <h2>Create your username</h2>
          <form onSubmit={handleUsernameSubmit} className="stack-form">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a real kid username"
            />
            <button type="submit">Save profile</button>
          </form>

          <div className="profile-card">
            <div className="avatar">{(displayName || 'Builder').slice(0, 1).toUpperCase()}</div>
            <div>
              <h3>{displayName || 'Builder Kid'}</h3>
              <p>Kid-safe account · Verified member</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Create an organization</h2>
          <form onSubmit={handleCreateOrg} className="stack-form">
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Organization name"
            />
            <select value={newOrgTheme} onChange={(e) => setNewOrgTheme(e.target.value)}>
              <option>Space</option>
              <option>City</option>
              <option>Castle</option>
              <option>Animals</option>
              <option>Vehicles</option>
            </select>
            <button type="submit">Launch org</button>
          </form>
        </div>
      </section>

      <section className="content-grid advanced-grid">
        <div className="panel wide-panel">
          <h2>Organizations</h2>
          <div className="org-list">
            {organizations.map((org) => (
              <button
                key={org.id}
                className={`org-card ${selectedOrg?.id === org.id ? 'selected' : ''}`}
                type="button"
                onClick={() => setSelectedOrgId(org.id)}
              >
                <div>
                  <strong>{org.name}</strong>
                  <p>{org.theme} project team</p>
                </div>
                <span>{org.members}/{org.signupLimit}</span>
              </button>
            ))}
          </div>

          <div className="join-row">
            <button type="button" onClick={() => handleJoinOrg(selectedOrg.id)}>
              Join selected org
            </button>
            <button type="button" className="secondary" onClick={handleDailySignup}>
              Signup for the day ({signupCount}/15)
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Team chat</h2>
          <div className="chat-box">
            {messages.map((msg) => (
              <div className="chat-item" key={msg.id}>
                <strong>{msg.author}</strong>
                <p>{msg.text}</p>
                <small>{msg.time}</small>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="stack-form compact">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message the team"
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </section>

      <section className="content-grid advanced-grid">
        <div className="panel wide-panel">
          <h2>Classroom-style live stream</h2>
          <form onSubmit={handleAddPost} className="stack-form compact">
            <input
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share a build update, part request, or event note"
            />
            <button type="submit">Post update</button>
          </form>

          <div className="feed-stream">
            {feed.map((item) => (
              <article key={item.id} className="feed-item">
                <div className="feed-header">
                  <span className="feed-emoji">{item.emoji}</span>
                  <div>
                    <strong>{item.author}</strong>
                    <small>{item.time}</small>
                  </div>
                </div>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Shared drive</h2>
          <label className="upload-box">
            <input type="file" onChange={handleDriveUpload} accept="video/*,.mp4,.mov,.avi" />
            <span>Upload a movie or video</span>
          </label>

          <div className="drive-list">
            {driveFiles.map((file) => (
              <div key={file.id} className="drive-item">
                <strong>{file.name}</strong>
                <span>{file.type}</span>
                <small>{file.size} · {file.uploadedAt}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
