import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Authenticated, Unauthenticated } from "convex/react";
import { Redirect } from "expo-router";

export default function TabLayout() {
    return (
        <>
            <Unauthenticated>
                <Redirect href="/sign-in" />
            </Unauthenticated>
            <Authenticated>
                <Tabs
                    screenOptions={{
                        headerShown: false,
                        tabBarActiveTintColor: "#1A1F71",
                        tabBarInactiveTintColor: "#9CA3AF",
                        tabBarStyle: { backgroundColor: "white", borderTopColor: "#F3F4F6", paddingBottom: 6, height: 60 },
                        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: "Dashboard",
                            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
                        }}
                    />
                    <Tabs.Screen
                        name="expenses"
                        options={{
                            title: "Expenses",
                            tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
                        }}
                    />
                    <Tabs.Screen
                        name="settings"
                        options={{
                            title: "Settings",
                            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
                        }}
                    />
                </Tabs>
            </Authenticated>
        </>
    );
}
