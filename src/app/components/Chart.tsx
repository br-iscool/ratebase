"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface DataPoint {
	date: Date;
	price: number;
}

interface StockInfo {
	ticker: string;
	name: string;
}

function makePlaceholderData(): DataPoint[] {
	const pts: DataPoint[] = [];
	const start = new Date();
	start.setMonth(start.getMonth() - 3);
	let price = 100;
	const cur = new Date(start);
	const now = new Date();
	while (cur <= now) {
		if (cur.getDay() !== 0 && cur.getDay() !== 6) {
			price = Math.max(80, price + (Math.random() - 0.5) * 3);
			pts.push({ date: new Date(cur), price });
		}
		cur.setDate(cur.getDate() + 1);
	}
	return pts;
}

function renderChart(svgEl: SVGSVGElement, tooltipEl: HTMLDivElement, chartData: DataPoint[], isPlaceholder: boolean, width: number) {
	const H = 380;
	const m = { top: 24, right: 20, bottom: 48, left: 70 };
	const iW = width - m.left - m.right;
	const iH = H - m.top - m.bottom;

	const svg = d3.select(svgEl);
	svg.selectAll("*").remove();
	svg.attr("width", width).attr("height", H).attr("viewBox", `0 0 ${width} ${H}`).style("background", "#ffffff").style("display", "block");

	const defs = svg.append("defs");
	defs.append("clipPath").attr("id", "clip").append("rect").attr("width", iW).attr("height", iH);

	const grad = defs.append("linearGradient").attr("id", "areaGrad").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
	grad.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", isPlaceholder ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.08)");
	grad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0)");

	const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

	const xExtent = d3.extent(chartData, (d) => d.date) as [Date, Date];
	const xScale = d3.scaleTime().domain(xExtent).range([0, iW]);

	const [minP, maxP] = d3.extent(chartData, (d) => d.price) as [number, number];
	const pad = (maxP - minP) * 0.12;
	const yScale = d3
		.scaleLinear()
		.domain([minP - pad, maxP + pad])
		.nice()
		.range([iH, 0]);

	g.append("g")
		.selectAll("line.y-grid")
		.data(yScale.ticks(5))
		.join("line")
		.attr("x1", 0)
		.attr("x2", iW)
		.attr("y1", (d) => yScale(d))
		.attr("y2", (d) => yScale(d))
		.attr("stroke", "#eeeeee")
		.attr("stroke-width", 1);

	const areaGen = d3
		.area<DataPoint>()
		.x((d) => xScale(d.date))
		.y0(iH)
		.y1((d) => yScale(d.price))
		.curve(d3.curveMonotoneX);

	g.append("path").datum(chartData).attr("clip-path", "url(#clip)").attr("fill", "url(#areaGrad)").attr("d", areaGen);

	const lineColor = isPlaceholder ? "#cccccc" : "#111111";

	const lineGen = d3
		.line<DataPoint>()
		.x((d) => xScale(d.date))
		.y((d) => yScale(d.price))
		.curve(d3.curveMonotoneX);

	const linePath = g
		.append("path")
		.datum(chartData)
		.attr("clip-path", "url(#clip)")
		.attr("fill", "none")
		.attr("stroke", lineColor)
		.attr("stroke-width", isPlaceholder ? 1.5 : 1.75)
		.attr("d", lineGen);

	if (!isPlaceholder) {
		const node = linePath.node();
		if (node) {
			const len = node.getTotalLength();
			linePath.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len).transition().duration(800).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
		}
	}

	const axisColor = isPlaceholder ? "#cccccc" : "#555555";
	const axisFont = "11px var(--font-pt-serif, serif)";

	g.append("g")
		.attr("transform", `translate(0,${iH})`)
		.call(
			d3
				.axisBottom<Date>(xScale)
				.ticks(6)
				.tickFormat(d3.timeFormat("%b %d") as (d: Date) => string)
				.tickSize(0)
				.tickPadding(12),
		)
		.call((ax) => ax.select(".domain").attr("stroke", "#dddddd"))
		.call((ax) => ax.selectAll("text").attr("fill", axisColor).attr("font", axisFont));

	g.append("g")
		.call(
			d3
				.axisLeft<number>(yScale)
				.ticks(5)
				.tickFormat((d) => `$${d.toFixed(0)}`)
				.tickSize(0)
				.tickPadding(10),
		)
		.call((ax) => ax.select(".domain").remove())
		.call((ax) => ax.selectAll("text").attr("fill", axisColor).attr("font", axisFont));

	if (isPlaceholder) {
		svg.append("text")
			.attr("x", width / 2)
			.attr("y", H / 2 + 4)
			.attr("text-anchor", "middle")
			.attr("fill", "#cccccc")
			.attr("font", "11px var(--font-pt-serif, serif)")
			.attr("letter-spacing", "0.18em")
			.text("ENTER A TICKER TO BEGIN");
		return;
	}

	const bisect = d3.bisector<DataPoint, Date>((d) => d.date).left;

	const crosshair = g.append("line").attr("y1", 0).attr("y2", iH).attr("stroke", "#aaaaaa").attr("stroke-width", 1).attr("stroke-dasharray", "3 3").attr("pointer-events", "none").attr("opacity", 0);

	const dot = g.append("circle").attr("r", 4).attr("fill", "#111111").attr("stroke", "#ffffff").attr("stroke-width", 2).attr("pointer-events", "none").attr("opacity", 0);

	g.append("rect")
		.attr("width", iW)
		.attr("height", iH)
		.attr("fill", "transparent")
		.style("cursor", "crosshair")
		.on("mousemove", function (event: MouseEvent) {
			const [mx] = d3.pointer(event, this);
			const hDate = xScale.invert(mx);
			const i = bisect(chartData, hDate, 1);
			const d0 = chartData[Math.max(0, i - 1)];
			const d1 = chartData[Math.min(chartData.length - 1, i)];
			const pt = Math.abs(hDate.getTime() - d0.date.getTime()) < Math.abs(d1.date.getTime() - hDate.getTime()) ? d0 : d1;

			const cx = xScale(pt.date);
			const cy = yScale(pt.price);

			crosshair.attr("x1", cx).attr("x2", cx).attr("opacity", 1);
			dot.attr("cx", cx).attr("cy", cy).attr("opacity", 1);

			const tipW = 126;
			const leftRaw = cx + m.left + 12;
			const leftPos = leftRaw + tipW > width ? cx + m.left - tipW - 12 : leftRaw;

			tooltipEl.style.opacity = "1";
			tooltipEl.style.left = `${leftPos}px`;
			tooltipEl.style.top = `${cy + m.top - 32}px`;
			tooltipEl.innerHTML = `
				<div style="font-size:10px;letter-spacing:0.08em;color:#888;margin-bottom:2px;">
					${d3.timeFormat("%b %d, %Y")(pt.date)}
				</div>
				<div style="font-size:15px;font-weight:600;color:#111;letter-spacing:0.01em;">
					$${pt.price.toFixed(2)}
				</div>
			`;
		})
		.on("mouseleave", () => {
			crosshair.attr("opacity", 0);
			dot.attr("opacity", 0);
			tooltipEl.style.opacity = "0";
		});
}

export default function StockChart() {
	const svgRef = useRef<SVGSVGElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const placeholder = useRef<DataPoint[]>(makePlaceholderData());

	const [inputValue, setInputValue] = useState("");
	const [chartData, setChartData] = useState<DataPoint[]>([]);
	const [isPlaceholder, setIsPlaceholder] = useState(true);
	const [info, setInfo] = useState<StockInfo | null>(null);
	const [lastPrice, setLastPrice] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [chartWidth, setChartWidth] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		setChartWidth(el.clientWidth);
		const ro = new ResizeObserver((entries) => {
			setChartWidth(entries[0].contentRect.width);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		const svgEl = svgRef.current;
		const tipEl = tooltipRef.current;
		if (!svgEl || !tipEl || chartWidth === 0) return;
		const data = isPlaceholder ? placeholder.current : chartData;
		if (!data.length) return;
		renderChart(svgEl, tipEl, data, isPlaceholder, chartWidth);
	}, [chartData, isPlaceholder, chartWidth]);

	const fetchStock = useCallback(async (sym: string) => {
		setLoading(true);
		setError(null);

		try {
			const res = await fetch(`/api/?ticker=${encodeURIComponent(sym)}`);

			const text = await res.text();

			const trimmed = text.trimStart();
			if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
				console.error("API returned non-JSON:", text.slice(0, 300));
				throw new Error("API route returned an unexpected response. Check the server logs.");
			}

			const json = JSON.parse(text) as {
				ticker?: string;
				name?: string;
				points?: { date: number; price: number }[];
				error?: string;
				debug?: string[];
			};

			if (!res.ok || json.error) {
				if (json.debug?.length) {
					console.warn("API debug:", json.debug);
				}
				throw new Error(json.error ?? `Server error ${res.status}`);
			}

			if (!json.points?.length) {
				throw new Error("No price data returned!");
			}

			const parsed: DataPoint[] = json.points.map((p) => ({
				date: new Date(p.date),
				price: p.price,
			}));

			setChartData(parsed);
			setIsPlaceholder(false);
			setInfo({ ticker: json.ticker ?? sym, name: json.name ?? sym });
			setLastPrice(parsed[parsed.length - 1]?.price ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const sym = inputValue.trim().toUpperCase();
		if (!sym || loading) return;
		fetchStock(sym);
	};

	return (
		<div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10">
			<div className="mb-5 min-h-13 flex items-start justify-between">
				{info && !loading ? (
					<>
						<div>
							<p className="text-[10px] uppercase tracking-[0.22em] mb-1">{info.ticker}</p>
							<p className="text-lg font-semiboldleading-tight max-w-xs truncate">{info.name}</p>
						</div>
						{lastPrice !== null && (
							<div className="text-right">
								<p className="text-[10px] uppercase tracking-[0.16em] mb-1">Last Close</p>
								<p className="text-2xl font-semiboldtabular-nums">${lastPrice.toFixed(2)}</p>
							</div>
						)}
					</>
				) : (
					<p className="text-[10px] uppercase tracking-[0.22em] mt-1">{loading ? "Loading…" : "6-Month Price History"}</p>
				)}
			</div>

			<div ref={containerRef} className="relative w-full border border-gray-300 overflow-hidden bg-white">
				{loading && (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[2px]">
						<span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 animate-pulse">Fetching data…</span>
					</div>
				)}
				<svg ref={svgRef} className="block w-full" />
				<div
					ref={tooltipRef}
					style={{
						position: "absolute",
						opacity: 0,
						background: "#ffffff",
						border: "1px solid #e5e5e5",
						padding: "6px 12px",
						pointerEvents: "none",
						fontFamily: "var(--font-pt-serif), serif",
						transition: "opacity 0.1s ease",
						whiteSpace: "nowrap",
						zIndex: 20,
						boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
					}}
				/>
			</div>

			{error && <p className="mt-3 text-xs text-red-400 tracking-wide">{error}</p>}

			<form onSubmit={handleSubmit} className="mt-6 flex items-center gap-3 justify-center">
				<input
					type="text"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value.toUpperCase())}
					placeholder="TICKER"
					maxLength={10}
					spellCheck={false}
					autoCapitalize="characters"
					className="
                        w-40 px-4 py-2.5
                        bg-transparent
                        border border-gray-500
                        text-sm uppercase tracking-[0.2em]
                        outline-nonefocus:border-black
                        transition-colors duration-150
                    "
				/>
				<button
					type="submit"
					disabled={loading || !inputValue.trim()}
					className="
                        px-7 py-2.5
                        border border-gray-500
                        text-sm uppercase tracking-[0.2em] hover:border-black
                        disabled:opacity-30 disabled:cursor-not-allowed
                        transition-all duration-150
                    ">
					{loading ? "…" : "Search"}
				</button>
			</form>

			<p className="mt-3 text-center text-xs uppercase tracking-widest">Daily closing prices: previous 6 months</p>
		</div>
	);
}
