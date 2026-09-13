import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DEMO_VISA_TRANSACTION } from "@/lib/notifications";

export default function SettingsScreen() {
    const { signOut } = useAuthActions();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    function simulateVisa() {
        const t = DEMO_VISA_TRANSACTION;
        router.push({
            pathname: "/add-expense",
            params: {
                amountCents: String(t.amountCents),
                merchant: t.merchant,
                cardLast4: t.cardLast4 ?? "",
                fromNotification: "true",
            },
        });
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.title}>Settings</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Visa Card</Text>
                    <TouchableOpacity style={styles.row} onPress={simulateVisa}>
                        <View style={[styles.iconWrap, { backgroundColor: "#EEF2FF" }]}>
                            <Ionicons name="card" size={20} color="#1A1F71" />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Simulate Visa Notification</Text>
                            <Text style={styles.rowSub}>Test the auto-fill expense flow</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Receipts</Text>
                    <View style={styles.infoCard}>
                        <Ionicons name="document-text" size={20} color="#1A1F71" />
                        <Text style={styles.infoText}>
                            Tap the receipt icon on any expense to generate a PDF Google Wallet-style receipt and share it.
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Account</Text>
                    <TouchableOpacity style={styles.row} onPress={() => signOut()}>
                        <View style={[styles.iconWrap, { backgroundColor: "#FEF2F2" }]}>
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                        </View>
                        <Text style={[styles.rowTitle, { color: "#EF4444" }]}>Sign Out</Text>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    title: { fontSize: 24, fontWeight: "800", color: "#111827", paddingHorizontal: 20, paddingVertical: 16 },
    section: { marginBottom: 24, paddingHorizontal: 20 },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", padding: 14, borderRadius: 16 },
    iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
    rowSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
    infoCard: { flexDirection: "row", gap: 12, backgroundColor: "#EEF2FF", padding: 16, borderRadius: 16, alignItems: "flex-start" },
    infoText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
});
