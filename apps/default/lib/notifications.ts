import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export interface ParsedTransaction {
    amountCents: number;
    merchant: string;
    cardLast4?: string;
    currency: string;
}

export function parseVisaNotification(title: string, body: string): ParsedTransaction | null {
    // Match patterns like: "$25.99", "USD 25.99", "25.99 USD"
    const amountMatch = body.match(/\$([\d,]+\.?\d{0,2})|([\d,]+\.?\d{0,2})\s*USD|USD\s*([\d,]+\.?\d{0,2})/);
    if (!amountMatch) return null;
    const rawAmount = (amountMatch[1] || amountMatch[2] || amountMatch[3]).replace(/,/g, "");
    const amountCents = Math.round(parseFloat(rawAmount) * 100);
    if (isNaN(amountCents)) return null;

    // Match card last 4 digits
    const cardMatch = body.match(/(?:card|ending|x{1,4})(\d{4})/i) || body.match(/(\d{4})(?:\s|$)/);
    const cardLast4 = cardMatch?.[1];

    // Extract merchant — text between "at" and amount or end
    const merchantMatch = body.match(/(?:at|@|from)\s+([A-Za-z0-9 &'.-]+?)(?:\s+for|\s*\$|\s*USD|\.|$)/i);
    const merchant = merchantMatch?.[1]?.trim() || title || "Unknown Merchant";

    return { amountCents, merchant, cardLast4, currency: "USD" };
}

export async function registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === "web") return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
}

export function setupNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

// Demo transaction for simulating a Visa notification
export const DEMO_VISA_TRANSACTION: ParsedTransaction = {
    amountCents: 4799,
    merchant: "Starbucks Coffee",
    cardLast4: "4242",
    currency: "USD",
};
