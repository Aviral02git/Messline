import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Messline",
  description: "Mess food booking. Plates go down when someone books.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <footer className="mt-auto border-t border-neutral-200 py-4 text-xs text-neutral-500">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-6">
            <a
              href="https://github.com/sanjana2505006/Messline"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
            <a
              href="https://github.com/sanjana2505006/Messline/blob/main/docs/rules.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Rules
            </a>
            <a
              href="https://github.com/sanjana2505006/Messline/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Contributing
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
