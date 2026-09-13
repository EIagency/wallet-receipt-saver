export interface Category {
    key: string;
    label: string;
    icon: string;
    color: string;
    keywords: string[];
}

export const CATEGORIES: Category[] = [
    {
        key: "groceries",
        label: "Groceries",
        icon: "cart",
        color: "#22C55E",
        keywords: ["walmart", "kroger", "safeway", "whole foods", "trader joe", "costco", "aldi", "publix", "grocery", "market", "supermarket"],
    },
    {
        key: "dining",
        label: "Dining",
        icon: "restaurant",
        color: "#F97316",
        keywords: ["starbucks", "mcdonald", "chipotle", "subway", "pizza", "burger", "taco", "cafe", "coffee", "restaurant", "kitchen", "grill", "diner", "sushi", "doordash", "ubereats", "grubhub"],
    },
    {
        key: "transport",
        label: "Transport",
        icon: "car",
        color: "#3B82F6",
        keywords: ["uber", "lyft", "shell", "chevron", "bp", "exxon", "gas", "fuel", "parking", "transit", "metro", "train", "airline", "delta", "united", "american airlines"],
    },
    {
        key: "shopping",
        label: "Shopping",
        icon: "bag",
        color: "#A855F7",
        keywords: ["amazon", "target", "best buy", "apple", "nike", "zara", "h&m", "nordstrom", "macy", "ebay", "etsy", "shop", "store", "mall"],
    },
    {
        key: "health",
        label: "Health",
        icon: "heart",
        color: "#EF4444",
        keywords: ["cvs", "walgreens", "pharmacy", "clinic", "hospital", "doctor", "dental", "gym", "fitness", "health", "medical"],
    },
    {
        key: "entertainment",
        label: "Entertainment",
        icon: "film",
        color: "#EC4899",
        keywords: ["netflix", "spotify", "hulu", "disney", "cinema", "movie", "theater", "concert", "ticketmaster", "steam", "playstation", "xbox", "nintendo"],
    },
    {
        key: "utilities",
        label: "Utilities",
        icon: "flash",
        color: "#EAB308",
        keywords: ["electric", "water", "gas bill", "internet", "comcast", "verizon", "at&t", "t-mobile", "insurance", "utility"],
    },
    {
        key: "other",
        label: "Other",
        icon: "ellipsis-horizontal",
        color: "#6B7280",
        keywords: [],
    },
];

export function detectCategory(merchant: string): string {
    const lower = merchant.toLowerCase();
    for (const cat of CATEGORIES) {
        if (cat.key === "other") continue;
        if (cat.keywords.some((kw) => lower.includes(kw))) return cat.key;
    }
    return "other";
}

export function getCategoryInfo(key: string): Category {
    return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function formatCents(cents: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatDate(ts: number): string {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ts));
}

export function formatDateShort(ts: number): string {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(ts));
}

export function getMonthRange(year: number, month: number): { startDate: number; endDate: number } {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { startDate: start.getTime(), endDate: end.getTime() };
}
