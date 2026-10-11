import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = { title: "Workspace App" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
