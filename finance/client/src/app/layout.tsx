import type { Metadata } from 'next';
import './globals.css';
import SidebarWrapper from '@/components/layout/SidebarWrapper';
import { ThemeProvider } from '@/context/ThemeContext';
import DemoBanner from '@/components/ui/DemoBanner';

export const metadata: Metadata = {
  title: 'Nimbus Finance — CFO Dashboard (Demo)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
        />
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('cfo-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body>
        <DemoBanner />
        <ThemeProvider>
          <SidebarWrapper>{children}</SidebarWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
