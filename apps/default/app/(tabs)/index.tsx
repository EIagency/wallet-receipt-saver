import { useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatCents, formatDateShort, getCategoryInfo, getMonthRange } from "@/lib/categories";
import { DEMO_VISA_TRANSACTION } from "@/lib/notifications";
import { useWalletListener } from "@/lib/useWalletListener";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function DashboardScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());

    // Real Google Wallet listener (Android) — auto-navigates on detection
    const { hasPermission, lastTransaction, requestPermission } = useWalletListener();

    const { startDate, endDate } = getMonthRange(year, month);
    const stats = useQuery(api.expenses.statsByCategory, { startDate, endDate });
    const expenses = useQuery(api.expenses.listByDateRange, { startDate, endDate });

    const totalCents = stats?.reduce((s, c) => s + c.totalCents, 0) ?? 0;
    const recent = expenses?.slice(0, 5) ?? [];

    function prevMonth() {
        if (month === 0) { setMonth(11); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    }
    function nextMonth() {
        const n = new Date(); if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth())) return;
        if (month === 11) { setMonth(0); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    }

    function handleSimulateVisa() {
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
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>CardTrack</Text>
                        <Text style={styles.subGreeting}>Your spending overview</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-expense")}>
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Month Selector */}
                <View style={styles.monthRow}>
                    <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-back" size={20} color="#374151" />
                    </TouchableOpacity>
                    <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
                    <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-forward" size={20} color="#374151" />
                    </TouchableOpacity>
                </View>

                {/* Notification Listener Banner */}
                {Platform.OS === "android" ? (
                    hasPermission ? (
                        <View style={styles.listenerActive}>
                            <View style={styles.listenerDot} />
                            <View style={styles.listenerText}>
                                <Text style={styles.listenerTitle}>Google Wallet Listener Active</Text>
                                <Text style={styles.listenerSub}>
                                    {lastTransaction
                                        ? `Last: ${lastTransaction.merchant} · ${formatCents(lastTransaction.amountCents)}`
                                        : "Waiting for Google Wallet notifications…"}
                                </Text>
                            </View>
                            <Ionicons name="wifi" size={16} color="#059669" />
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.permissionBanner} onPress={requestPermission}>
                            <View style={styles.permissionIcon}>
                                <Ionicons name="notifications-off-outline" size={20} color="#DC2626" />
                            </View>
                            <View style={styles.permissionText}>
                                <Text style={styles.permissionTitle}>Enable Notification Access</Text>
                                <Text style={styles.permissionSub}>Required to auto-detect Google Wallet transactions</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
                        </TouchableOpacity>
                    )
                ) : (
                    // iOS / Web: show simulate button
                    <TouchableOpacity style={styles.visaBanner} onPress={handleSimulateVisa}>
                        <View style={styles.visaLogoSmall}>
                            <Ionicons name="card" size={18} color="white" />
                        </View>
                        <View style={styles.visaBannerText}>
                            <Text style={styles.visaBannerTitle}>Simulate Visa Alert</Text>
                            <Text style={styles.visaBannerSub}>Tap to log a test transaction</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#1A1F71" />
                    </TouchableOpacity>
                )}

                {/* Total Card */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total Spent</Text>
                    <Text style={styles.totalAmount}>{formatCents(totalCents)}</Text>
                    <Text style={styles.totalSub}>{expenses?.length ?? 0} transactions</Text>
                </View>

                {/* Category Breakdown */}
                <Text style={styles.sectionTitle}>By Category</Text>
                {stats === undefined ? (
                    <ActivityIndicator style={{ marginTop: 16 }} color="#1A1F71" />
                ) : stats.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="bar-chart-outline" size={32} color="#D1D5DB" />
                        <Text style={styles.emptyText}>No expenses this month</Text>
                    </View>
                ) : (
                    <View style={styles.categoryList}>
                        {stats.sort((a, b) => b.totalCents - a.totalCents).map((s) => {
                            const cat = getCategoryInfo(s.category);
                            const pct = totalCents > 0 ? s.totalCents / totalCents : 0;
                            return (
                                <View key={s.category} style={styles.catRow}>
                                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.catName}>{cat.label}</Text>
                                    <View style={styles.barTrack}>
                                        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: cat.color }]} />
                                    </View>
                                    <Text style={styles.catAmount}>{formatCents(s.totalCents)}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Recent Transactions */}
                {recent.length > 0 && (
                    <>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Recent</Text>
                            <TouchableOpacity onPress={() => router.push("/(tabs)/expenses")}>
                                <Text style={styles.seeAll}>See all</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.recentList}>
                            {recent.map((e) => {
                                const cat = getCategoryInfo(e.category);
                                return (
                                    <View key={e._id} style={styles.recentRow}>
                                        <View style={[styles.recentIcon, { backgroundColor: cat.color + "20" }]}>
                                            <Ionicons name={cat.icon as never} size={18} color={cat.color} />
                                        </View>
                                        <View style={styles.recentInfo}>
                                            <Text style={styles.recentMerchant} numberOfLines={1}>{e.merchant}</Text>
                                            <Text style={styles.recentDate}>{formatDateShort(e.date)}</Text>
                                        </View>
                                        <Text style={styles.recentAmount}>{formatCents(e.amountCents, e.currency)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}
                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
    greeting: { fontSize: 24, fontWeight: "800", color: "#111827", letterSpacing: -0.5 },
    subGreeting: { fontSize: 14, color: "#6B7280", marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#1A1F71", justifyContent: "center", alignItems: "center" },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 8 },
    monthArrow: { width: 36, height: 36, borderRadius: 10, backgroundColor: "white", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
    monthLabel: { fontSize: 16, fontWeight: "700", color: "#111827", minWidth: 100, textAlign: "center" },
    // Google Wallet listener active state
    listenerActive: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ECFDF5", marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#A7F3D0" },
    listenerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#059669" },
    listenerText: { flex: 1 },
    listenerTitle: { fontSize: 13, fontWeight: "700", color: "#065F46" },
    listenerSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
    // Permission prompt
    permissionBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF2F2", marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#FECACA" },
    permissionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" },
    permissionText: { flex: 1 },
    permissionTitle: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
    permissionSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
    // iOS simulate banner
    visaBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EEF2FF", marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE" },
    visaLogoSmall: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1A1F71", justifyContent: "center", alignItems: "center" },
    visaBannerText: { flex: 1 },
    visaBannerTitle: { fontSize: 14, fontWeight: "700", color: "#1A1F71" },
    visaBannerSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
    totalCard: { backgroundColor: "#1A1F71", margin: 20, padding: 24, borderRadius: 20 },
    totalLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
    totalAmount: { color: "white", fontSize: 42, fontWeight: "800", letterSpacing: -1, marginTop: 4 },
    totalSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827", paddingHorizontal: 20, marginBottom: 12 },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
    seeAll: { color: "#1A1F71", fontSize: 14, fontWeight: "600" },
    emptyBox: { alignItems: "center", padding: 32, gap: 8 },
    emptyText: { color: "#9CA3AF", fontSize: 15 },
    categoryList: { backgroundColor: "white", marginHorizontal: 20, borderRadius: 16, padding: 16, gap: 14 },
    catRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    catDot: { width: 10, height: 10, borderRadius: 5 },
    catName: { width: 80, fontSize: 13, color: "#374151", fontWeight: "500" },
    barTrack: { flex: 1, height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3 },
    catAmount: { width: 72, textAlign: "right", fontSize: 13, fontWeight: "600", color: "#111827" },
    recentList: { backgroundColor: "white", marginHorizontal: 20, borderRadius: 16, overflow: "hidden" },
    recentRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
    recentIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    recentInfo: { flex: 1 },
    recentMerchant: { fontSize: 15, fontWeight: "600", color: "#111827" },
    recentDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
    recentAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
});
