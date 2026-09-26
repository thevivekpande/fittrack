package com.fittrack.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    companion object {
        const val ORIGIN = "https://appassets.androidplatform.net"
        const val ENTRY = "$ORIGIN/assets/web/index.html"
    }

    private lateinit var webView: WebView
    private lateinit var health: HealthConnectRepository
    private var pageReady = false
    private var pageVersion = 0
    private var backPending = false
    private val syncMutex = Mutex()
    private data class Request(val id: String, val page: Int)
    private var permissionRequest: Request? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val permissionsLauncher = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) {
        val request = permissionRequest ?: return@registerForActivityResult
        permissionRequest = null
        lifecycleScope.launch {
            try { respond(request, health.availability()) }
            catch (error: Exception) { fail(request, error) }
        }
    }

    private val fileLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        // A one-time, user-selected content URI; no broad storage permission.
        fileCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        health = HealthConnectRepository(this)
        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(251, 252, 249))
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(webView)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(safe.left, safe.top, safe.right, maxOf(safe.bottom, keyboard.bottom))
            insets
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            // Required only for explicit document-picker imports. Navigation to
            // content/file URLs is rejected; no Javascript interface is exposed.
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = true
        }
        val assets = WebViewAssetLoader.Builder().addPathHandler("/", WebAssets(assets)).build()
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (trusted(request.url)) return false
                if (request.isForMainFrame && request.url.scheme in setOf("https", "http", "mailto")) openExternal(request.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                pageReady = false
                pageVersion += 1
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = trusted(Uri.parse(url))
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                if (!trustedPage()) return false
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                try { fileLauncher.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) }
                catch (_: ActivityNotFoundException) { callback.onReceiveValue(null); fileCallback = null }
                return true
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "FitTrackAndroid", setOf(ORIGIN)) { _, message, source, isMainFrame, _ ->
                if (isMainFrame && trusted(source) && trustedPage() && message.type == WebMessageCompat.TYPE_STRING) receive(message.data)
            }
        } else {
            android.app.AlertDialog.Builder(this)
                .setTitle("Update Android System WebView")
                .setMessage("Health Connect needs a newer Android System WebView. Update it in the Play Store, then reopen FitTrack. You can continue using your workout planner now.")
                .setPositiveButton("Continue", null)
                .show()
        }
        // Remote links never become a document in the privileged WebView.
        webView.setDownloadListener { url, _, _, _, _ ->
            val uri = Uri.parse(url)
            if (!trusted(uri) && uri.scheme == "https") openExternal(uri)
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleWebBack()
            }
        })
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null || !trustedPage()) webView.loadUrl(ENTRY)
        clearExpiredExports()
    }

    private fun trusted(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "appassets.androidplatform.net" && uri.port in setOf(-1, 443)
    private fun trustedPage(): Boolean = webView.url?.let { trusted(Uri.parse(it)) } == true

    private fun handleWebBack() {
        fun fallback() { if (webView.canGoBack()) webView.goBack() else finish() }
        if (!trustedPage()) { fallback(); return }
        if (backPending) return
        backPending = true
        webView.evaluateJavascript("""
            (() => {
              const picker = document.querySelector('dialog[open]');
              if (picker) {
                if (picker.dispatchEvent(new Event('cancel', {cancelable: true, bubbles: true}))) picker.close();
                return true;
              }
              if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
                (document.activeElement || document).dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
                return true;
              }
              return false;
            })()
        """.trimIndent()) { handled ->
            backPending = false
            if (handled != "true" && !isDestroyed) fallback()
        }
    }

    private fun receive(raw: String?) {
        if (raw == null || raw.length > HealthExport.MAX_BYTES + 4096) return
        val input = try { JSONObject(raw) } catch (_: Exception) { return }
        val id = input.opt("id") as? String ?: return
        if (id.length !in 1..128) return
        val request = Request(id, pageVersion)
        lifecycleScope.launch {
            try {
                when (input.optString("method")) {
                    "availability" -> respond(request, health.availability())
                    "connect" -> connect(request)
                    "sync" -> {
                        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) throw BridgeException("not_foreground", "Open FitTrack to sync health data.")
                        if (!syncMutex.tryLock()) throw BridgeException("busy", "A health sync is already running.")
                        try { respond(request, health.sync()) } finally { syncMutex.unlock() }
                    }
                    "disconnect" -> respond(request, health.disconnect())
                    "openSettings" -> { openHealthSettings(); respond(request, JSONObject().put("opened", true)) }
                    "exportHealth" -> {
                        shareHealth(input.optJSONObject("args")?.optString("json") ?: throw BridgeException("invalid_export", "Choose a health snapshot to export."))
                        respond(request, JSONObject().put("shared", true))
                    }
                    else -> throw BridgeException("unknown_method", "This version of FitTrack does not support that action.")
                }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { fail(request, error) }
        }
    }

    private suspend fun connect(request: Request) {
        if (health.status() != HealthConnectClient.SDK_AVAILABLE) { respond(request, health.availability()); return }
        if (permissionRequest != null) throw BridgeException("busy", "Finish the current health permission request first.")
        if (health.grantedIds().size == HealthConnectRepository.PERMISSIONS.size) { respond(request, health.availability()); return }
        permissionRequest = request
        try { permissionsLauncher.launch(HealthConnectRepository.PERMISSIONS.values.toSet()) }
        catch (error: Exception) { permissionRequest = null; throw error }
    }

    private fun respond(request: Request, result: JSONObject) {
        send(request, JSONObject().put("id", request.id).put("ok", true).put("result", result))
    }

    private fun fail(request: Request, error: Exception) {
        val failure = when (error) {
            is BridgeException -> error
            is SecurityException -> BridgeException("permission_revoked", "Health permissions changed. Review access and try again.")
            is ActivityNotFoundException -> BridgeException("unavailable", "No app is available for this action. Check Health Connect in Android settings.")
            else -> BridgeException("health_error", "This action could not finish. Review Health Connect access and try again.")
        }
        send(request, JSONObject().put("id", request.id).put("ok", false)
            .put("error", JSONObject().put("code", failure.code).put("message", failure.message)))
    }

    private fun send(request: Request, detail: JSONObject) {
        if (isDestroyed || request.page != pageVersion || !trustedPage()) return
        // Quote the full JSON string before evaluating it: strings cannot break
        // out of the expression or insert executable JavaScript.
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('fittrack:native',{detail:JSON.parse(${JSONObject.quote(detail.toString())})}));", null)
    }

    private fun openHealthSettings() {
        if (health.status() == HealthConnectClient.SDK_AVAILABLE) {
            startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
        } else {
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${HealthConnectRepository.PROVIDER}")).setPackage("com.android.vending")) }
            catch (_: ActivityNotFoundException) { openExternal(Uri.parse("https://play.google.com/store/apps/details?id=${HealthConnectRepository.PROVIDER}")) }
        }
    }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: ActivityNotFoundException) { android.widget.Toast.makeText(this, "No app can open this link.", android.widget.Toast.LENGTH_SHORT).show() }
    }

    private fun shareHealth(json: String) {
        val valid = try { HealthExport.validate(json) }
        catch (_: Exception) { throw BridgeException("invalid_export", "Choose a valid FitTrack health export smaller than 1 MB.") }
        clearExpiredExports()
        val directory = File(cacheDir, "health-export").apply { mkdirs() }
        val file = File(directory, "fittrack-health-${Instant.now().epochSecond}.json").apply { writeText(valid, Charsets.UTF_8) }
        val uri = FileProvider.getUriForFile(this, "$packageName.health-exports", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri("FitTrack health export", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(intent, "Share your FitTrack health snapshot"))
    }

    private fun clearExpiredExports() {
        val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
        File(cacheDir, "health-export").listFiles()?.filter { it.isFile && it.lastModified() < cutoff }?.forEach { it.delete() }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized && pageReady && trustedPage()) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('fittrack:foreground'));", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        permissionRequest = null
        webView.destroy()
        super.onDestroy()
    }
}
