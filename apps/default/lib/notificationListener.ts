/**
 * Google Wallet / Visa notification listener service.
 * Uses expo-notification-listener (Android NotificationListenerService).
 * Falls back gracefully on iOS/Web.
 */
import { Platform } from "react-native";
import type { ExpoNotification } from "expo-notification-listener";
import { parseVisaNotification, type ParsedTransaction } from "./notifications";

// Known Google Wallet / Visa package names
const WALLET_PACKAGES = [
    "com.google.android.apps.walletnfcrel", // Google Wallet
    "com.google.android.gms",               // Google Play Services (some wallet notifs)
    "com.visa.app",                          // Visa
    "com.incomm.vii",                        // Visa prepaid
];

// Also catch by app name keywords
const WALLET_APP_KEYWORDS = ["wallet", "visa", "google pay", "gpay"];

export function isGoogleWalletNotification(notification: ExpoNotification): boolean {
    const pkgMatch = WALLET_PACKAGES.includes(notification.packageName);
    const nameMatch = WALLET_APP_KEYWORDS.some((kw) =>
        notification.appName?.toLowerCase().includes(kw)
    );
    return pkgMatch || nameMatch;
}

export type TransactionCallback = (tx: ParsedTransaction, raw: ExpoNotification) => void;

let _subscription: { remove: () => void } | null = null;
let _permissionGranted = false;

/**
 * Check if NotificationListenerService permission is granted.
 */
export function isPermissionGranted(): boolean {
    if (Platform.OS !== "android") return false;
    try {
        const mod = require("expo-notification-listener");
        _permissionGranted = mod.isPermissionGranted();
        return _permissionGranted;
    } catch {
        return false;
    }
}

/**
 * Open system settings so user can grant Notification Access.
 */
export function openNotificationSettings(): void {
    if (Platform.OS !== "android") return;
    try {
        const mod = require("expo-notification-listener");
        mod.openNotificationSettings();
    } catch {}
}

/**
 * Start listening for Google Wallet / Visa notifications.
 * Calls `onTransaction` whenever a matching notification is detected.
 * Returns a cleanup function.
 */
export function startWalletListener(onTransaction: TransactionCallback): () => void {
    if (Platform.OS !== "android") return () => {};

    try {
        const mod = require("expo-notification-listener");

        if (!mod.isPermissionGranted()) {
            console.log("[WalletListener] No notification access permission.");
            return () => {};
        }

        // Remove any existing subscription
        _subscription?.remove();

        _subscription = mod.addNotificationPostedListener((notification: ExpoNotification) => {
            if (!isGoogleWalletNotification(notification)) return;

            const title = notification.title ?? "";
            const body = notification.bigText ?? notification.text ?? "";

            const tx = parseVisaNotification(title, body);
            if (tx) {
                console.log("[WalletListener] Transaction detected:", tx);
                onTransaction(tx, notification);
            }
        });

        console.log("[WalletListener] Listening for Google Wallet notifications.");
        return () => {
            _subscription?.remove();
            _subscription = null;
        };
    } catch (e) {
        console.warn("[WalletListener] expo-notification-listener not available:", e);
        return () => {};
    }
}

/**
 * Register a headless background task so the listener fires even when the app is closed.
 * Call this from index.js (entry point), OUTSIDE of any component.
 */
export function registerHeadlessWalletTask(onTransaction: TransactionCallback): void {
    if (Platform.OS !== "android") return;
    try {
        const mod = require("expo-notification-listener");
        mod.registerHeadlessListener(async (event: ExpoNotification & { eventName: string }) => {
            if (event.eventName !== "notificationReceived") return;
            if (!isGoogleWalletNotification(event)) return;

            const title = event.title ?? "";
            const body = event.bigText ?? event.text ?? "";
            const tx = parseVisaNotification(title, body);
            if (tx) {
                onTransaction(tx, event);
            }
        });
    } catch {}
}
