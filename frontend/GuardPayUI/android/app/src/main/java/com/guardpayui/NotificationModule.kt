package com.guardpayui

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * GuardPay AI — real local notifications for risk/security alerts.
 *
 * The Permissions screen requests POST_NOTIFICATIONS so this channel can post
 * (see AndroidManifest.xml + PermissionsScreen.tsx). This module is the other
 * half: it actually shows a notification through Android's NotificationManager
 * rather than just holding the permission unused. `notify()` is a no-op (and
 * tells the caller so) when the permission has not been granted, so the JS side
 * never has to special-case the pre-33 vs 33+ permission model itself.
 */
class NotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val CHANNEL_ID = "guardpay_security_alerts"
        private var nextNotificationId = 1001
    }

    override fun getName(): String = "GuardPayNotifications"

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "GuardPay security alerts",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Real-time risk warnings and payment-protection alerts"
                    enableVibration(true)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    @ReactMethod
    fun areNotificationsEnabled(promise: Promise) {
        promise.resolve(NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
    }

    /**
     * Shows a real Android notification. Tapping it reopens GuardPay.
     * Resolves `true` if the notification was posted, `false` if the user has
     * notifications disabled at the OS level (never throws for that case).
     */
    @ReactMethod
    fun notify(title: String, message: String, promise: Promise) {
        try {
            if (!NotificationManagerCompat.from(reactContext).areNotificationsEnabled()) {
                promise.resolve(false)
                return
            }

            val launchIntent =
                reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
                    ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notification = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(reactContext.applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(reactContext).notify(nextNotificationId++, notification)
            promise.resolve(true)
        } catch (e: SecurityException) {
            // Permission revoked between the check and the call — not a crash.
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("NOTIFY_FAILED", "Could not show the notification", e)
        }
    }
}
