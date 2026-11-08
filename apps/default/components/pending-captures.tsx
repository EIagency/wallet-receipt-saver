import { useCallback, type ReactNode } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

interface PendingCapturesProps {
    children?: ReactNode;
    onCapturePress?: (capture: Doc<"capturedTransactions">) => void;
}

export function PendingCaptures({ children, onCapturePress }: PendingCapturesProps) {
    const { isAuthenticated } = useConvexAuth();
    const userId = useQuery(api.users.currentId, isAuthenticated ? {} : "skip");
    // The hook reads each response's .page and sends continueCursor as the next paginationOpts.cursor.
    const { results, status, loadMore } = usePaginatedQuery(
        api.capturedTransactions.listPending,
        userId && isAuthenticated ? { userId } : "skip",
        { initialNumItems: 20 },
    );
    const renderItem = useCallback(({ item }: { item: Doc<"capturedTransactions"> }) => (
        <TouchableOpacity accessibilityRole={onCapturePress ? "button" : undefined} disabled={!onCapturePress} onPress={() => onCapturePress?.(item)} style={styles.row}>
            <View style={styles.details}>
                <Text style={styles.merchant}>{item.merchant}</Text>
                <Text style={styles.date}>{new Date(item.occurredAt).toLocaleDateString()} · {item.source ?? "Wallet"} · Pending</Text>
            </View>
            <Text selectable style={styles.amount}>{formatAmount(item.amountMinor, item.currency)}</Text>
        </TouchableOpacity>
    ), [onCapturePress]);
    const handleLoadMore = useCallback(() => {
        if (status === "CanLoadMore") loadMore(20);
    }, [status, loadMore]);

    return (
        <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={captureKey}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            ListHeaderComponent={
                <View>
                    {children}
                    <Text style={styles.heading}>Pending captures</Text>
                </View>
            }
            ListEmptyComponent={
                <View style={styles.empty}>
                    {isAuthenticated && status === "LoadingFirstPage" ? (
                        <><ActivityIndicator /><Text style={styles.emptyText}>Loading captures…</Text></>
                    ) : (
                        <>
                            <Ionicons name="wallet-outline" size={28} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{isAuthenticated ? "No captures yet. Tap a terminal with Google Wallet after registering." : "Sign in to view your pending captures."}</Text>
                        </>
                    )}
                </View>
            }
            ListFooterComponent={
                status === "CanLoadMore" || status === "LoadingMore" ? (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: status === "LoadingMore", busy: status === "LoadingMore" }}
                        disabled={status === "LoadingMore"}
                        onPress={handleLoadMore}
                        style={styles.loadMore}
                    >
                        {status === "LoadingMore" && <ActivityIndicator />}
                        <Text style={styles.link}>{status === "LoadingMore" ? "Loading…" : "Load more"}</Text>
                    </TouchableOpacity>
                ) : null
            }
        />
    );
}

function captureKey(item: Doc<"capturedTransactions">): string {
    return item._id;
}

function formatAmount(amountMinor: number, currency: string): string {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amountMinor / 10 ** fractionDigits);
}

const styles = StyleSheet.create({
    content: { paddingBottom: 24 },
    heading: { paddingHorizontal: 20, paddingBottom: 10, fontSize: 12, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase" },
    row: { marginHorizontal: 20, padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center", gap: 12 },
    details: { flex: 1, gap: 4 },
    merchant: { fontSize: 15, fontWeight: "600", color: "#111827" },
    date: { fontSize: 12, color: "#6B7280" },
    amount: { fontSize: 15, fontWeight: "600", color: "#111827", fontVariant: ["tabular-nums"] },
    empty: { marginHorizontal: 20, padding: 24, backgroundColor: "#FFFFFF", borderRadius: 16, borderCurve: "continuous", alignItems: "center", gap: 12 },
    emptyText: { textAlign: "center", fontSize: 14, lineHeight: 20, color: "#6B7280" },
    loadMore: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    link: { fontSize: 14, fontWeight: "600", color: "#1A1F71" },
});
