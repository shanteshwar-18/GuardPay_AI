package com.guardpayui

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * GuardPay AI — real Android screen-capture consent.
 *
 * Android has no install-time or simple runtime permission for screen capture —
 * the only way to ask the user is MediaProjectionManager's system consent dialog
 * ("Start recording or casting?"). There is no JavaScript-only way to trigger it,
 * which is why the permissions screen previously labelled this row "simulated".
 *
 * This module shows that real dialog and reports the real result. It deliberately
 * stops the returned MediaProjection immediately rather than capturing frames —
 * GuardPay's screen-context signal in this build is a consent/capability check,
 * not a live screen-reading pipeline, so no foreground service is started and no
 * screen content is ever actually captured or transmitted.
 */
class ScreenCaptureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    companion object {
        private const val REQUEST_CODE = 9417
    }

    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "ScreenCaptureModule"

    @ReactMethod
    fun requestPermission(promise: Promise) {
        val activity: Activity? = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity to launch the consent dialog from")
            return
        }
        if (pendingPromise != null) {
            promise.reject("ALREADY_PENDING", "A screen-capture request is already in progress")
            return
        }

        val manager =
            reactContext.getSystemService(ReactApplicationContext.MEDIA_PROJECTION_SERVICE)
                as? MediaProjectionManager
        if (manager == null) {
            promise.reject("UNAVAILABLE", "MediaProjectionManager is unavailable on this device")
            return
        }

        pendingPromise = promise
        try {
            activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CODE)
        } catch (e: Exception) {
            pendingPromise = null
            promise.reject("LAUNCH_FAILED", "Could not open the screen-capture consent dialog", e)
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode == Activity.RESULT_OK && data != null) {
            // Consent granted. Immediately release the projection — GuardPay records
            // the grant as a signal capability, it does not capture screen content.
            try {
                val manager =
                    reactContext.getSystemService(ReactApplicationContext.MEDIA_PROJECTION_SERVICE)
                        as? MediaProjectionManager
                val projection = manager?.getMediaProjection(resultCode, data)
                projection?.stop()
            } catch (e: Exception) {
                // Grant already happened from the user's perspective; a cleanup
                // failure here must not be reported back as a denial.
            }
            promise.resolve(true)
        } else {
            promise.resolve(false)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // Not used — the consent dialog returns via onActivityResult.
    }
}
