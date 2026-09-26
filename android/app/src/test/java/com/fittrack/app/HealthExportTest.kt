package com.fittrack.app

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class HealthExportTest {
    private fun sample(): JSONObject = JSONObject().put("format", "fittrack-health-v1").put("snapshot", JSONObject()
        .put("syncedAt", "2026-09-26T08:00:00Z").put("fromDate", "2026-09-26").put("toDate", "2026-09-26")
        .put("permissions", JSONArray(listOf("steps", "weight")))
        .put("days", JSONArray().put(JSONObject().put("date", "2026-09-26").put("steps", 0)
            .put("activeCalories", JSONObject.NULL).put("sleepMinutes", JSONObject.NULL).put("weightKg", 70.5))))

    @Test fun `valid exports preserve zero versus unavailable and decimal weight`() {
        val parsed = JSONObject(HealthExport.validate(sample().toString())).getJSONObject("snapshot").getJSONArray("days").getJSONObject(0)
        assertEquals(0, parsed.getInt("steps"))
        assertTrue(parsed.isNull("activeCalories"))
        assertEquals(70.5, parsed.getDouble("weightKg"), 0.001)
    }

    @Test fun `reject unknown envelope snapshot and day fields`() {
        for (target in listOf("envelope", "snapshot", "day")) {
            val envelope = sample()
            val snapshot = envelope.getJSONObject("snapshot")
            val objectToChange = when (target) { "envelope" -> envelope; "snapshot" -> snapshot; else -> snapshot.getJSONArray("days").getJSONObject(0) }
            objectToChange.put("profile", "This must never be shared")
            assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(envelope.toString()) }
        }
    }

    @Test fun `reject missing permission nonnumeric and out of bounds health values`() {
        for (value in listOf(-1, 200001, 1.5, "1000")) {
            val envelope = sample()
            envelope.getJSONObject("snapshot").getJSONArray("days").getJSONObject(0).put("steps", value)
            assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(envelope.toString()) }
        }
        val missingPermission = sample()
        missingPermission.getJSONObject("snapshot").put("permissions", JSONArray(listOf("steps")))
        assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(missingPermission.toString()) }
    }

    @Test fun `reject duplicate dates and records outside their declared range`() {
        val duplicate = sample()
        val days = duplicate.getJSONObject("snapshot").getJSONArray("days")
        days.put(JSONObject(days.getJSONObject(0).toString()))
        assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(duplicate.toString()) }
        val outside = sample()
        outside.getJSONObject("snapshot").getJSONArray("days").getJSONObject(0).put("date", "2026-09-25")
        assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(outside.toString()) }
    }

    @Test fun `sparse retained history may span more than one year`() {
        val envelope = sample()
        val snapshot = envelope.getJSONObject("snapshot").put("fromDate", "2023-01-01")
        val older = JSONObject(snapshot.getJSONArray("days").getJSONObject(0).toString()).put("date", "2023-01-01")
        snapshot.getJSONArray("days").put(older)
        assertEquals(2, JSONObject(HealthExport.validate(envelope.toString())).getJSONObject("snapshot").getJSONArray("days").length())
    }

    @Test fun `reject oversize exports before parsing`() {
        assertThrows(IllegalArgumentException::class.java) { HealthExport.validate(" ".repeat(HealthExport.MAX_BYTES + 1)) }
    }
}
