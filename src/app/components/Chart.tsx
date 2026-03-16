"use client";

import { useState } from "react";
// Get ticker and other info from Form.tsx

async function getPrice() {
    const res = await fetch("/api/price/{TICKER}");
    const data = await res.json();
}

export default function Chart() {
    return (
        <>
            
        </>
    )
}