import type { Metadata } from "next";
import { PT_Serif } from "next/font/google";
import "./globals.css";

const ptSerif = PT_Serif({
	variable: "--font-pt-serif",
	weight: "400",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Ratebase",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${ptSerif.variable} antialiased`}>{children}</body>
		</html>
	);
}
