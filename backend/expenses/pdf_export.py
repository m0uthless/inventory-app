"""expenses/pdf_export.py — PDF nota spese, stesso contenuto/ordine del
foglio Excel BASE (intestazione, 12 categorie, log trasferte km, totali,
riquadro firme). Stesso pattern (canvas reportlab, disegno manuale) di
servicenow/api.py:stats_export_pdf / wiki/api/pages.py:export_pdf.
"""
from __future__ import annotations

import io

from django.http import HttpResponse

from .models import ExpenseReportStatus


def _user_name(u) -> str:
    if u is None:
        return ""
    return f"{u.first_name} {u.last_name}".strip() or u.username


COMPANY_HEADER = "BIOTRON S.P.A.  ·  VIA AVATI, 43  ·  40054 BUDRIO (BO)"

STATUS_LABELS = {
    ExpenseReportStatus.BOZZA: "Bozza",
    ExpenseReportStatus.INVIATA: "Inviata",
    ExpenseReportStatus.VALIDATA: "Validata",
    ExpenseReportStatus.RIFIUTATA: "Rifiutata",
}


def build_expense_report_pdf(report) -> HttpResponse:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.pdfgen import canvas
    except Exception as e:
        return HttpResponse(
            f"PDF export dependency missing: {e}",
            status=501,
            content_type="text/plain",
        )

    items = sorted(report.items.all(), key=lambda i: i.sort_order)
    km_item = next((i for i in items if i.category == "rimborso_km"), None)
    km_trips = list(km_item.km_trips.all().order_by("date")) if km_item else []

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    left, right, top, bottom = 2 * cm, 2 * cm, 2 * cm, 2 * cm
    max_w = width - left - right

    y = height - top

    def ensure_space(min_y: float):
        nonlocal y
        if y <= min_y:
            c.showPage()
            y = height - top

    # ── Intestazione azienda ────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 13)
    c.drawString(left, y, COMPANY_HEADER)
    y -= 22

    c.setFont("Helvetica-Bold", 16)
    c.drawString(left, y, f"Nota spese N. {report.number}")
    y -= 18

    c.setFont("Helvetica", 10)
    c.setFillGray(0.3)
    c.drawString(left, y, f"Mese di {report.month_label} {report.year}  ·  Sig. {_user_name(report.user)}")
    c.drawRightString(left + max_w, y, f"Stato: {STATUS_LABELS.get(report.status, report.status)}")
    c.setFillGray(0)
    y -= 24

    if report.status == ExpenseReportStatus.RIFIUTATA and report.rejection_reason:
        c.setFont("Helvetica-Oblique", 9)
        c.setFillGray(0.3)
        c.drawString(left, y, f"Motivo rifiuto: {report.rejection_reason[:110]}")
        c.setFillGray(0)
        y -= 16

    y -= 6

    # ── Tabella categorie ────────────────────────────────────────────────────
    col_desc_x   = left
    col_date_x   = left + max_w * 0.46
    col_note_x   = left + max_w * 0.58
    col_amount_x = left + max_w

    c.setFont("Helvetica-Bold", 9)
    c.drawString(col_desc_x, y, "DESCRIZIONE")
    c.drawString(col_date_x, y, "DATA")
    c.drawString(col_note_x, y, "NOTE")
    c.drawRightString(col_amount_x, y, "IMPORTO")
    y -= 4
    c.line(left, y, left + max_w, y)
    y -= 12

    c.setFont("Helvetica", 8.5)
    for item in items:
        ensure_space(bottom + 20)
        c.drawString(col_desc_x, y, item.get_category_display()[:52])
        c.drawString(col_date_x, y, item.date.strftime("%d/%m/%Y") if item.date else "")
        c.drawString(col_note_x, y, (item.description or "")[:28])
        c.drawRightString(col_amount_x, y, f"{item.amount:.2f} \u20ac")
        y -= 13

    y -= 2
    c.line(left, y, left + max_w, y)
    y -= 14
    c.setFont("Helvetica-Bold", 10)
    c.drawString(col_desc_x, y, "TOTALE SPESE")
    c.drawRightString(col_amount_x, y, f"{report.total_expenses:.2f} \u20ac")
    y -= 22

    # ── Log trasferte km ─────────────────────────────────────────────────────
    if km_trips:
        ensure_space(bottom + 60)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(left, y, "Trasferte — rimborso chilometrico")
        y -= 16
        c.setFont("Helvetica-Bold", 9)
        col_trip_date_x, col_trip_dest_x, col_trip_km_x = left, left + 2.5 * cm, left + max_w
        c.drawString(col_trip_date_x, y, "DATA")
        c.drawString(col_trip_dest_x, y, "LUOGO DI DESTINAZIONE")
        c.drawRightString(col_trip_km_x, y, "KM")
        y -= 4
        c.line(left, y, left + max_w, y)
        y -= 12
        c.setFont("Helvetica", 8.5)
        total_km = 0
        for trip in km_trips:
            ensure_space(bottom + 20)
            c.drawString(col_trip_date_x, y, trip.date.strftime("%d/%m/%Y"))
            c.drawString(col_trip_dest_x, y, trip.destination[:48])
            c.drawRightString(col_trip_km_x, y, str(trip.km))
            total_km += trip.km
            y -= 12
        y -= 2
        c.line(left, y, left + max_w, y)
        y -= 14
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left, y, "TOTALE KM")
        c.drawRightString(col_trip_km_x, y, str(total_km))
        y -= 22

    # ── Totali ────────────────────────────────────────────────────────────────
    ensure_space(bottom + 100)
    c.setFont("Helvetica", 10)
    c.drawString(left, y, f"Totale anticipi ricevuti: {report.advances_total:.2f} \u20ac")
    y -= 16
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, f"TOTALE DA RENDERE: {report.total_due:.2f} \u20ac")
    y -= 30

    if report.note:
        c.setFont("Helvetica-Oblique", 9)
        c.setFillGray(0.3)
        c.drawString(left, y, f"Note: {report.note[:120]}")
        c.setFillGray(0)
        y -= 24

    # ── Riquadro firme (spazio per firma a mano su stampa) ───────────────────
    ensure_space(bottom + 70)
    sig_w = max_w / 2 - 0.5 * cm
    c.setFont("Helvetica", 8)
    c.line(left, y, left + sig_w, y)
    c.line(left + sig_w + 1 * cm, y, left + sig_w + 1 * cm + sig_w, y)
    y -= 10
    c.drawString(left, y, "Firma di chi compila")
    label = "Visto segreteria"
    if report.validated_by_id:
        when = report.validated_at.strftime("%d/%m/%Y") if report.validated_at else ""
        label += f" — {_user_name(report.validated_by)} ({when})"
    c.drawString(left + sig_w + 1 * cm, y, label)

    c.save()
    buf.seek(0)

    filename = f"nota_spese_{report.user.username}_{report.year}_{report.month:02d}.pdf"
    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp
