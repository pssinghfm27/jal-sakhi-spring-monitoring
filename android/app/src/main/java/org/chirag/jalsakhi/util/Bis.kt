// SPDX-License-Identifier: MIT
// Mirror of backend/src/services/bis.js — keep these two files in sync.
package org.chirag.jalsakhi.util

enum class BisClass { GREEN, AMBER, RED, UNKNOWN }

data class BisRule(val acceptable: ClosedFloatingPointRange<Double>, val permissible: ClosedFloatingPointRange<Double>, val unit: String)

object Bis {
    val rules: Map<String, BisRule> = mapOf(
        "ph"             to BisRule(6.5..8.5,    6.5..8.5,    ""),
        "tds"            to BisRule(0.0..500.0,  0.0..2000.0, "mg/L"),
        "turbidity"      to BisRule(0.0..1.0,    0.0..5.0,    "NTU"),
        "hardness"       to BisRule(0.0..200.0,  0.0..600.0,  "mg/L"),
        "alkalinity"     to BisRule(0.0..200.0,  0.0..600.0,  "mg/L"),
        "chloride"       to BisRule(0.0..250.0,  0.0..1000.0, "mg/L"),
        "iron"           to BisRule(0.0..0.3,    0.0..0.3,    "mg/L"),
        "fecal_coliform" to BisRule(0.0..0.0,    0.0..0.0,    "MPN/100ml"),
    )

    fun classify(param: String, value: Double?): BisClass {
        if (value == null || value.isNaN()) return BisClass.UNKNOWN
        val r = rules[param] ?: return BisClass.UNKNOWN
        return when {
            value in r.acceptable -> BisClass.GREEN
            value in r.permissible -> BisClass.AMBER
            else -> BisClass.RED
        }
    }

    fun rangeLabel(param: String): String {
        val r = rules[param] ?: return ""
        val (a, b) = r.acceptable.start to r.acceptable.endInclusive
        return if (a == b) "= $a" else "$a – $b"
    }
}
