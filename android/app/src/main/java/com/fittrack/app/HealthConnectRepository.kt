package com.fittrack.app

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import org.json.JSONArray
import org.json.JSONObject

class BridgeException(val code: String, override val message: String) : Exception(message)

class HealthConnectRepository(private val context: Context) {
    companion object {
        const val PROVIDER = "com.google.android.apps.healthdata"
        val PERMISSIONS = linkedMapOf(
            "steps" to HealthPermission.getReadPermission(StepsRecord::class),
            "activeCalories" to HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            "sleep" to HealthPermission.getReadPermission(SleepSessionRecord::class),
            "weight" to HealthPermission.getReadPermission(WeightRecord::class),
        )
    }

    fun status(): Int = HealthConnectClient.getSdkStatus(context)

    private fun client(): HealthConnectClient {
        if (status() != HealthConnectClient.SDK_AVAILABLE) {
            throw BridgeException("health_unavailable", "Install or update Health Connect, then try again.")
        }
        return HealthConnectClient.getOrCreate(context)
    }

    suspend fun grantedIds(): Set<String> {
        val granted = client().permissionController.getGrantedPermissions()
        return PERMISSIONS.filterValues { it in granted }.keys
    }

    suspend fun availability(): JSONObject {
        val status = status()
        val available = status == HealthConnectClient.SDK_AVAILABLE
        return JSONObject()
            .put("available", available)
            .put("status", when (status) {
                HealthConnectClient.SDK_AVAILABLE -> "available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "install-required"
                else -> "unavailable"
            })
            .put("granted", JSONArray(if (available) grantedIds().toList() else emptyList<String>()))
    }

    suspend fun disconnect(): JSONObject {
        // This revokes permissions for com.fittrack.app only. Samsung Health's
        // permissions and source records are never changed or deleted.
        if (status() == HealthConnectClient.SDK_AVAILABLE) client().permissionController.revokeAllPermissions()
        return availability()
    }

    suspend fun sync(): JSONObject {
        val health = client()
        val granted = grantedIds()
        if (granted.isEmpty()) throw BridgeException("permission_required", "Choose at least one health permission to sync.")
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val today = now.atZone(zone).toLocalDate()
        val firstDay = today.minusDays(6)
        val weights = if ("weight" in granted) readLatestDailyWeights(health, firstDay, now, zone) else emptyMap()
        val metrics = buildSet {
            if ("steps" in granted) add(StepsRecord.COUNT_TOTAL)
            if ("activeCalories" in granted) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
            if ("sleep" in granted) add(SleepSessionRecord.SLEEP_DURATION_TOTAL)
        }
        val days = JSONArray()
        repeat(7) { offset ->
            val date = firstDay.plusDays(offset.toLong())
            val start = date.atStartOfDay(zone).toInstant()
            val end = minOf(date.plusDays(1).atStartOfDay(zone).toInstant(), now)
            // Health Connect applies source priorities/deduplication to its
            // aggregates. Never sum raw records from a watch and phone.
            val result = if (metrics.isNotEmpty() && end > start) health.aggregate(
                AggregateRequest(metrics, TimeRangeFilter.between(start, end)),
            ) else null
            days.put(JSONObject().put("date", date.toString())
                .put("steps", result?.get(StepsRecord.COUNT_TOTAL) ?: JSONObject.NULL)
                .put("activeCalories", result?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories ?: JSONObject.NULL)
                .put("sleepMinutes", result?.get(SleepSessionRecord.SLEEP_DURATION_TOTAL)?.toMillis()?.div(60_000.0) ?: JSONObject.NULL)
                .put("weightKg", weights[date]?.weight?.inKilograms ?: JSONObject.NULL))
        }
        // A permission can be revoked while the read is in flight. Discard the
        // entire response rather than committing values whose access was lost.
        if (!grantedIds().containsAll(granted)) throw BridgeException("permission_revoked", "Health permissions changed. Review access and sync again.")
        return JSONObject().put("syncedAt", now.toString()).put("fromDate", firstDay.toString())
            .put("toDate", today.toString()).put("permissions", JSONArray(granted.toList())).put("days", days)
    }

    private suspend fun readLatestDailyWeights(
        health: HealthConnectClient, firstDay: LocalDate, now: Instant, zone: ZoneId,
    ): Map<LocalDate, WeightRecord> {
        val latest = mutableMapOf<LocalDate, WeightRecord>()
        val seenTokens = mutableSetOf<String>()
        var pageToken: String? = null
        do {
            val response = health.readRecords(ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.between(firstDay.atStartOfDay(zone).toInstant(), now),
                ascendingOrder = false,
                pageSize = 1000,
                pageToken = pageToken,
            ))
            response.records.forEach { record ->
                val date = record.time.atZone(zone).toLocalDate()
                val previous = latest[date]
                if (previous == null || record.time > previous.time ||
                    (record.time == previous.time && record.metadata.lastModifiedTime > previous.metadata.lastModifiedTime)) latest[date] = record
            }
            val nextPage = response.pageToken?.takeIf { it.isNotBlank() }
            if (nextPage != null && !seenTokens.add(nextPage)) {
                throw BridgeException("sync_failed", "Health Connect returned an incomplete response. Try syncing again.")
            }
            pageToken = nextPage
        } while (pageToken != null)
        return latest
    }
}
