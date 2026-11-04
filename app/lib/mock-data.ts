export type Organization = {
  id: string;
  name: string;
  theme: string;
  members: number;
  projects: string[];
  signupLimit: number;
  activeDay: string;
};

export type FeedItem = {
  id: string;
  author: string;
  orgId: string;
  message: string;
  time: string;
  emoji: string;
};

export type Message = {
  id: string;
  author: string;
  text: string;
  time: string;
};

export type DriveFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
};

export const initialUser = {
  displayName: 'Milo Builder'
};

export const initialOrganizations: Organization[] = [
  {
    id: 'org-space',
    name: 'Moon Rover Club',
    theme: 'Space',
    members: 12,
    projects: ['Build a rover', 'Design moon base'],
    signupLimit: 15,
    activeDay: 'Saturday'
  },
  {
    id: 'org-castle',
    name: 'Castle Builders',
    theme: 'Castle',
    members: 9,
    projects: ['Draw a city plan', 'Create catapult'],
    signupLimit: 15,
    activeDay: 'Sunday'
  },
  {
    id: 'org-city',
    name: 'City Makers',
    theme: 'City',
    members: 7,
    projects: ['Road planning', 'Mini train station'],
    signupLimit: 15,
    activeDay: 'Friday'
  }
];

export const initialFeed: FeedItem[] = [
  {
    id: 'feed-1',
    author: 'Ms. Khan',
    orgId: 'org-space',
    message: 'We need 12 blue bricks for the rover wheel project. Please check your boxes at home!',
    time: '2h ago',
    emoji: '🧱'
  },
  {
    id: 'feed-2',
    author: 'Sam',
    orgId: 'org-castle',
    message: 'Completed the gate! Everyone can view the build video in the drive folder.',
    time: '3h ago',
    emoji: '🏰'
  },
  {
    id: 'feed-3',
    author: 'Tori',
    orgId: 'org-city',
    message: 'Tomorrow we will make a mini train platform with a station sign and lights.',
    time: 'Today',
    emoji: '🚉'
  }
];

export const initialMessages: Message[] = [
  {
    id: 'msg-1',
    author: 'Coach',
    text: 'Remember to bring your project sketch today.',
    time: 'Now'
  },
  {
    id: 'msg-2',
    author: 'Milo Builder',
    text: 'I can help with the robot wheels after lunch.',
    time: '2m ago'
  }
];

export const initialDriveFiles: DriveFile[] = [
  {
    id: 'drive-1',
    name: 'castle-tower-demo.mp4',
    type: 'Movie',
    size: '5.3 MB',
    uploadedAt: 'Today'
  },
  {
    id: 'drive-2',
    name: 'space-lab-plan.pdf',
    type: 'File',
    size: '820 KB',
    uploadedAt: 'Yesterday'
  }
];
