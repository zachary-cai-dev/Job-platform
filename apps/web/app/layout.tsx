import type { ReactNode } from "react";
import { Suspense } from "react";
import { NewJobsNotifier } from "@/components/NewJobsNotifier";
import { QueryProvider } from "@/components/QueryProvider";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

export const metadata = {
  title: "Euro Jobs — Remote tech jobs for Europe",
  description: "Freshly posted remote technology jobs that candidates in Europe are eligible for.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <QueryProvider>
          <TopBar />
          {children}
          {/* NewJobsNotifier reads the current tab via useSearchParams() (see
              useFilterNavigation) — that requires a Suspense boundary, or Next.js
              fails to statically prerender pages that share this root layout,
              including the auto-generated /_not-found page. */}
          <Suspense fallback={null}>
            <NewJobsNotifier />
          </Suspense>
        </QueryProvider>
      </body>
    </html>
  );
}
