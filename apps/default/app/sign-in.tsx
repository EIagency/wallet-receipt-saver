import { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";
import { Ionicons } from "@expo/vector-icons";

export default function SignInScreen() {
    const { signIn } = useAuthActions();
    const { signInWith, isLoading: oauthLoading } = useOAuthSignIn();
    const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleEmailAuth() {
        if (!email || !password) return;
        setLoading(true);
        try {
            await signIn("password", { email, password, flow });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Authentication failed";
            Alert.alert("Error", msg);
        } finally {
            setLoading(false);
        }
    }

    async function handleAnonymous() {
        setLoading(true);
        try {
            await signIn("anonymous");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed";
            Alert.alert("Error", msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <View style={styles.logoWrap}>
                        <Ionicons name="card" size={36} color="white" />
                    </View>
                    <Text style={styles.title}>CardTrack</Text>
                    <Text style={styles.subtitle}>Smart expense tracking for your Visa</Text>
                </View>

                <TouchableOpacity
                    style={styles.googleBtn}
                    onPress={() => signInWith("google")}
                    disabled={oauthLoading}
                >
                    <Ionicons name="logo-google" size={20} color="#111" />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <View style={styles.inputGroup}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailAuth} disabled={loading}>
                    <Text style={styles.primaryBtnText}>{flow === "signIn" ? "Sign In" : "Create Account"}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
                    <Text style={styles.toggleText}>
                        {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
                        <Text style={styles.toggleLink}>{flow === "signIn" ? "Sign Up" : "Sign In"}</Text>
                    </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.anonBtn} onPress={handleAnonymous} disabled={loading}>
                    <Text style={styles.anonBtnText}>Continue as Guest</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: "#F9FAFB" },
    container: { flexGrow: 1, padding: 28, paddingTop: 80 },
    header: { alignItems: "center", marginBottom: 40 },
    logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: "#1A1F71", justifyContent: "center", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 28, fontWeight: "800", color: "#111827", letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: "#6B7280", marginTop: 6 },
    googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "white", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
    googleBtnText: { fontSize: 16, fontWeight: "600", color: "#111827" },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
    dividerText: { color: "#9CA3AF", fontSize: 14 },
    inputGroup: { gap: 12, marginBottom: 16 },
    input: { backgroundColor: "white", borderRadius: 14, padding: 16, fontSize: 16, color: "#111827", borderWidth: 1, borderColor: "#E5E7EB" },
    primaryBtn: { backgroundColor: "#1A1F71", borderRadius: 14, padding: 17, alignItems: "center", marginBottom: 16 },
    primaryBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
    toggleText: { textAlign: "center", color: "#6B7280", fontSize: 14, marginBottom: 20 },
    toggleLink: { color: "#1A1F71", fontWeight: "600" },
    anonBtn: { backgroundColor: "#F3F4F6", borderRadius: 14, padding: 17, alignItems: "center" },
    anonBtnText: { color: "#374151", fontSize: 16, fontWeight: "600" },
});
