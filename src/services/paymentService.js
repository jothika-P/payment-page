// Use a relative path so requests always go to the current origin (e.g. localhost:5173) 
// and trigger the Vite proxy to localhost:8080. In production, use the env variable.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchSession(accessKey) {
  const response = await fetch(`${API_BASE_URL}/api/payment/session/${accessKey}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Session fetch failed with status ${response.status}`);
  }

  return await response.json();
}
// export async function fetchSession(accessKey) {
//   const response = await fetch(`${API_BASE_URL}/api/payment/session/${accessKey}`, {
//     method: "GET",
//     headers: {
//       "Accept": "application/json",
//       "Content-Type": "application/json"
//     }
//   });

//   if (!response.ok) {
//     throw new Error(`Session fetch failed with status ${response.status}`);
//   }

//   return await response.json();
// }

export async function processPayment(payload) {
  const response = await fetch(`${API_BASE_URL}/api/payment/pay`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      access_key: payload.access_key,
      payment_mode: payload.payment_mode,
      upi_id: payload.upi_id || null,
      bank_code: payload.bank_code || null,
      card_number: payload.card_number || null,
      card_holder_name: payload.card_holder_name || null,
      card_cvv: payload.card_cvv || null,
      card_expiry_date: payload.card_expiry || null
    })
  });

  if (!response.ok) {
    throw new Error(`Payment processing failed with status ${response.status}`);
  }

  return await response.json();
}
