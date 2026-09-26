package com.fittrack.app

import java.time.Instant
import java.time.LocalDate
import org.json.JSONObject

/** Only the explicit, health-only transfer format may leave through the share bridge. */
object HealthExport {
    const val MAX_BYTES = 1_048_576
    private val fields = setOf("date", "steps", "activeCalories", "sleepMinutes", "weightKg")
    private val permissions = setOf("steps", "activeCalories", "sleep", "weight")
    private val fieldPermission = mapOf("steps" to "steps", "activeCalories" to "activeCalories", "sleepMinutes" to "sleep", "weightKg" to "weight")
    private val limits = mapOf("steps" to (0.0 to 200_000.0), "activeCalories" to (0.0 to 30_000.0), "sleepMinutes" to (0.0 to 1440.0), "weightKg" to (20.0 to 400.0))

    fun validate(json: String): String {
        require(json.toByteArray(Charsets.UTF_8).size <= MAX_BYTES) { "Health export must be smaller than 1 MB." }
        val envelope = JSONObject(json)
        require(envelope.keys().asSequence().toSet() == setOf("format", "snapshot")) { "Only health snapshots can be exported." }
        require(envelope.getString("format") == "fittrack-health-v1") { "Unsupported health export format." }
        val snapshot = envelope.getJSONObject("snapshot")
        require(snapshot.keys().asSequence().toSet() == setOf("syncedAt", "fromDate", "toDate", "permissions", "days")) { "Unexpected snapshot fields." }
        Instant.parse(snapshot.getString("syncedAt"))
        val first = LocalDate.parse(snapshot.getString("fromDate"))
        val last = LocalDate.parse(snapshot.getString("toDate"))
        require(first <= last) { "Invalid health date range." }
        val allowed = snapshot.getJSONArray("permissions")
        val granted = (0 until allowed.length()).map { allowed.getString(it) }.toSet()
        require(granted.size == allowed.length() && permissions.containsAll(granted)) { "Invalid health permissions." }
        val days = snapshot.getJSONArray("days")
        require(days.length() in 1..366) { "Invalid number of health days." }
        val dates = mutableSetOf<LocalDate>()
        for (index in 0 until days.length()) {
            val day = days.getJSONObject(index)
            require(day.keys().asSequence().toSet() == fields) { "Unexpected day fields." }
            val date = LocalDate.parse(day.getString("date"))
            require(date >= first && date <= last && dates.add(date)) { "Invalid or duplicate health date." }
            limits.forEach { (field, range) ->
                if (!day.isNull(field)) {
                    require(fieldPermission[field] in granted) { "A health field is not included in the permission list." }
                    val number = day.get(field)
                    require(number is Number) { "Health values must be numbers." }
                    val value = number.toDouble()
                    require(value.isFinite() && value >= range.first && value <= range.second) { "Health value is out of range." }
                    require(field != "steps" || value % 1.0 == 0.0) { "Steps must be a whole number." }
                }
            }
        }
        return envelope.toString()
    }
}
