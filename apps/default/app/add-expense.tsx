import { useState, useEffect } from "react";
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORIES, detectCategory } from "@/lib/categories";

export default function AddExpenseScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        amountCents?: string;
        merchant?: string;
        cardLast4?: string;
        fromNotification?: string;
    }>();

    const addExpense = useMutation(api.expenses.add);

    const [amount, setAmount] = useState(
        params.amountCents ? (Number(params.amountCents) / 100).toFixed(2) : ""
    );
    const [merchant, setMerchant] = useState(params.merchant ?? "");
    const [cardLast4, setCardLast4] = useState(params.cardLast4 ?? "");
    const [notes, setNotes] = useState("");
    const [category, setCategory] = useState(() => detectCategory(params.merchant ?? ""));
    const [saving, setSaving] = useState(false);

    const fromNotification = params.fromNotification === "true";

    useEffect(() => {
        if (merchant) setCategory(detectCategory(merchant));
    }, [merchant]);

    async function handleSave() {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }
        if (!merchant.trim()) {
            Alert.alert("Merchant Required", "Please enter a merchant name.");
            return;
        }
        setSaving(true);
        try {
            await addExpense({
                amountCents: Math.round(amountNum * 100),
                merchant: merchant.trim(),
                category,
                date: Date.now(),
                currency: "USD",
                cardLast4: cardLast4.trim() || undefined,
                notes: notes.trim() || undefined,
            });
            router.back();
        } catch {
            Alert.alert("Error", "Failed to save expense.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {fromNotification && (
                    <View style={styles.notifBanner}>
                        <Ionicons name="card" size={16} color="#1A1F71" />
                        <Text style={styles.notifText}>Pre-filled from Visa notification</Text>
                    </View>
                )}

                <Text style={styles.label}>Amount (USD)</Text>
                <View style={styles.amountRow}>
                    <Text style={styles.currency}>$</Text>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        autoFocus={!fromNotification}
                    />
                </View>

                <Text style={styles.label}>Merchant</Text>
                <TextInput
                    style={styles.input}
                    value={merchant}
                    onChangeText={setMerchant}
                    placeholder="e.g. Starbucks"
                    placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.label}>Card (last 4 digits)</Text>
                <TextInput
                    style={styles.input}
                    value={cardLast4}
                    onChangeText={(t) => setCardLast4(t.slice(0, 4))}
                    placeholder="4242"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={4}
                />

                <Text style={styles.label}>Category</Text>
                <View style={styles.catGrid}>
                    {CATEGORIES.map((cat) => {
                        const active = category === cat.key;
                        return (
                            <TouchableOpacity
                                key={cat.key}
                                style={[
                                    styles.catChip,
                                    active && { backgroundColor: cat.color, borderColor: cat.color },
                                ]}
                                onPress={() => setCategory(cat.key)}
                            >
                                <Ionicons
                                    name={cat.icon as never}
                                    size={14}
                                    color={active ? "white" : cat.color}
                                />
                                <Text style={[styles.catChipText, active && { color: "white" }]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                    style={[styles.input, styles.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add a note…"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                />

                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Expense"}</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: "#F9FAFB" },
    container: { padding: 20, gap: 8, paddingBottom: 40 },
    notifBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF2FF", padding: 12, borderRadius: 12, marginBottom: 8 },
    notifText: { color: "#1A1F71", fontSize: 13, fontWeight: "600" },
    label: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginTop: 12, marginBottom: 4, letterSpacing: 0.3 },
    amountRow: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16 },
    currency: { fontSize: 28, fontWeight: "700", color: "#374151" },
    amountInput: { flex: 1, fontSize: 28, fontWeight: "700", color: "#111827", paddingVertical: 14 },
    input: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, fontSize: 16, color: "#111827" },
    notesInput: { minHeight: 80, textAlignVertical: "top" },
    catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "white" },
    catChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1A1F71", borderRadius: 16, padding: 18, marginTop: 24 },
    saveBtnText: { color: "white", fontSize: 17, fontWeight: "700" },
});
