import { useState } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatCents, formatDateShort, getCategoryInfo, getMonthRange, CATEGORIES } from "@/lib/categories";
import { exportReceiptPDF } from "@/lib/pdf";
import type { Id } from "@/convex/_generated/dataModel";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ExpensesScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [filterCat, setFilterCat] = useState<string | null>(null);
    const remove = useMutation(api.expenses.remove);

    const { startDate, endDate } = getMonthRange(year, month);
    const expenses = useQuery(api.expenses.listByDateRange, { startDate, endDate });

    const filtered = filterCat ? (expenses ?? []).filter(e => e.category === filterCat) : (expenses ?? []);

    function prevMonth() {
        if (month === 0) { setMonth(11); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    }
    function nextMonth() {
        const n = new Date(); if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth())) return;
        if (month === 11) { setMonth(0); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    }

    async function handleDelete(id: Id<"expenses">, merchant: string) {
        Alert.alert("Delete Expense", `Remove "${merchant}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => { await remove({ id }); } },
        ]);
    }

    async function handleReceipt(e: typeof filtered[0]) {
        try {
            await exportReceiptPDF([e]);
        } catch {
            Alert.alert("Error", "Could not generate receipt");
        }
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Expenses</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-expense")}>
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.monthRow}>
                <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                    <Ionicons name="chevron-back" size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
                <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                    <Ionicons name="chevron-forward" size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            {/* Category filter chips */}
            <FlatList
                horizontal
                data={[{ key: null, label: "All" }, ...CATEGORIES.map(c => ({ key: c.key, label: c.label }))]}
                keyExtractor={item => item.key ?? "all"}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.chip, filterCat === item.key && styles.chipActive]}
                        onPress={() => setFilterCat(item.key)}
                    >
                        <Text style={[styles.chipText, filterCat === item.key && styles.chipTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                )}
            />

            <FlatList
                data={filtered}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>No expenses found</Text>
                    </View>
                }
                renderItem={({ item: e }) => {
                    const cat = getCategoryInfo(e.category);
                    return (
                        <View style={styles.expenseCard}>
                            <View style={[styles.catIcon, { backgroundColor: cat.color + "20" }]}>
                                <Ionicons name={cat.icon as never} size={20} color={cat.color} />
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.merchant} numberOfLines={1}>{e.merchant}</Text>
                                <Text style={styles.meta}>{cat.label} · {formatDateShort(e.date)}{e.cardLast4 ? ` · ••${e.cardLast4}` : ""}</Text>
                            </View>
                            <Text style={styles.amount}>{formatCents(e.amountCents, e.currency)}</Text>
                            <TouchableOpacity style={styles.receiptBtn} onPress={() => handleReceipt(e)}>
                                <Ionicons name="document-text-outline" size={20} color="#1A1F71" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(e._id, e.merchant)}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontSize: 24, fontWeight: "800", color: "#111827" },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#1A1F71", justifyContent: "center", alignItems: "center" },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 4 },
    monthArrow: { width: 36, height: 36, borderRadius: 10, backgroundColor: "white", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
    monthLabel: { fontSize: 16, fontWeight: "700", color: "#111827", minWidth: 100, textAlign: "center" },
    chips: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB" },
    chipActive: { backgroundColor: "#1A1F71", borderColor: "#1A1F71" },
    chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
    chipTextActive: { color: "white" },
    list: { paddingHorizontal: 20, gap: 10, paddingBottom: 32 },
    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyText: { color: "#9CA3AF", fontSize: 16 },
    expenseCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", padding: 14, borderRadius: 16 },
    catIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    info: { flex: 1 },
    merchant: { fontSize: 15, fontWeight: "600", color: "#111827" },
    meta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
    amount: { fontSize: 15, fontWeight: "700", color: "#111827" },
    receiptBtn: { padding: 4 },
});
