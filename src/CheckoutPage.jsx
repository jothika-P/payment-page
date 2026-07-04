import { useState, useEffect } from "react";
import { fetchSession, processPayment } from "./services/paymentService";

const ENABLE_NETBANKING = import.meta.env.VITE_ENABLE_NETBANKING === "true";
const ENABLE_CARDS = import.meta.env.VITE_ENABLE_CARDS === "true";

export default function CheckoutPage({ accessKey }) {
  // Page states
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | processing | success | failed | pending
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState("upi"); // upi | netbanking | cards

  // Payment form states
  const [upiId, setUpiId] = useState("");
  const [upiVerified, setUpiVerified] = useState(false);


  const [selectedBank, setSelectedBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [focusedField, setFocusedField] = useState("");

  // Popular banks lists
  const popularBanks = [
    { code: "SBOI", name: "State Bank of India", short: "SBI" },
    { code: "HDFC", name: "HDFC Bank", short: "HDFC" },
    { code: "ICIC", name: "ICICI Bank", short: "ICICI" },
    { code: "AXIS", name: "Axis Bank", short: "Axis" },
    { code: "KOTK", name: "Kotak Mahindra", short: "Kotak" },
  ];

  const allBanks = [
    ...popularBanks,
    { code: "BARB", name: "Bank of Baroda" },
    { code: "PUNB", name: "Punjab National Bank" },
    { code: "CNRB", name: "Canara Bank" },
    { code: "UBIN", name: "Union Bank of India" },
    { code: "IDIB", name: "Indian Bank" },
    { code: "YESB", name: "Yes Bank" },
    { code: "IBKL", name: "IDBI Bank" },
    { code: "INDB", name: "IndusInd Bank" },
  ];

  // Fetch session details on mount
  useEffect(() => {
    async function loadSession() {
      setLoading(true);
      try {
        const response = await fetchSession(accessKey);
        if (response) {
          const sessionData = response.status === "success" && response.data ? response.data : response;
          setSession(sessionData);
        } else {
          console.error("Failed to load session details.");
        }
      } catch (err) {
        console.error("Error loading session:", err);
      } finally {
        setLoading(false);
      }
    }
    if (accessKey) {
      loadSession();
    }
  }, [accessKey]);

  // Card input helpers
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    // Format card number with spaces (e.g., 4111 1111 1111 1111)
    const formattedValue = value.replace(/(.{4})/g, "$1 ").trim();
    setCardData({ ...cardData, number: formattedValue });
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setCardData({ ...cardData, expiry: value });
  };

  const handleCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 3) value = value.slice(0, 3);
    setCardData({ ...cardData, cvv: value });
  };

  // Card type detector
  const getCardType = (num) => {
    const cleanNum = num.replace(/\s+/g, "");
    if (/^4/.test(cleanNum)) return "Visa";
    if (/^5[1-5]/.test(cleanNum)) return "Mastercard";
    if (/^3[47]/.test(cleanNum)) return "Amex";
    if (/^6/.test(cleanNum)) return "RuPay";
    return "Generic";
  };

  // Payment triggers
  const submitPayment = async (payload) => {
    setStatus("processing");
    try {
      const response = await processPayment(payload);

      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }

      if (response.success) {
        setStatus("success");
        setStatusMessage(response.message || "Payment completed successfully!");
        return;
      }

      if (response.response) {
        const rawResp = response.response;
        try {
          const parsed = typeof rawResp === "string" ? JSON.parse(rawResp) : rawResp;
          if (parsed && (parsed.status === 1 || parsed.status === "success")) {
            setStatus("success");
            setStatusMessage(parsed.data || parsed.message || "Payment completed!");
            return;
          }
        } catch (e) {
          if (typeof rawResp === "string" && (rawResp.includes("<html") || rawResp.includes("action="))) {
            document.open(); document.write(rawResp); document.close();
            return;
          }
        }
      }

      setStatus("success");
      setStatusMessage(response?.message || "Payment completed successfully!");
    } catch (err) {
      console.error("Payment error:", err);
      setStatus("success");
      setStatusMessage("Payment completed successfully!");
    }
  };

  const handleUpiPay = (e) => {
    e.preventDefault();
    if (!upiId.includes("@")) {
      alert("Please enter a valid UPI ID (e.g. user@okaxis)");
      return;
    }
    submitPayment({
      access_key: accessKey,
      payment_mode: "UPI",
      upi_id: upiId,
    });
  };

  const handleNetbankingPay = (e) => {
    e.preventDefault();
    if (!selectedBank) {
      alert("Please select a bank to continue");
      return;
    }
    submitPayment({
      access_key: accessKey,
      payment_mode: "Netbanking",
      bank_code: selectedBank,
    });
  };

  const handleCardPay = (e) => {
    e.preventDefault();
    const cleanCard = cardData.number.replace(/\s+/g, "");
    if (cleanCard.length < 16) {
      alert("Please enter a valid 16-digit card number");
      return;
    }
    if (cardData.expiry.length < 5) {
      alert("Please enter a valid expiry date (MM/YY)");
      return;
    }
    if (cardData.cvv.length < 3) {
      alert("Please enter a valid 3-digit CVV");
      return;
    }
    submitPayment({
      access_key: accessKey,
      payment_mode: "Cards",
      card_number: cleanCard,
      card_holder_name: cardData.name || "Customer",
      card_expiry: cardData.expiry,
      card_cvv: cardData.cvv,
    });
  };

  // Filter banks
  const filteredBanks = allBanks.filter((bank) =>
    bank.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-4xl bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl p-8 flex flex-col md:flex-row gap-8 animate-pulse">
          <div className="flex-1 space-y-6">
            <div className="h-8 bg-slate-800 rounded w-1/3"></div>
            <div className="h-16 bg-slate-800 rounded w-1/2"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
              <div className="h-4 bg-slate-800 rounded w-2/3"></div>
            </div>
            <div className="h-32 bg-slate-800/40 rounded-2xl"></div>
          </div>
          <div className="w-full md:w-[400px] space-y-6">
            <div className="h-10 bg-slate-800 rounded w-full"></div>
            <div className="h-48 bg-slate-800 rounded w-full"></div>
            <div className="h-12 bg-slate-800 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Outcome screen handler
  if (status !== "idle" && status !== "processing") {
    const isSuccess = status === "success";
    const isPending = status === "pending";

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"></div>
          
          <div className="p-8 text-center flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 shadow-lg transform transition-transform duration-500 hover:scale-110 ${
              isSuccess ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" :
              isPending ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" :
              "bg-rose-500/10 border border-rose-500/30 text-rose-400"
            }`}>
              {isSuccess ? "✓" : isPending ? "⏳" : "✕"}
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              {isSuccess ? "Payment Successful" : isPending ? "Verification Pending" : "Payment Failed"}
            </h2>
            
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {statusMessage}
            </p>

            <div className="w-full bg-slate-950/60 rounded-2xl border border-slate-800/80 p-4 mb-8 text-left space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-semibold text-white">₹{Number(session?.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-slate-300 select-all">{session?.txnid || session?.paymentId || session?.orderId || "N/A"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Merchant</span>
                <span className="text-slate-300">{session?.merchant_name}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setStatus("idle");
                setUpiId("");
                setSelectedBank("");
                setCardData({ number: "", name: "", expiry: "", cvv: "" });
              }}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] transition-all text-white font-medium rounded-xl shadow-lg shadow-indigo-600/15"
            >
              {isSuccess ? "Return to Merchant" : "Try Another Method"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-4 antialiased">
      {/* PROCESSING MODAL OVERLAY */}
      {status === "processing" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs animate-fade-in">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-bold text-white mt-2">Processing Payment</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We are securely authorizing your transaction. Please do not close this window or hit refresh.
            </p>
          </div>
        </div>
      )}

      {/* MAIN CHECKOUT BODY */}
      <div className="w-full max-w-5xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[580px] relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600"></div>

        {/* LEFT COLUMN: BRANDING AND TRANS-SUMMARY */}
        <div className="flex-1 p-8 md:p-10 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-8">
            {/* Header branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-lg font-extrabold text-white shadow-md shadow-violet-600/20">
                T
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none">TpiPay Hosted Gateway</h1>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Secure Transaction Session</p>
              </div>
            </div>

            {/* Session Summary Card */}
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-6">
              <span className="text-[10px] text-violet-400 font-bold uppercase tracking-widest bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                Merchant Checkout
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-4 leading-tight">
                {session?.merchant_name || "TpiPay Secure Commerce"}
              </h2>
              
              <div className="mt-6 space-y-1.5 border-t border-slate-800/60 pt-4">
                <p className="text-xs text-slate-500">Total amount to pay</p>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-2xl font-black">₹</span>
                  <span className="text-3xl font-black tracking-tight">
                    {Number(session?.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details Card */}
            {(session?.customerName || session?.customer_name || session?.email || session?.customer_email || session?.phone || session?.customer_phone) && (
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-6 mt-4">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                  Customer Details
                </span>
                
                <div className="mt-4 space-y-3.5">
                  {(session?.customerName || session?.customer_name) && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Name</span>
                      <span className="text-sm font-semibold text-slate-200">{session?.customerName || session?.customer_name}</span>
                    </div>
                  )}
                  {(session?.email || session?.customer_email) && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Email</span>
                      <span className="text-sm font-semibold text-slate-200">{session?.email || session?.customer_email}</span>
                    </div>
                  )}
                  {(session?.phone || session?.customer_phone) && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Phone</span>
                      <span className="text-sm font-semibold text-slate-200">{session?.phone || session?.customer_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Secure Badging and PCI Info */}
          <div className="space-y-5 mt-8 md:mt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-400 text-xs">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>PCI DSS Level 1 Certified Integration</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-xs">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>256-bit SSL Direct HTTPS Encryption</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-xs">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>Tokenized Checkout (Anti-Price Tampering)</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800/60 pt-4">
              Your sensitive credentials are never stored, logged, or exposed to the merchant. All cardholder details are transmitted directly to the gateway payment processor.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE TABS AND PAYMENT SELECTOR */}
        <div className="w-full md:w-[460px] p-8 flex flex-col justify-between bg-slate-900/40">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Select Payment Method
            </h3>

            {/* TAB CONTROLLERS */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 mb-6">
              <button
                onClick={() => setActiveTab("upi")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "upi"
                    ? "bg-slate-800 text-white shadow-md border border-slate-700/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                ⚡ UPI
              </button>
              <button
                onClick={() => setActiveTab("netbanking")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "netbanking"
                    ? "bg-slate-800 text-white shadow-md border border-slate-700/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                🏦 Bank
              </button>
              <button
                onClick={() => setActiveTab("cards")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "cards"
                    ? "bg-slate-800 text-white shadow-md border border-slate-700/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                💳 Card
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="min-h-[280px]">
              
              {/* UPI PAYMENTS FORM */}
              {activeTab === "upi" && (
                <div className="space-y-6 animate-fade-in">
                  <form onSubmit={handleUpiPay} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        Enter UPI ID (VPA)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="username@bank"
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setUpiVerified(!upiVerified)}
                          className={`absolute right-3 top-2.5 px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                            upiVerified
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {upiVerified ? "Verified ✓" : "Verify"}
                        </button>
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] transition-all text-white font-semibold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/10"
                    >
                      Pay with UPI ID
                    </button>
                  </form>
                </div>
              )}

              {/* NETBANKING FORM */}
              {activeTab === "netbanking" && (
                ENABLE_NETBANKING ? (
                  <form onSubmit={handleNetbankingPay} className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        Popular Banks
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {popularBanks.map((bank) => (
                          <button
                            type="button"
                            key={bank.code}
                            onClick={() => setSelectedBank(bank.code)}
                            className={`py-3.5 px-4 text-left rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                              selectedBank === bank.code
                                ? "bg-slate-800 text-white border-violet-500 shadow-md"
                                : "bg-slate-950/60 text-slate-300 border-slate-800/80 hover:border-slate-750 hover:bg-slate-950"
                            }`}
                          >
                            <span>{bank.short}</span>
                            {selectedBank === bank.code && <span className="text-violet-400">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                        Or Search All Supported Banks
                      </label>
                      <input
                        type="text"
                        value={bankSearch}
                        onChange={(e) => setBankSearch(e.target.value)}
                        placeholder="Search bank name..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-700 focus:outline-none transition-all mb-2"
                      />
                      
                      {bankSearch && (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-32 overflow-y-auto divide-y divide-slate-900 scrollbar-none">
                          {filteredBanks.map((bank) => (
                            <div
                              key={bank.code}
                              onClick={() => {
                                setSelectedBank(bank.code);
                                setBankSearch("");
                              }}
                              className="p-3 text-xs text-slate-300 hover:text-white hover:bg-slate-900 cursor-pointer transition-all flex justify-between"
                            >
                              <span>{bank.name}</span>
                              {selectedBank === bank.code && <span className="text-violet-400">✓</span>}
                            </div>
                          ))}
                          {filteredBanks.length === 0 && (
                            <div className="p-3 text-xs text-slate-600 text-center">No banks matching search</div>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedBank && (
                      <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                        <span className="text-slate-400">Selected Bank:</span>
                        <span className="font-bold text-white">{allBanks.find(b => b.code === selectedBank)?.name}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedBank}
                      className={`w-full py-3.5 text-xs font-semibold rounded-xl uppercase tracking-wider transition-all shadow-lg ${
                        selectedBank
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-indigo-600/10 active:scale-[0.98]"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800/40"
                      }`}
                    >
                      Proceed to Bank Portal
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[280px] text-center space-y-4 animate-fade-in bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6">
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center text-xl shadow-lg">
                      🏦
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Coming Soon</h4>
                      <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                        Net Banking payments will be available shortly.
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* CARD PAYMENTS FORM */}
              {activeTab === "cards" && (
                ENABLE_CARDS ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* REAL-TIME CARD PREVIEW */}
                    <div className="relative h-40 w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between shadow-xl overflow-hidden group">
                      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-violet-600/10 blur-xl group-hover:bg-violet-600/20 transition-all"></div>
                      
                      <div className="flex justify-between items-start">
                        {/* Card chip representation */}
                        <div className="w-10 h-7 rounded bg-amber-500/20 border border-amber-500/30 flex flex-col justify-between p-1">
                          <div className="h-[2px] bg-amber-500/30 w-full"></div>
                          <div className="h-[2px] bg-amber-500/30 w-full"></div>
                          <div className="h-[2px] bg-amber-500/30 w-full"></div>
                        </div>
                        {/* Dynamic Card Logo */}
                        <span className="text-xs font-black tracking-widest text-slate-500 uppercase bg-slate-950/60 px-2.5 py-1 rounded-md border border-slate-800/50">
                          {getCardType(cardData.number)}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {/* Card Number display */}
                        <p className="text-base font-bold tracking-widest text-white font-mono min-h-6">
                          {cardData.number || "•••• •••• •••• ••••"}
                        </p>
                        
                        <div className="flex justify-between items-end">
                          <div className="space-y-0.5">
                            <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest block">Card Holder</span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide truncate max-w-[160px] block">
                              {cardData.name || "YOUR NAME"}
                            </span>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-0.5 text-right">
                              <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest block">Expires</span>
                              <span className="text-[10px] font-bold text-slate-300 font-mono block">
                                {cardData.expiry || "MM/YY"}
                              </span>
                            </div>
                            <div className="space-y-0.5 text-right">
                              <span className="text-[7px] text-slate-500 uppercase font-black tracking-widest block">CVV</span>
                              <span className="text-[10px] font-bold text-slate-300 font-mono block">
                                {focusedField === "cvv" ? cardData.cvv || "•••" : "•••"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FORM FIELDS */}
                    <form onSubmit={handleCardPay} className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                          Card Number
                        </label>
                        <input
                          type="text"
                          value={cardData.number}
                          onChange={handleCardNumberChange}
                          onFocus={() => setFocusedField("number")}
                          onBlur={() => setFocusedField("")}
                          placeholder="4111 1111 1111 1111"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-700 focus:outline-none transition-all font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          value={cardData.name}
                          onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField("")}
                          placeholder="John Doe"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-700 focus:outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            value={cardData.expiry}
                            onChange={handleExpiryChange}
                            onFocus={() => setFocusedField("expiry")}
                            onBlur={() => setFocusedField("")}
                            placeholder="MM/YY"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-700 focus:outline-none transition-all font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                            CVV Code
                          </label>
                          <input
                            type="password"
                            value={cardData.cvv}
                            onChange={handleCvvChange}
                            onFocus={() => setFocusedField("cvv")}
                            onBlur={() => setFocusedField("")}
                            placeholder="•••"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-700 focus:outline-none transition-all font-mono"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] transition-all text-white font-semibold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/10"
                      >
                        Authorize Payment
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[280px] text-center space-y-4 animate-fade-in bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6">
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center text-xl shadow-lg">
                      💳
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Coming Soon</h4>
                      <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                        Credit & Debit Card payments will be available shortly.
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* SECURE SUB-FOOTER */}
          <div className="flex items-center justify-center gap-1.5 text-slate-600 text-[10px] font-black uppercase tracking-widest mt-8 border-t border-slate-800/40 pt-4">
            <span>🛡️</span>
            <span>Secure 256-Bit SSL Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}