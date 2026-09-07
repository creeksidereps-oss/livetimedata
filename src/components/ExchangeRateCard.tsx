"use client";

import React, { useEffect, useState } from "react";
import countryToCurrencyRaw from "country-to-currency";

const countryToCurrency = (countryToCurrencyRaw as any)?.default || countryToCurrencyRaw;

const CURRENCY_LIST = [
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" },
  { code: "JPY", label: "JPY (¥) - Japanese Yen" },
  { code: "CHF", label: "CHF (Fr) - Swiss Franc" },
  { code: "CNY", label: "CNY (¥) - Chinese Yuan" },
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "MXN", label: "MXN ($) - Mexican Peso" },
  { code: "BRL", label: "BRL (R$) - Brazilian Real" },
  { code: "ZAR", label: "ZAR (R) - South African Rand" },
  { code: "SGD", label: "SGD ($) - Singapore Dollar" },
  { code: "NZD", label: "NZD ($) - New Zealand Dollar" },
  { code: "KRW", label: "KRW (₩) - South Korean Won" },
  { code: "TRY", label: "TRY (₺) - Turkish Lira" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "THB", label: "THB (฿) - Thai Baht" },
  { code: "SEK", label: "SEK (kr) - Swedish Krona" },
  { code: "NOK", label: "NOK (kr) - Norwegian Krone" },
];

export default function ExchangeRateCard({ countryCode = "US" }: { countryCode?: string }) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState("EUR");
  const [amount, setAmount] = useState<string>("1");
  const [loading, setLoading] = useState(true);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(CURRENCY_LIST.map(c => c.code));

  // Determine target currency based on searched city's country
  useEffect(() => {
    if (!countryCode) return;
    
    const cleanCode = countryCode.trim().toUpperCase();
    const localCurrency = countryToCurrency?.[cleanCode];
    
    if (localCurrency) {
      if (cleanCode === "US") {
        setBaseCurrency("USD");
        setTargetCurrency("EUR"); // Default US search to EUR comparison
      } else {
        setBaseCurrency("USD");
        setTargetCurrency(localCurrency);
      }

      setCurrencyOptions(prev => prev.includes(localCurrency) ? prev : [localCurrency, ...prev]);
    } else {
      setTargetCurrency("EUR");
    }
  }, [countryCode]);

  // Fetch real-time exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
        const data = await res.json();
        if (data.rates) {
          setRates(data.rates);
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
  }, [baseCurrency]);

  const numAmount = parseFloat(amount) || 0;
  const rate = rates[targetCurrency] || 0;
  const convertedValue = rate ? (numAmount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---";

  return (
    <div
      style={{
        border: "2px solid #2563eb",
        borderRadius: "16px",
        overflow: "hidden",
        background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
        boxShadow: "0 10px 25px rgba(37,99,235,0.15)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ fontSize: "12px", fontWeight: 900, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "16px" }}>💵</span> Exchange Calculator
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        
        {/* Amount Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Amount
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: "8px", 
              border: "1.5px solid #cbd5e1", 
              fontSize: "15px", 
              fontWeight: 800,
              color: "#0f172a",
              backgroundColor: "#ffffff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Currency Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          
          {/* Base Currency (From) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ fontSize: "9px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
              From
            </label>
            <select 
              value={baseCurrency} 
              onChange={(e) => setBaseCurrency(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "8px 6px", 
                borderRadius: "8px", 
                border: "1.5px solid #cbd5e1", 
                fontSize: "12px", 
                fontWeight: 800, 
                color: "#0f172a", 
                backgroundColor: "#ffffff", 
                cursor: "pointer", 
                outline: "none" 
              }}
            >
              {currencyOptions.map(c => {
                const item = CURRENCY_LIST.find(l => l.code === c);
                return (
                  <option key={`base-${c}`} value={c} style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                    {item ? item.code : c}
                  </option>
                );
              })}
            </select>
          </div>

          <span style={{ color: "#94a3b8", fontSize: "18px", fontWeight: 900, marginTop: "14px" }}>→</span>

          {/* Target Currency (To) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ fontSize: "9px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
              To
            </label>
            <select 
              value={targetCurrency} 
              onChange={(e) => setTargetCurrency(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "8px 6px", 
                borderRadius: "8px", 
                border: "1.5px solid #cbd5e1", 
                fontSize: "12px", 
                fontWeight: 800, 
                color: "#0f172a", 
                backgroundColor: "#ffffff", 
                cursor: "pointer", 
                outline: "none" 
              }}
            >
              {currencyOptions.map(c => {
                const item = CURRENCY_LIST.find(l => l.code === c);
                return (
                  <option key={`target-${c}`} value={c} style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                    {item ? item.code : c}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Result Display */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", marginTop: "2px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "26px", fontWeight: 900, color: "#2563eb", letterSpacing: "-0.02em" }}>
            {loading ? "..." : convertedValue}
          </span>
          <span style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a" }}>{targetCurrency}</span>
        </div>
        {rate > 0 && (
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>
            1 {baseCurrency} = {rate.toFixed(4)} {targetCurrency}
          </span>
        )}
      </div>

      {/* Attribution */}
      <div style={{ fontSize: "9px", color: "#94a3b8", textAlign: "center", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
        Live Indicative Rates (Open Exchange API)
      </div>
    </div>
  );
}
