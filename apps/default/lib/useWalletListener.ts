/**
 * React hook that:
 * 1. Checks / requests NotificationListenerService permission
 * 2. Starts the Google Wallet listener
 * 3. Queues detected transactions and navigates to add-expense
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
    isPermissionGranted,
    openNotificationSettings,
    startWalletListener,
} from "./notificationListener";
import type { ParsedTransaction } from "./notifications";

export interface WalletListenerState {
    hasPermission: boolean;
    lastTransaction: ParsedTransaction | null;
    requestPermission: () => void;
}

export function useWalletListener(): WalletListenerState {
    const router = useRouter();
    const [hasPermission, setHasPermission] = useState(() => isPermissionGranted());
    const [lastTransaction, setLastTransaction] = useState<ParsedTransaction | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Re-check permission when app comes back to foreground
    // (user may have toggled Notification Access in settings)
    useEffect(() => {
        if (Platform.OS !== "android") return;

        const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
            if (state === "active") {
                const granted = isPermissionGranted();
                setHasPermission(granted);
            }
        });
        return () => sub.remove();
    }, []);

    // Start / restart listener whenever permission status changes
    useEffect(() => {
        if (!hasPermission) {
            cleanupRef.current?.();
            cleanupRef.current = null;
            return;
        }

        cleanupRef.current = startWalletListener((tx) => {
            setLastTransaction(tx);
            // Auto-navigate to the add-expense sheet with pre-filled data
            router.push({
                pathname: "/add-expense",
                params: {
                    amountCents: String(tx.amountCents),
                    merchant: tx.merchant,
                    cardLast4: tx.cardLast4 ?? "",
                    fromNotification: "true",
                },
            });
        });

        return () => {
            cleanupRef.current?.();
            cleanupRef.current = null;
        };
    }, [hasPermission]);

    const requestPermission = useCallback(() => {
        openNotificationSettings();
    }, []);

    return { hasPermission, lastTransaction, requestPermission };
}
