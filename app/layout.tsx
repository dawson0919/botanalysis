
export const metadata = { title: "Strategy Analyzer", description: "Batch backtest ranking & scoring" };
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
