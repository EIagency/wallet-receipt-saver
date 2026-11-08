import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, formatCents } from "@/lib/categories";

export { ErrorBoundary } from "expo-router";

export default function CategorizeCaptureScreen() {
    const { captureId } = useLocalSearchParams<{ captureId?: string }>();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const capture = useQuery(api.capturedTransactions.get, isAuthenticated && captureId ? { captureId } : "skip");
    const categorize = useMutation(api.capturedTransactions.categorize);
    const [category, setCategory] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    async function save() {
        if (!capture || !category || isSaving) return;
        setIsSaving(true);
        setError("");
        try {
            await categorize({ captureId: capture._id, category });
            router.back();
        } catch (failure: unknown) {
            setError(failure instanceof ConvexError && typeof failure.data === "string" ? failure.data : "Could not save the category. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) return <ActivityIndicator style={styles.loading} />;
    if (!isAuthenticated) return <Redirect href="/sign-in" />;
    if (!captureId || capture === null) return <View style={styles.empty}><Ionicons name="wallet-outline" size={32} /><Text>Capture not found.</Text></View>;
    if (capture === undefined) return <ActivityIndicator style={styles.loading} />;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
            <View style={styles.card}>
                <Text style={styles.source}>{capture.source ?? "Wallet"} · {capture.status === "pending" ? "Pending" : "Categorized"}</Text>
                <Text style={styles.merchant}>{capture.merchant}</Text>
                <Text selectable style={styles.amount}>{formatCents(capture.amountMinor, capture.currency)}</Text>
                <Text style={styles.source}>{new Date(capture.occurredAt).toLocaleString()}</Text>
            </View>
            {capture.status === "categorized" ? <Text style={styles.success}>Already categorized. This capture is saved in Expenses.</Text> : (
                <>
                    <Text style={styles.heading}>Choose a category</Text>
                    <View style={styles.categories}>
                        {CATEGORIES.map((item) => (
                            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: category === item.key, disabled: isSaving }} disabled={isSaving} key={item.key} onPress={() => setCategory(item.key)} style={[styles.chip, category === item.key && styles.selected]}>
                                <Text style={[styles.chipText, category === item.key && styles.selectedText]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
                    <TouchableOpacity accessibilityRole="button" disabled={!category || isSaving} onPress={() => { void save(); }} style={[styles.button, (!category || isSaving) && styles.disabled]}>
                        <Text style={styles.buttonText}>{isSaving ? "Saving…" : "Save Expense"}</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loading: { flex: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    content: { padding: 20, gap: 20 },
    card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderCurve: "continuous", padding: 20, gap: 10 },
    source: { fontSize: 14, color: "#6B7280" },
    merchant: { fontSize: 24, fontWeight: "700", color: "#111827" },
    amount: { fontSize: 36, fontWeight: "800", fontVariant: ["tabular-nums"], color: "#111827" },
    heading: { fontSize: 18, fontWeight: "600", color: "#111827" },
    categories: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
    selected: { borderColor: "#1A1F71", backgroundColor: "#1A1F71" },
    chipText: { fontSize: 14, color: "#374151" },
    selectedText: { color: "#FFFFFF" },
    button: { minHeight: 50, backgroundColor: "#1A1F71", borderRadius: 14, alignItems: "center", justifyContent: "center" },
    disabled: { opacity: 0.5 },
    buttonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
    error: { fontSize: 14, color: "#B91C1C" },
    success: { fontSize: 16, color: "#15803D" },
});
