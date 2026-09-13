import { Platform } from "react-native";
import { getCategoryInfo, formatCents, formatDate } from "./categories";
import type { Doc } from "@/convex/_generated/dataModel";

type Expense = Doc<"expenses">;

function buildHtml(expenses: Expense[]): string {
  const rows = expenses
    .map((e) => {
      const cat = getCategoryInfo(e.category);
      return `<tr>
        <td>${formatDate(e.date)}</td>
        <td>${cat.label}</td>
        <td>${e.merchant}</td>
        <td style="text-align:right">${formatCents(e.amountCents)}</td>
        <td>${e.notes ?? ""}</td>
      </tr>`;
    })
    .join("");

  const total = expenses.reduce((s, e) => s + e.amountCents, 0);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, sans-serif; padding: 24px; color: #111; }
    h1 { color: #1a56f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1a56f0; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    .total { font-weight: bold; text-align: right; margin-top: 16px; font-size: 18px; }
    .visa-badge { background: #1a56f0; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; display: inline-block; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="visa-badge">VISA Card Report</div>
  <h1>Expense Receipt</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Merchant</th><th>Amount</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${formatCents(total)}</div>
</body>
</html>`;
}

export async function exportReceiptPDF(expenses: Expense[]): Promise<void> {
  if (Platform.OS === "web") {
    const html = buildHtml(expenses);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    return;
  }

  try {
    // Dynamic import so the web bundle never tries to resolve these native modules
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");

    const html = buildHtml(expenses);
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (err) {
    console.error("PDF export failed", err);
    throw err;
  }
}
