import Link from "next/link";

export default function Navbar() {
	return (
		<header className="sticky z-50 w-full border-b border-white/5 bg-black text-white">
			<div className="mx-auto grid h-14 w-full max-w-screen-2xl grid-cols-3 items-center px-4 sm:px-6">
				<div className="flex items-center justify-start">
					<Link href="/" className="rounded-sm text-md font-semibold uppercase tracking-wider leading-none">
						Ratebase
					</Link>
				</div>

				<nav className="items-center justify-center gap-5 text-sm uppercase tracking-wider sm:flex">
					<Link href="/" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Home
					</Link>
					<Link href="/tracker" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Markets
					</Link>
					<Link href="#" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Community
					</Link>
					<Link href="#" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Tracker
					</Link>
					<Link href="#" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Blog
					</Link>
				</nav>

				<nav className="flex items-center justify-end gap-4 text-md font-semibold uppercase tracking-wider">
					<Link href="/login" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Sign In
					</Link>
					<Link href="/register" className="rounded-sm px-1 py-0.5 underline-offset-4 hover:underline">
						Register
					</Link>
				</nav>
			</div>
		</header>
	);
}
