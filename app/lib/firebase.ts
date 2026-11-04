export function getFirebaseStatus() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    return { label: 'Demo mode: Firebase not connected', enabled: false };
  }

  return { label: 'Firebase connected', enabled: true };
}
