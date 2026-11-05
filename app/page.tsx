'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type Club = {
  id: string;
  name: string;
  theme: string;
  members: number;
  signupLimit: number;
  activeDay: string;
};

type FeedItem = {
  id: string;
  author: string;
  orgId: string;
  message: string;
  time: string;
  emoji: string;
};

type Message = {
  id: string;
  author: string;
  text: string;
  time: string;
};

type DriveFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
};

type SavedState = {
  username: string;
  clubs: Club[];
  feed: FeedItem[];
  messages: Message[];
  driveFiles: DriveFile[];
  signupCount: number;
};

const STORAGE_KEY = 'lego-fun-demo-state';
const blockedNameWords = ['subins', 'sub-ins', 'fake', 'bot', 'admin'];
const defaultClubs: Club[] = [
  {
    id: 'org-space',
    name: 'Moon Rover Club',
    theme: 'Space',
    members: 12,
    signupLimit: 15,
    activeDay: 'Saturday',
  },
  {
    id: 'org-castle',
    name: 'Castle Builders',
    theme: 'Castle',
    members: 9,
    signupLimit: 15,
    activeDay: 'Sunday',
  },
  {
    id: 'org-city',
    name: 'City Makers',
    theme: 'City',
    members: 7,
    signupLimit: 15,
    activeDay: 'Friday',
  },
];

const defaultFeed: FeedItem[] = [
  {
    id: 'feed-1',
    author: 'Ms. Khan',
    orgId: 'org-space',
    message: 'We need 12 blue bricks for the rover wheel project. Please check your boxes at home!',
    time: '2h ago',
    emoji: '🧱',
  },
  {
    id: 'feed-2',
    author: 'Sam',
    orgId: 'org-castle',
    message: 'Completed the gate! Everyone can view the build video in the drive folder.',
    time: '3h ago',
    emoji: '🏰',
  },
  {
    id: 'feed-3',
    author: 'Tori',
    orgId: 'org-city',
    message: 'Tomorrow we will make a mini train platform with a station sign and lights.',
    time: 'Today',
    emoji: '🚉',
  },
];

const defaultMessages: Message[] = [
  {
    id: 'msg-1',
    author: 'Coach',
    text: 'Remember to bring your project sketch today.',
    time: 'Now',
  },
  {
    id: 'msg-2',
    author: 'Builder Kid',
    text: 'I can help with the robot wheels after lunch.',
    time: '2m ago',
  },
];

const defaultDriveFiles: DriveFile[] = [
  {
    id: 'drive-1',
    name: 'castle-tower-demo.mp4',
    type: 'Movie',
    size: '5.3 MB',
    uploadedAt: 'Today',
  },
  {
    id: 'drive-2',
    name: 'space-lab-plan.pdf',
    type: 'File',
    size: '820 KB',
    uploadedAt: 'Yesterday',
  },
];

function readSavedState(): SavedState {
  if (typeof window === 'undefined') {
    return {
      username: '',
      clubs: defaultClubs,
      feed: defaultFeed,
      messages: defaultMessages,
      driveFiles: defaultDriveFiles,
      signupCount: 12,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        username: '',
        clubs: defaultClubs,
        feed: defaultFeed,
        messages: defaultMessages,
        driveFiles: defaultDriveFiles,
        signupCount: 12,
      };
    }

    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      username: parsed.username ?? '',
      clubs: parsed.clubs?.length ? parsed.clubs : defaultClubs,
      feed: parsed.feed?.length ? parsed.feed : defaultFeed,
      messages: parsed.messages?.length ? parsed.messages : defaultMessages,
      driveFiles: parsed.driveFiles?.length ? parsed.driveFiles : defaultDriveFiles,
      signupCount: typeof parsed.signupCount === 'number' ? parsed.signupCount : 12,
    };
  } catch {
    return {
      username: '',
      clubs: defaultClubs,
      feed: defaultFeed,
      messages: defaultMessages,
      driveFiles: defaultDriveFiles,
      signupCount: 12,
    };
  }
}

export default function HomePage() {
  const saved = useMemo(() => readSavedState(), []);
  const [username, setUsername] = useState(saved.username);
  const [displayName, setDisplayName] = useState(saved.username || 'Builder Kid');
  const [clubs, setClubs] = useState<Club[]>(saved.clubs);
  const [selectedClubId, setSelectedClubId] = useState(saved.clubs[0]?.id ?? '');
  const [feed, setFeed] = useState<FeedItem[]>(saved.feed);
  const [messages, setMessages] = useState<Message[]>(saved.messages);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>(saved.driveFiles);
  const [signupCount, setSignupCount] = useState(saved.signupCount);
  const [newPost, setNewPost] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [newClubTheme, setNewClubTheme] = useState('Space');
  const [statusMessage, setStatusMessage] = useState('Ready for team signups.');

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? clubs[0],
    [clubs, selectedClubId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: SavedState = {
      username: displayName,
      clubs,
      feed,
      messages,
      driveFiles,
      signupCount,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [clubs, displayName, driveFiles, feed, messages, signupCount]);

  const handleUsernameSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = username.trim();

    if (!trimmed) {
      setStatusMessage('Choose a username before continuing.');
      return;
    }

    const normalized = trimmed.toLowerCase();
    const hasBlockedWord = blockedNameWords.some((word) => normalized.includes(word));

    if (trimmed.length < 3 || trimmed.length > 20 || hasBlockedWord) {
      setStatusMessage('That name is not allowed. Please use a real, kid-safe username.');
      return;
    }

    setDisplayName(trimmed);
    setStatusMessage(`Welcome aboard, ${trimmed}! Your profile is ready.`);
  };

  const handleCreateClub = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newClubName.trim();

    if (!trimmed) {
      setStatusMessage('Give your club a name first.');
      return;
    }

    const createdClub: Club = {
      id: `club-${Date.now()}`,
      name: trimmed,
      theme: newClubTheme,
      members: 1,
      signupLimit: 15,
      activeDay: 'Saturday',
    };

    setClubs((current) => [createdClub, ...current]);
    setSelectedClubId(createdClub.id);
    setNewClubName('');
    setNewClubTheme('Space');
    setStatusMessage(`${trimmed} is live! Invite friends to join.`);
  };

  const handleJoinClub = () => {
    if (!selectedClub) {
      setStatusMessage('Choose a club to join first.');
      return;
    }

    if (selectedClub.members >= selectedClub.signupLimit) {
      setStatusMessage(`This club is full for today. Max ${selectedClub.signupLimit} members.`);
      return;
    }

    setClubs((current) =>
      current.map((club) =>
        club.id === selectedClub.id ? { ...club, members: club.members + 1 } : club,
      ),
    );
    setStatusMessage(`You joined ${selectedClub.name} successfully.`);
  };

  const handleDailySignup = () => {
    if (signupCount >= 15) {
      setStatusMessage('Daily signup is full. No more than 15 people can sign up per day.');
      return;
    }

    setSignupCount((count) => count + 1);
    setStatusMessage('Your day signup was added successfully.');
  };

  const handleAddPost = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClub || !newPost.trim()) return;

    const nextPost: FeedItem = {
      id: `post-${Date.now()}`,
      author: displayName || 'Builder Kid',
      orgId: selectedClub.id,
      message: newPost.trim(),
      time: 'Just now',
      emoji: '🚀',
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
      time: 'Now',
    };

    setMessages((current) => [...current, nextMessage]);
    setNewMessage('');
    setStatusMessage('Message sent to the team chat.');
  };

  const handleDriveUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextFile: DriveFile = {
      id: `drive-${Date.now()}`,
      name: file.name,
      type: file.type.startsWith('video/') ? 'Movie' : 'File',
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      uploadedAt: 'Just now',
    };

    setDriveFiles((current) => [nextFile, ...current]);
    event.target.value = '';
    setStatusMessage(`Uploaded ${file.name} to the shared drive folder.`);
  };

  return (
    <main className="page-shell">
      <section className="hero panel">
        <div>
          <p className="eyebrow">LEGO FUN CLUB</p>
          <h1>Build teams, plan projects, and share wins.</h1>
          <p className="hero-copy">
            Kids can create real usernames, join LEGO clubs, plan build days, share needs,
            and stay connected in a school-like stream.
          </p>
        </div>

        <div className="status-card">
          <div className="pill success">Kid-safe mode</div>
          <strong>{statusMessage}</strong>
          <span>{displayName}</span>
        </div>
      </section>

      <section className="stats-grid">
        <div className="panel stat-card">
          <span>Open clubs</span>
          <strong>{clubs.length}</strong>
        </div>
        <div className="panel stat-card">
          <span>Members</span>
          <strong>{clubs.reduce((sum, club) => sum + club.members, 0)}</strong>
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
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter a kid-safe username"
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
          <h2>Create a club</h2>
          <form onSubmit={handleCreateClub} className="stack-form">
            <input
              value={newClubName}
              onChange={(event) => setNewClubName(event.target.value)}
              placeholder="Club name"
            />
            <select value={newClubTheme} onChange={(event) => setNewClubTheme(event.target.value)}>
              <option>Space</option>
              <option>City</option>
              <option>Castle</option>
              <option>Animals</option>
              <option>Vehicles</option>
            </select>
            <button type="submit">Launch club</button>
          </form>
        </div>
      </section>

      <section className="content-grid advanced-grid">
        <div className="panel wide-panel">
          <h2>Clubs</h2>
          <div className="org-list">
            {clubs.map((club) => (
              <button
                key={club.id}
                className={`org-card ${selectedClub?.id === club.id ? 'selected' : ''}`}
                type="button"
                onClick={() => setSelectedClubId(club.id)}
              >
                <div>
                  <strong>{club.name}</strong>
                  <p>{club.theme} project team</p>
                </div>
                <span>
                  {club.members}/{club.signupLimit}
                </span>
              </button>
            ))}
          </div>

          <div className="join-row">
            <button type="button" onClick={handleJoinClub}>
              Join selected club
            </button>
            <button type="button" className="secondary" onClick={handleDailySignup}>
              Signup for the day ({signupCount}/15)
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Team chat</h2>
          <div className="chat-box">
            {messages.map((message) => (
              <div className="chat-item" key={message.id}>
                <strong>{message.author}</strong>
                <p>{message.text}</p>
                <small>{message.time}</small>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="stack-form compact">
            <input
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
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
              onChange={(event) => setNewPost(event.target.value)}
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
                <small>
                  {file.size} · {file.uploadedAt}
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
