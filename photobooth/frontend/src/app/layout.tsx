import type { Metadata } from "next";
import { Inter, Sarabun } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
});
const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sarabun",
});

export const metadata: Metadata = {
  title: "PSRU AI Virtual Photo Booth & VR Studio",
  description:
    "ระบบถ่ายภาพเสมือนอัจฉริยะด้วย AI และฉากเสมือน — มหาวิทยาลัยราชภัฏพิบูลสงคราม",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${inter.variable} ${sarabun.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="font-thai antialiased">
        <Header />
        <main className="max-w-[1500px] mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-[1500px] mx-auto px-4 py-6 text-center text-[11px] text-psru-muted">
          © 2569 มหาวิทยาลัยราชภัฏพิบูลสงคราม · PSRU AI Virtual Photo Booth & VR
          Studio
        </footer>
      </body>
    </html>
  );
}
