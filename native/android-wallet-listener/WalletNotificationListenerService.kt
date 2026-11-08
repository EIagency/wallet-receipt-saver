package com.cardtrack.listener

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.math.BigDecimal
import java.math.RoundingMode
import java.security.MessageDigest

/** Standalone Android-only source. Not bundled into the Bloom mobile runtime. */
class WalletNotificationListenerService : NotificationListenerService() {
    private val walletPackages = setOf("com.google.android.apps.walletnfcrel")
    private val amountPattern = Regex(
        "(?:\\$|USD\\s*)([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)(?![0-9.])|" +
            "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)\\s*USD\\b",
        RegexOption.IGNORE_CASE
    )
    private val purchasePattern = Regex("\\b(paid|payment|purchase|spent|charged|transaction)\\b", RegexOption.IGNORE_CASE)
    private val excludedPattern = Regex("\\b(refund|refunded|declined|reversed|failed|received|request|verification)\\b", RegexOption.IGNORE_CASE)
    private val merchantPattern = Regex(
        "(?:\\bat\\s+|@\\s*)(.+?)(?=\\s+(?:for|using|with|on|USD)\\b|\\s*\\$|[\\n]|$)",
        RegexOption.IGNORE_CASE
    )
    private val cardPattern = Regex("(?:ending(?:\\s+in)?|card|[x*•]{2,})\\s*(?:in\\s*)?([0-9]{4})\\b", RegexOption.IGNORE_CASE)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in walletPackages) return
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?.takeIf { it.isNotBlank() }
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val text = "$title\n$body"
        if (!purchasePattern.containsMatchIn(text) || excludedPattern.containsMatchIn(text)) return
        val matches = amountPattern.findAll(text).toList()
        // Ambiguous totals are intentionally not guessed. This version supports USD only.
        if (matches.size != 1) return
        val amount = matches.single().let { it.groupValues[1].ifBlank { it.groupValues[2] } }
        val cents = try {
            BigDecimal(amount.replace(",", "")).multiply(BigDecimal(100))
                .setScale(0, RoundingMode.UNNECESSARY).longValueExact()
        } catch (_: ArithmeticException) {
            return
        } catch (_: NumberFormatException) {
            return
        }
        if (cents <= 0 || cents > 9007199254740991L) return
        val merchant = merchantPattern.find(text)?.groupValues?.get(1)?.trim()
            ?.take(160).orEmpty()
        val cardLast4 = cardPattern.find(text)?.groupValues?.get(1).orEmpty()
        val fingerprint = MessageDigest.getInstance("SHA-256")
            .digest("${sbn.key}\n$text".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        val preferences = getSharedPreferences("wallet_listener", MODE_PRIVATE)
        val seen = preferences.getStringSet("seen", emptySet()).orEmpty()
        if (fingerprint in seen) return

        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (!manager.areNotificationsEnabled()) return
        manager.createNotificationChannel(NotificationChannel(
            CHANNEL, "Expense suggestions", NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = "Tap to review a detected Google Wallet purchase" })
        if (manager.getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) return

        val uri = Uri.Builder().scheme("cardtrack").authority("add-expense")
            .appendQueryParameter("amountCents", cents.toString())
            .appendQueryParameter("merchant", merchant)
            .appendQueryParameter("cardLast4", cardLast4)
            .appendQueryParameter("fromNotification", "true")
            .build()
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage(packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, fingerprint.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle("Review Wallet expense")
            .setContentText("Tap to open CardTrack and confirm the purchase")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setCategory(Notification.CATEGORY_RECOMMENDATION)
            .build()
        try {
            manager.notify(fingerprint, 1, notification)
            // Only hashes are persisted, never notification bodies or card details.
            preferences.edit().putStringSet("seen", (seen.takeLastBounded(127) + fingerprint).toSet()).apply()
        } catch (_: SecurityException) {
            // Permission may be revoked between the check and notify().
        }
    }

    private fun Set<String>.takeLastBounded(limit: Int): List<String> = toList().takeLast(limit)

    companion object {
        private const val CHANNEL = "cardtrack_wallet_expenses"
    }
}
