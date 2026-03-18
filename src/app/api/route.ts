import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 9000;
const BROWSER_HEADERS: Record<string, string> = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	Accept: "application/json, text/plain, */*",
	"Accept-Language": "en-US,en;q=0.9",
	"Accept-Encoding": "gzip, deflate, br",
	Referer: "https://finance.yahoo.com/",
	Origin: "https://finance.yahoo.com",
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "cors",
	"sec-fetch-site": "same-site",
	"Cache-Control": "no-cache",
};

async function fetchWithTimeout(url: string): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await fetch(url, {
			headers: BROWSER_HEADERS,
			signal: controller.signal,
			next: { revalidate: 300 },
		});
	} finally {
		clearTimeout(timer);
	}
}

function parsePayload(json: unknown, symbol: string) {
	const root = json as Record<string, unknown>;
	const chart = root?.chart as Record<string, unknown> | undefined;
	const results = chart?.result as Record<string, unknown>[] | undefined;

	if (!Array.isArray(results) || results.length === 0) {
		const errDesc = (chart?.error as Record<string, string> | null)?.description;
		throw new Error(errDesc ?? "No result in API response!");
	}

	const result = results[0];
	const meta = result.meta as Record<string, unknown> | undefined;
	const timestamps = result.timestamp as number[] | undefined;
	const quotes = (result.indicators as Record<string, unknown[]> | undefined)
		?.quote as Record<string, (number | null)[]>[] | undefined;

	if (!timestamps?.length || !quotes?.[0]?.close?.length) {
		throw new Error("Missing timestamps or close prices!");
	}

	const closes = quotes[0].close;

	const points = timestamps
		.map((t, i) => ({ date: t * 1000, price: closes[i] }))
		.filter((p): p is { date: number; price: number } =>
			p.price !== null && Number.isFinite(p.price)
		);

	if (points.length < 5) {
		throw new Error(`Only ${points.length} usable data points!`);
	}

	return {
		name:
			(meta?.longName as string) ||
			(meta?.shortName as string) ||
			symbol,
		points,
	};
}

export async function GET(request: NextRequest) {
	const rawTicker = request.nextUrl.searchParams.get("ticker") ?? "";
	const symbol = rawTicker.trim().toUpperCase();

	if (!symbol) {
		return NextResponse.json({ error: "Ticker is required!" }, { status: 400 });
	}

	if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
		return NextResponse.json(
			{ error: `"${symbol}" is not a valid ticker!` },
			{ status: 400 }
		);
	}

	const now = Math.floor(Date.now() / 1000);
	const threeMonthsAgo = now - 90 * 24 * 60 * 60;

	const endpoints = [
		`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`,
		`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`,
		`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${threeMonthsAgo}&period2=${now}`,
		`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${threeMonthsAgo}&period2=${now}`,
	];

	const log: string[] = [];

	for (const url of endpoints) {
		const tag = url.includes("query2") ? "q2" : "q1";
		const style = url.includes("range=") ? "range" : "period";

		try {
			const res = await fetchWithTimeout(url);

			if (!res.ok) {
				log.push(`${tag}/${style}: HTTP ${res.status}`);
				continue;
			}

			let json: unknown;
			try {
				json = await res.json();
			} catch {
				log.push(`${tag}/${style}: bad JSON`);
				continue;
			}

			try {
				const { name, points } = parsePayload(json, symbol);
				return NextResponse.json({ ticker: symbol, name, points });
			} catch (e) {
				log.push(`${tag}/${style}: ${e instanceof Error ? e.message : e}`);
				continue;
			}
		} catch (e) {
			const msg =
				e instanceof Error
					? e.name === "AbortError"
						? "timeout"
						: e.message
					: String(e);
			log.push(`${tag}/${style}: ${msg}`);
			continue;
		}
	}

	console.error(`All endpoints failed for "${symbol}":`, log);

	return NextResponse.json(
		{
			error: `No data found for "${symbol}". Check that the ticker is valid and listed on a US stock exchange, and try again!`,
			debug: log,
		},
		{ status: 502 }
	);
}