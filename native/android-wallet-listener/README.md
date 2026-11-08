# Android Wallet notification listener (custom build only)

## Status
Native source is prepared, not compiled or device-tested. It is **not available in Bloom's shared Android runtime, web, or iOS**. Installing an npm notification-listener package does not change that. The previous unsupported packages and misleading active-listener UI have been removed.

The service uses Android's own `NotificationListenerService`, so no third-party React Native listener package is needed. It only observes Google Wallet (`com.google.android.apps.walletnfcrel`), ignores notification group summaries, parses unambiguous USD purchases, and posts a private, tap-to-review notification. No expense is saved until the user reviews and saves the form. Unknown merchants are left blank for manual input. Unsupported formats, multiple amounts, refunds, and declined transactions are skipped rather than guessed.

## Custom Android integration contract

For an independently maintained Android build, include `WalletNotificationListenerService.kt` in the Android application source set under `com/cardtrack/listener/`. It requires Kotlin and Android API 26+; no additional native library dependency is required. This folder is intentionally outside Expo Router and is not an active Bloom config plugin.

Merge the following into that build's Android manifest (permission outside `<application>`, service inside it):

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<service
    android:name="com.cardtrack.listener.WalletNotificationListenerService"
    android:label="CardTrack Wallet purchases"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

Set the custom Expo build's `scheme` to `cardtrack` and `extra.cardTrackNativeListener` to `true`. Its main activity must accept `ACTION_VIEW`, `CATEGORY_DEFAULT`, and `CATEGORY_BROWSABLE` for `cardtrack://add-expense` (Expo scheme configuration supplies this). `app/+native-intent.tsx` forwards **only** that route when the opt-in extra is true; it continues to ignore external URLs in Bloom. Do not set the flag in the shared Bloom app.

## Explicit consent and permissions

- Explain that Android notification access can expose sensitive notifications. Obtain informed user consent before opening `android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`.
- The user must manually enable CardTrack under Android **Notification access**. This is separate from normal notification permissions.
- Request `POST_NOTIFICATIONS` on Android 13+ through the custom app's normal permission flow. The existing `expo-notifications` permissions API is suitable. On all versions the app's Expense suggestions channel must remain enabled.
- Revoking notification access stops capture. If posting permission/channel is disabled, the service skips the suggestion; it does not retain a hidden transaction queue.

## Behavior and privacy

Android binds this native service independently of the React runtime; it does not require a JavaScript headless task. Force-stop, revoked permissions, and OEM battery restrictions may prevent delivery; this is not a guaranteed financial transaction feed. There is no historical backfill or processing of active notifications on reconnect.

Android restricts background activity launches. The supported path is **Wallet notification → CardTrack suggestion → user tap → prefilled expense form**. No attempt is made to bypass background launch restrictions. Detection deduplicates repeated notification contents using a bounded set of 128 SHA-256 hashes; it stores no raw notification text. Review links contain purchase fields and should not be logged or forwarded. App uninstall clears the deduplication state.

## Verification on the custom build

1. Sign in to CardTrack, enable both permission types, then send an actual Wallet purchase notification matching the supported English/USD format.
2. Confirm a CardTrack suggestion appears while the app is foregrounded and backgrounded. Tap it and verify amount, merchant (or blank if not recognized), and card suffix before saving.
3. Update the same Wallet notification without changing its text; confirm it does not create another suggestion.
4. Confirm a non-Wallet notification, refund, declined payment, and ambiguous multi-amount message are ignored.
5. Revoke notification access and confirm capture stops. Re-enable it to resume future notifications.
6. Deny normal notification permission or disable the channel and confirm the service does not crash or claim successful delivery.
7. Test signed-out cold start, sign in first if necessary, and reopen the suggestion; suggestions are not persisted as backend drafts and never bypass backend auth.

Kotlin compilation, Android service binding, notification formats, and link dispatch require verification in that custom runtime; Bloom preview cannot prove them.
