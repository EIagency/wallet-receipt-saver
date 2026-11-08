import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useConvexAuth, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";

export function WalletDeveloperMode() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [error, setError] = useState("");
    const requestId = useRef<string | null>(null);
    const isBusy = useRef(false);
    const { isAuthenticated } = useConvexAuth();
    const simulate = useMutation(api.capturedTransactions.simulateWalletTap);
    const router = useRouter();

    async function simulateTap() {
        if (isBusy.current || !isAuthenticated) return;
        isBusy.current = true;
        setIsSimulating(true);
        setError("");
        try {
            requestId.current ??= Crypto.randomUUID();
            const captureId = await simulate({ requestId: requestId.current });
            requestId.current = null;
            router.push({ pathname: "/categorize-capture", params: { captureId } });
        } catch (failure: unknown) {
            setError(failure instanceof ConvexError && typeof failure.data === "string" ? failure.data : "Could not simulate Wallet tap. Please try again.");
        } finally {
            isBusy.current = false;
            setIsSimulating(false);
        }
    }

    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <Text style={styles.title}>Developer mode</Text>
                <Switch accessibilityLabel="Developer mode" value={isEnabled} onValueChange={setIsEnabled} disabled={isSimulating} />
            </View>
            {isEnabled && (
                <>
                    <Text style={styles.description}>Creates a test capture: Tesco · £12.45 · Pending · Wallet. Saving a category adds it to your expenses.</Text>
                    <TouchableOpacity accessibilityRole="button" onPress={() => { void simulateTap(); }} disabled={isSimulating || !isAuthenticated} style={styles.button}>
                        {isSimulating && <ActivityIndicator color="#FFFFFF" />}
                        <Text style={styles.buttonText}>{isSimulating ? "Simulating…" : "Simulate Google Wallet Tap"}</Text>
                    </TouchableOpacity>
                    {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: "#FFFFFF", padding: 16, gap: 12, borderRadius: 16, borderCurve: "continuous" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    title: { fontSize: 15, fontWeight: "600", color: "#111827" },
    description: { fontSize: 13, lineHeight: 20, color: "#6B7280" },
    button: { minHeight: 48, backgroundColor: "#1A1F71", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
    error: { fontSize: 14, color: "#B91C1C" },
});
