package com.fittrack.app

import android.content.res.AssetManager
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.net.URLConnection

class WebAssets(private val assets: AssetManager) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        // The entry URL remains /assets/web/index.html, while Vite's absolute
        // /assets/*, /images/* and favicon URLs resolve to that same web root.
        val relative = path.removePrefix("assets/web/").ifEmpty { "index.html" }
        if (relative.split('/').any { it == ".." || it == "." } || '\\' in relative || '\u0000' in relative) return missing()
        return try {
            val mime = when (relative.substringAfterLast('.').lowercase()) {
                "js", "mjs" -> "application/javascript"
                "css" -> "text/css"
                "html" -> "text/html"
                "svg" -> "image/svg+xml"
                "json" -> "application/json"
                "wasm" -> "application/wasm"
                "woff2" -> "font/woff2"
                else -> URLConnection.guessContentTypeFromName(relative) ?: "application/octet-stream"
            }
            WebResourceResponse(mime, if (mime.startsWith("text/") || mime in setOf("application/javascript", "application/json", "image/svg+xml")) "UTF-8" else null,
                200, "OK", mapOf("Cache-Control" to "no-cache", "X-Content-Type-Options" to "nosniff"), assets.open("web/$relative"))
        } catch (_: Exception) { missing() }
    }

    private fun missing() = WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream("Not found".toByteArray()))
}
