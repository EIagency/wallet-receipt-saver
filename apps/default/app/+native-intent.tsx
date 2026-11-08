import Constants from "expo-constants";

interface SystemPathOptions {
    path: string;
    initial: boolean;
}

// Bloom owns external URL routing. Only independently built Android apps
// explicitly opting in may forward the native Wallet service's review link.
export async function redirectSystemPath({ path }: SystemPathOptions): Promise<string | null> {
    if (Constants.expoConfig?.extra?.cardTrackNativeListener !== true) return null;
    try {
        const url = new URL(path);
        if (url.protocol !== "cardtrack:" || url.hostname !== "add-expense" || (url.pathname !== "" && url.pathname !== "/")) return null;
        const centsText = url.searchParams.get("amountCents") ?? "";
        const cents = Number(centsText);
        if (!/^\d+$/.test(centsText) || !Number.isSafeInteger(cents) || cents <= 0) return null;
        const suffix = url.searchParams.get("cardLast4") ?? "";
        const params = new URLSearchParams({
            amountCents: String(cents),
            merchant: (url.searchParams.get("merchant") ?? "").slice(0, 160),
            cardLast4: /^\d{4}$/.test(suffix) ? suffix : "",
            fromNotification: "true",
        });
        return `/add-expense?${params.toString()}`;
    } catch {
        return null;
    }
}
