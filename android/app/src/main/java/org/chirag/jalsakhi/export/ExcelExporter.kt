// SPDX-License-Identifier: MIT
// Minimal XLSX (OOXML SpreadsheetML) writer — no Apache POI dependency.
// XLSX is a ZIP of XML files following the OOXML schema; we emit the smallest
// valid subset Excel / Google Sheets / LibreOffice all accept.
//
// Sheets emitted: Discharge, Quality, Metadata.
package org.chirag.jalsakhi.export

import android.content.Context
import kotlinx.coroutines.flow.first
import org.chirag.jalsakhi.data.local.AppDb
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.QualityReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object ExcelExporter {

    suspend fun export(ctx: Context, db: AppDb): String {
        val springs = db.springDao().all().first().associateBy { it.id }
        val discharge = db.dischargeDao().allDesc().first()
        val quality = db.qualityDao().allDesc().first()

        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

        val sheets = listOf(
            buildDischargeSheet(discharge, springs, fmt),
            buildQualitySheet(quality, springs, fmt),
            buildMetadataSheet(springs.size, discharge.size, quality.size, fmt.format(Date())),
        )

        val dir = File(ctx.filesDir, "exports").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val out = File(dir, "jalsakhi_$stamp.xlsx")

        ZipOutputStream(FileOutputStream(out)).use { zip ->
            zip.write("[Content_Types].xml", buildContentTypes(sheets.size))
            zip.write("_rels/.rels", REL_ROOT)
            zip.write("xl/_rels/workbook.xml.rels", buildWorkbookRels(sheets.size))
            zip.write("xl/workbook.xml", buildWorkbookXml(sheets.map { it.name }))
            zip.write("xl/styles.xml", STYLES_XML)
            sheets.forEachIndexed { i, s ->
                zip.write("xl/worksheets/sheet${i + 1}.xml", s.xml)
            }
        }
        return out.absolutePath
    }

    // ───────── sheet builders ─────────

    private data class Sheet(val name: String, val xml: String)

    private fun buildDischargeSheet(
        rows: List<DischargeReadingEntity>,
        springs: Map<String, SpringEntity>,
        fmt: SimpleDateFormat,
    ): Sheet {
        val headers = listOf(
            "client_uuid", "spring_code", "spring_name", "village", "block",
            "recorded_at", "lat", "lon", "gps_accuracy_m", "method",
            "discharge_lpm", "duration_sec", "weather", "synced", "notes",
        )
        val data = rows.map { r ->
            val s = springs[r.springId]
            listOf<Any?>(
                r.clientUuid, s?.code ?: "", s?.nameEn ?: "", s?.villageName ?: "", s?.block ?: "",
                fmt.format(Date(r.recordedAt)), r.lat, r.lon, r.gpsAccuracyM, r.method,
                r.dischargeLpm, r.durationSec, r.weather, r.syncedAt != null, r.notes,
            )
        }
        return Sheet("Discharge", sheetXml(headers, data))
    }

    private fun buildQualitySheet(
        rows: List<QualityReadingEntity>,
        springs: Map<String, SpringEntity>,
        fmt: SimpleDateFormat,
    ): Sheet {
        val headers = listOf(
            "client_uuid", "spring_code", "spring_name", "village", "block",
            "recorded_at", "lat", "lon", "ph", "tds", "turbidity", "hardness",
            "alkalinity", "chloride", "iron", "fecal_coliform",
            "kit_batch", "kit_expiry", "synced",
        )
        val data = rows.map { r ->
            val s = springs[r.springId]
            listOf<Any?>(
                r.clientUuid, s?.code ?: "", s?.nameEn ?: "", s?.villageName ?: "", s?.block ?: "",
                fmt.format(Date(r.recordedAt)), r.lat, r.lon,
                r.ph, r.tds, r.turbidity, r.hardness,
                r.alkalinity, r.chloride, r.iron, r.fecalColiform,
                r.kitBatch, r.kitExpiry, r.syncedAt != null,
            )
        }
        return Sheet("Quality", sheetXml(headers, data))
    }

    private fun buildMetadataSheet(
        springsCount: Int, dischargeCount: Int, qualityCount: Int, now: String,
    ): Sheet {
        val headers = listOf("key", "value")
        val data = listOf<List<Any?>>(
            listOf("exported_at", now),
            listOf("springs", springsCount),
            listOf("discharge_rows", dischargeCount),
            listOf("quality_rows", qualityCount),
            listOf("app_version", "0.1.0"),
        )
        return Sheet("Metadata", sheetXml(headers, data))
    }

    // ───────── XML generators ─────────

    private fun sheetXml(headers: List<String>, rows: List<List<Any?>>): String {
        val sb = StringBuilder(8192)
        sb.append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
        sb.append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""")
        // header row (style 1 = bold)
        sb.append("<row r=\"1\">")
        headers.forEachIndexed { i, h ->
            sb.append("<c r=\"${col(i)}1\" s=\"1\" t=\"inlineStr\"><is><t>${esc(h)}</t></is></c>")
        }
        sb.append("</row>")
        // data rows
        rows.forEachIndexed { rIdx, row ->
            val r = rIdx + 2
            sb.append("<row r=\"$r\">")
            row.forEachIndexed { i, v ->
                val ref = "${col(i)}$r"
                when (v) {
                    null -> { /* skip empty cells — Excel treats absence as blank */ }
                    is Number -> sb.append("<c r=\"$ref\"><v>${v}</v></c>")
                    is Boolean -> sb.append("<c r=\"$ref\" t=\"b\"><v>${if (v) 1 else 0}</v></c>")
                    else -> sb.append("<c r=\"$ref\" t=\"inlineStr\"><is><t>${esc(v.toString())}</t></is></c>")
                }
            }
            sb.append("</row>")
        }
        sb.append("</sheetData></worksheet>")
        return sb.toString()
    }

    private fun col(i: Int): String {
        // Excel column letters: A, B, … Z, AA, AB …
        var n = i
        val s = StringBuilder()
        do {
            s.insert(0, ('A' + (n % 26)))
            n = n / 26 - 1
        } while (n >= 0)
        return s.toString()
    }

    private fun esc(s: String): String = s
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")

    private fun ZipOutputStream.write(path: String, content: String) {
        putNextEntry(ZipEntry(path))
        write(content.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    // ───────── package boilerplate ─────────

    private fun buildContentTypes(sheetCount: Int): String {
        val sheets = (1..sheetCount).joinToString("") {
            """<Override PartName="/xl/worksheets/sheet$it.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>"""
        }
        return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
$sheets
</Types>"""
    }

    private val REL_ROOT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    private fun buildWorkbookRels(sheetCount: Int): String {
        val rels = (1..sheetCount).joinToString("") { i ->
            """<Relationship Id="rId$i" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet$i.xml"/>"""
        }
        val styleRel = """<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>"""
        return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
$rels$styleRel
</Relationships>"""
    }

    private fun buildWorkbookXml(sheetNames: List<String>): String {
        val sheets = sheetNames.mapIndexed { i, n ->
            """<sheet name="$n" sheetId="${i + 1}" r:id="rId${i + 1}"/>"""
        }.joinToString("")
        return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>$sheets</sheets>
</workbook>"""
    }

    // Two styles: 0 = default, 1 = bold header
    private val STYLES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs>
</styleSheet>"""
}
