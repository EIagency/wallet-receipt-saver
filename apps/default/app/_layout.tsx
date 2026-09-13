import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { setupNotificationHandler } from "@/lib/notifications";
import { registerHeadlessWalletTask } from "@/lib/notificationListener";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
});

const secureStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
};

const isNative = Platform.OS === "ios" || Platform.OS === "android";

if (isNative) {
    setupNotificationHandler();
}

// Register background headless task so Google Wallet notifs are caught
// even when the app is fully closed (Android only)
registerHeadlessWalletTask((tx) => {
    // Background: log the transaction. The foreground useWalletListener hook
    // handles navigation when the app is open.
    console.log("[Headless] Google Wallet tx detected:", tx.merchant, tx.amountCents);
});

export default function RootLayout() {
    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                    name="add-expense"
                    options={{ presentation: "formSheet", headerShown: true, title: "Add Expense", headerTitleStyle: { fontWeight: "700" } }}
                />
            </Stack>
        </ConvexAuthProvider>
    );
}
