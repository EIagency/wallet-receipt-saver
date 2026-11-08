import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Doc } from "@/convex/_generated/dataModel";
import { PendingCaptures } from "@/components/pending-captures";

export default function PendingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const openCapture = useCallback((capture: Doc<"capturedTransactions">) => {
        router.push({ pathname: "/categorize-capture", params: { captureId: capture._id } });
    }, [router]);
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.title}>Pending</Text>
            <PendingCaptures onCapturePress={openCapture} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    title: { fontSize: 24, fontWeight: "800", color: "#111827", padding: 20 },
});
