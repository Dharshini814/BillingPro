"""
Tax Engine - Country-based tax calculation
==========================================
India      -> GST 18%  (CGST 9% + SGST 9%)
USA        -> Sales Tax 10%
UK         -> VAT 20%
Canada     -> GST 5%
Australia  -> GST 10%
UAE        -> VAT 5%
Singapore  -> GST 9%
...and 30+ more countries
Others     -> 0%
"""

from dataclasses import dataclass


# country_key -> (tax_label, total_rate, cgst_half, sgst_half)
# cgst/sgst only for India split display
_TAX_MAP = {
    "india":                   ("GST",            0.18,  0.09, 0.09),
    "united states":           ("Sales Tax",      0.10,  0.00, 0.00),
    "usa":                     ("Sales Tax",      0.10,  0.00, 0.00),
    "us":                      ("Sales Tax",      0.10,  0.00, 0.00),
    "united kingdom":          ("VAT",            0.20,  0.00, 0.00),
    "uk":                      ("VAT",            0.20,  0.00, 0.00),
    "germany":                 ("VAT",            0.19,  0.00, 0.00),
    "france":                  ("VAT",            0.20,  0.00, 0.00),
    "netherlands":             ("VAT",            0.21,  0.00, 0.00),
    "italy":                   ("VAT",            0.22,  0.00, 0.00),
    "spain":                   ("VAT",            0.21,  0.00, 0.00),
    "canada":                  ("GST",            0.05,  0.00, 0.00),
    "australia":               ("GST",            0.10,  0.00, 0.00),
    "new zealand":             ("GST",            0.15,  0.00, 0.00),
    "uae":                     ("VAT",            0.05,  0.00, 0.00),
    "united arab emirates":    ("VAT",            0.05,  0.00, 0.00),
    "singapore":               ("GST",            0.09,  0.00, 0.00),
    "japan":                   ("Consumption Tax",0.10,  0.00, 0.00),
    "south korea":             ("VAT",            0.10,  0.00, 0.00),
    "brazil":                  ("Tax",            0.12,  0.00, 0.00),
    "mexico":                  ("IVA",            0.16,  0.00, 0.00),
    "south africa":            ("VAT",            0.15,  0.00, 0.00),
    "kenya":                   ("VAT",            0.16,  0.00, 0.00),
    "nigeria":                 ("VAT",            0.075, 0.00, 0.00),
    "china":                   ("VAT",            0.13,  0.00, 0.00),
    "russia":                  ("VAT",            0.20,  0.00, 0.00),
    "switzerland":             ("VAT",            0.077, 0.00, 0.00),
    "sweden":                  ("VAT",            0.25,  0.00, 0.00),
    "norway":                  ("VAT",            0.25,  0.00, 0.00),
    "denmark":                 ("VAT",            0.25,  0.00, 0.00),
    "finland":                 ("VAT",            0.24,  0.00, 0.00),
    "poland":                  ("VAT",            0.23,  0.00, 0.00),
    "thailand":                ("VAT",            0.07,  0.00, 0.00),
    "malaysia":                ("SST",            0.06,  0.00, 0.00),
    "indonesia":               ("VAT",            0.11,  0.00, 0.00),
    "philippines":             ("VAT",            0.12,  0.00, 0.00),
}


@dataclass
class TaxResult:
    country: str
    tax_type: str
    rate_percent: float
    subtotal: float
    cgst: float
    sgst: float
    tax_amount: float
    total: float
    is_india: bool


def calculate_tax(subtotal: float, country: str = None) -> TaxResult:
    country_clean = (country or "India").strip()
    country_key = country_clean.lower()

    entry = _TAX_MAP.get(country_key)
    if entry:
        label, rate, cgst_rate, sgst_rate = entry
    else:
        label, rate, cgst_rate, sgst_rate = ("Tax", 0.00, 0.00, 0.00)

    is_india = country_key == "india"

    tax_amount = round(subtotal * rate, 2)
    cgst = round(subtotal * cgst_rate, 2) if is_india else 0.0
    sgst = round(subtotal * sgst_rate, 2) if is_india else 0.0
    total = round(subtotal + tax_amount, 2)

    return TaxResult(
        country=country_clean,
        tax_type=label,
        rate_percent=round(rate * 100, 3),
        subtotal=subtotal,
        cgst=cgst,
        sgst=sgst,
        tax_amount=tax_amount,
        total=total,
        is_india=is_india,
    )


def tax_result_to_dict(t: TaxResult) -> dict:
    return {
        "country": t.country,
        "tax_type": t.tax_type,
        "rate_percent": t.rate_percent,
        "subtotal": t.subtotal,
        "cgst": t.cgst,
        "sgst": t.sgst,
        "tax_amount": t.tax_amount,
        "total": t.total,
        "is_india": t.is_india,
    }
