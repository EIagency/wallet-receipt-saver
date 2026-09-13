import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
    const { isLoading, isAuthenticated } = useConvexAuth();
    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1A1F71" />
            </View>
        );
    }
    return <Redirect href={isAuthenticated ? "/(tabs)" : "/sign-in"} />;
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
});
