import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lego Fun',
  description: 'A family-friendly LEGO club and project organizer for kids and teams.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
