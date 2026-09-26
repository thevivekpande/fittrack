package com.fittrack.app

import android.graphics.Color
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class PermissionsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(28), dp(24), dp(28))
        }
        fun paragraph(text: String, size: Float = 16f) = TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(Color.rgb(48, 78, 60))
            setPadding(0, 0, 0, dp(20))
            setLineSpacing(dp(4).toFloat(), 1f)
            column.addView(this)
        }
        paragraph("Your health data, in your control", 26f)
        paragraph("FitTrack reads the health types you choose from Health Connect: steps and active calories for daily activity, sleep duration for recovery context, and weight for progress. Samsung Health and other connected apps can contribute supported types when sharing is enabled. Availability varies; missing active calories are not replaced with total exercise calories.")
        paragraph("Access is read-only. FitTrack does not change Samsung Health records, write health records, or request background access. Sync runs while you use the app, after you choose to connect.")
        paragraph("The last seven local calendar days are read. Daily activity and sleep use Health Connect aggregates; weight uses the latest available measurement each day. Missing data stays empty. Health Connect may include records from other apps you have connected, using its source priorities.")
        paragraph("Synced values are saved locally in FitTrack’s private web database on this device. They are separate from your workout logs. No account or cloud health upload is used. Internet access loads the app’s external fonts and exercise images; health values are not attached to those requests.")
        paragraph("You may export a health-only JSON file using Android’s share chooser. The app you choose can receive that file. Temporary exports become eligible for deletion after 24 hours and are removed on the next app launch or export. FitTrack does not choose a recipient or automatically send it.")
        paragraph("Use Health Connect settings to revoke any permission. Disconnect in FitTrack stops future sync and revokes this app’s access; use the health card’s clear-data control to remove saved local health values. Clearing Android app storage or uninstalling FitTrack removes its local database. It does not delete the original Samsung Health records.")
        column.addView(Button(this).apply { text = "Back"; setOnClickListener { finish() } })
        val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(251, 252, 249)); addView(column) }
        setContentView(scroll)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }
    }
}
