"""Offline referral reader for the SHARE brain death referral portal.

Pure, hard-coded Python: regular expressions and keyword tables only.
No AI model, no network call, no third-party package.

The same file runs in the browser (Pyodide) and under plain CPython for tests.

Entry points:
    parse_referral(text) -> dict
    parse_referral_json(text) -> str   (JSON, used by the web page)
"""

import json
import re
from datetime import date, datetime

FIELDS = [
    "patient_name", "hrn", "age", "sex", "hospital", "ward", "admission_date",
    "gcs", "diagnosis", "brain_death", "brain_death_datetime", "ventilator",
    "doctor_name", "prc", "doctor_email", "contact_number", "notes",
]

REQUIRED = ["patient_name", "hospital", "doctor_name"]

LABELS = {
    "patient_name": [
        "patient name", "patient's name", "name of patient", "pt name", "full name",
        "patient", "name", "pt",
    ],
    "hrn": [
        "hospital record number", "hospital record no", "hospital no", "hosp no", "hosp #",
        "hospital #", "record no", "record number", "case no", "chart no", "hrn",
    ],
    "age_sex": ["age/sex", "age / sex", "age & sex", "age and sex", "a/s", "sex/age"],
    "age": ["age"],
    "sex": ["sex", "gender"],
    "hospital": [
        "referring hospital", "referring facility", "referring institution", "hospital name",
        "name of hospital", "facility", "institution", "hospital", "from",
    ],
    "ward": ["ward / room", "ward/room", "ward", "room", "location", "unit", "area", "bed"],
    "admission_date": [
        "er admission date", "date of admission", "admission date", "date admitted",
        "er admission", "admitted on", "admitted", "admission", "doa",
        "date of arrival", "er arrival", "arrival",
    ],
    "gcs": ["gcs score", "gcs at referral", "gcs"],
    "diagnosis": [
        "current working impression", "working impression", "initial impression", "cwi",
        "actual diagnosis", "admitting diagnosis", "working diagnosis", "final diagnosis",
        "diagnosis", "impression", "assessment", "dx",
    ],
    "brain_death_datetime": [
        "date/time of brain death", "brain death date / time", "brain death date/time",
        "brain death date", "date of declaration", "time of declaration", "bd date/time",
        "bd date", "declared on", "declared at",
    ],
    "brain_death": ["brain death declared", "brain death", "bd declared", "bd status", "bd"],
    "ventilator": ["mechanical ventilator", "ventilator", "airway", "vent", "mv"],
    "doctor_name": [
        "referring physician", "referring doctor", "referring md", "referring staff",
        "attending physician", "referred by", "ref by", "referrer", "attending",
        "physician", "doctor", "sender",
    ],
    "prc": ["prc license no", "prc license", "prc no", "prc #", "license no", "lic no", "prc"],
    "doctor_email": ["e-mail address", "email address", "e-mail", "email"],
    "contact_number": [
        "contact number", "contact no", "mobile number", "mobile no", "cp no", "phone",
        "mobile", "contact", "tel", "cp",
    ],
    "notes": ["remarks", "notes", "others", "plan"],
}

KNOWN_HOSPITALS = [
    ("southern philippines medical center", "Southern Philippines Medical Center"),
    ("spmc", "Southern Philippines Medical Center"),
    ("davao doctors hospital", "Davao Doctors Hospital"),
    ("brokenshire", "Brokenshire Medical Center"),
    ("san pedro hospital", "San Pedro Hospital"),
    ("davao medical school foundation", "DMSF Hospital"),
    ("dmsf", "DMSF Hospital"),
    ("metro davao medical", "Metro Davao Medical and Research Center"),
    ("ricardo limso", "Ricardo Limso Medical Center"),
    ("davao regional medical center", "Davao Regional Medical Center"),
    ("drmc", "Davao Regional Medical Center"),
    ("adventist hospital", "Adventist Hospital Davao"),
    ("vicente sotto", "Vicente Sotto Memorial Medical Center"),
    ("vsmmc", "Vicente Sotto Memorial Medical Center"),
    ("davao del norte provincial hospital", "Davao del Norte Provincial Hospital"),
]

WARD_PATTERNS = [
    r"\b(?:er\s+)?(?:red|orange|yellow|green)\s+zone\b(?:\s*\([^)]*\))?",
    r"\b(?:adult\s+|neuro\s*|pedia\s*|surgical\s+|medical\s+)?(?:icu|ciu|nicu|picu|sicu|micu)(?:\s*\d+)?\b",
    r"\bmed\s*ward\s*\d*\b",
    r"\bsurgery\s+(?:dept|department|ward)\b",
    r"\broom\s+[a-z0-9-]+\b",
]

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

MONTH_RE = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
    r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)

TIME_RE = (
    r"(?P<mil>(?:[01]\d|2[0-3])[0-5]\d)\s*h(?:rs?)?\b"
    r"|(?P<hh>[01]?\d|2[0-3])(?:[:.](?P<mm>[0-5]\d))?\s*(?P<ampm>[ap]\.?m\.?)?"
)

PHONE_RE = re.compile(r"(?<!\d)(?:\+?63[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _clean(value):
    value = re.sub(r"\s+", " ", value or "").strip()
    return value.strip(" \t-–—,;:|*•")


def _label_regex():
    pairs = []
    for field, words in LABELS.items():
        for word in words:
            pairs.append((word, field))
    pairs.sort(key=lambda p: len(p[0]), reverse=True)
    alternation = "|".join(re.escape(word).replace(r"\ ", r"\s*") for word, _ in pairs)
    lookup = {re.sub(r"\s+", "", word): field for word, field in pairs}
    pattern = re.compile(
        r"(?:^|(?<=[\s;|,(]))(?P<label>" + alternation + r")\s*(?:\([^)]{0,20}\))?\s*[:=]\s*",
        re.IGNORECASE,
    )
    return pattern, lookup


LABEL_RE, LABEL_LOOKUP = _label_regex()


def _labelled_values(text):
    """Return {field: value} for 'Label: value' segments."""
    found = {}
    for raw_line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*•>]+|\d+[.)])\s*", "", raw_line)
        matches = list(LABEL_RE.finditer(line))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(line)
            value = _clean(line[match.end():end])
            key = re.sub(r"\s+", "", match.group("label").lower())
            field = LABEL_LOOKUP.get(key)
            if field and value and field not in found:
                found[field] = value
    return found


def _year(value):
    year = int(value)
    if year < 100:
        year += 2000
    return year


def _valid_date(year, month, day):
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_date(text, today=None):
    """Find the first date in text. Return 'YYYY-MM-DD' or ''."""
    if not text:
        return ""
    today = today or date.today()
    lowered = text.lower()

    match = re.search(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b", lowered)
    if match:
        found = _valid_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        if found:
            return found.isoformat()

    match = re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b", lowered)
    if match:
        first, second, year = int(match.group(1)), int(match.group(2)), _year(match.group(3))
        month, day = (first, second) if first <= 12 else (second, first)
        found = _valid_date(year, month, day)
        if found:
            return found.isoformat()

    match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(" + MONTH_RE + r")\.?,?\s+(\d{2,4})\b", lowered)
    if match:
        found = _valid_date(_year(match.group(3)), MONTHS[match.group(2)[:3]], int(match.group(1)))
        if found:
            return found.isoformat()

    match = re.search(r"\b(" + MONTH_RE + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\b", lowered)
    if match:
        found = _valid_date(_year(match.group(3)), MONTHS[match.group(1)[:3]], int(match.group(2)))
        if found:
            return found.isoformat()

    match = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b(?![/-]\d)", lowered)
    if match:
        found = _valid_date(today.year, int(match.group(1)), int(match.group(2)))
        if found:
            return found.isoformat()

    if re.search(r"\btoday\b", lowered):
        return today.isoformat()
    return ""


def parse_time(text):
    """Find the first clock time in text. Return 'HH:MM' or ''."""
    if not text:
        return ""
    lowered = text.lower()
    for match in re.finditer(TIME_RE, lowered):
        if match.group("mil"):
            mil = match.group("mil")
            return mil[:2] + ":" + mil[2:]
        hour, minute, ampm = match.group("hh"), match.group("mm"), match.group("ampm")
        if not minute and not ampm:
            continue
        before = lowered[max(0, match.start() - 1):match.start()]
        after = lowered[match.end():match.end() + 1]
        if before in "/-" and before or after in "/-" and after:
            continue
        hour = int(hour)
        if ampm:
            if hour > 12:
                continue
            if ampm.startswith("p") and hour != 12:
                hour += 12
            if ampm.startswith("a") and hour == 12:
                hour = 0
        return "%02d:%s" % (hour, minute or "00")
    return ""


def parse_datetime(text, today=None):
    day = parse_date(text, today)
    if not day:
        return ""
    stripped = re.sub(r"\b\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{2,4})?\b", " ", text)
    clock = parse_time(stripped)
    return day + ("T" + clock if clock else "")


def _parse_gcs(text):
    match = re.search(r"\bgcs\b[^0-9a-z]{0,6}(?:of|score|is|=|:)?\s*(\d{1,2})\s*t?\b", text, re.I)
    if match:
        value = int(match.group(1))
        if 3 <= value <= 15:
            return str(value)
    match = re.search(r"\bE\s*([1-4])\s*V\s*([1-5T])\s*M\s*([1-6])\b", text, re.I)
    if match:
        verbal = 1 if match.group(2).upper() == "T" else int(match.group(2))
        return str(int(match.group(1)) + verbal + int(match.group(3)))
    return ""


def _parse_age_sex(text):
    age, sex = "", ""
    match = re.search(
        r"\b(\d{1,3})\s*(?:y/?o|yo|yrs?\.?(?:\s*old)?|years?(?:\s*old)?|y)?\s*[/,]?\s*"
        r"(m|f|male|female|lalaki|babae)\b",
        text, re.I,
    )
    if match:
        age, sex = match.group(1), match.group(2)
    else:
        match = re.search(r"\b(m|f|male|female)\s*[/,]\s*(\d{1,3})\b", text, re.I)
        if match:
            sex, age = match.group(1), match.group(2)
    if not age:
        match = re.search(r"\b(\d{1,3})\s*(?:y/?o|yo|years?\s*old|yrs?\s*old)\b", text, re.I)
        if match:
            age = match.group(1)
    if not sex:
        match = re.search(r"\b(male|female)\b", text, re.I)
        if match:
            sex = match.group(1)
    return age, _normalize_sex(sex)


def _normalize_sex(value):
    value = (value or "").strip().lower()
    if value in ("m", "male", "lalaki"):
        return "Male"
    if value in ("f", "female", "babae"):
        return "Female"
    return ""


def _normalize_age(value):
    match = re.search(r"\d{1,3}", value or "")
    if not match:
        return ""
    age = int(match.group(0))
    return str(age) if 0 <= age <= 120 else ""


def _yes_no(value):
    value = (value or "").strip().lower()
    if re.match(r"^(yes|y|positive|declared|done|confirmed|intubated|on)\b", value):
        return "Yes"
    if re.match(r"^(no|n|negative|not|none|off)\b", value):
        return "No"
    if re.match(r"^(unknown|unk|pending|for\b)", value):
        return "Unknown"
    return ""


def _brain_death_from_text(text):
    lowered = text.lower()
    not_yet = re.search(
        r"\b(?:not\s+(?:yet\s+)?(?:declared\s+)?brain\s*dead|"
        r"(?:not|never)\s+(?:to\s+)?(?:proceed|push\s+through|do|start)\w*\s+(?:with\s+)?(?:the\s+)?(?:bd|brain\s*death)\b|"
        r"(?:bd|brain\s*death)\s+(?:is\s+)?not\s+yet|deferred?\s+(?:the\s+)?(?:bd|brain\s*death)|"
        r"for\s+(?:brain\s*death|bd)\s*"
        r"(?:evaluation|eval|assessment|testing|declaration|protocol)?|for\s+apnea\s+test|"
        r"(?:possible|suspected|impending|probable|r/o)\s+brain\s*death)\b",
        lowered,
    )
    declared = re.search(
        r"\b(?:declared\s+(?:as\s+)?brain\s*dead|brain\s*death\s+(?:was\s+)?declared|"
        r"declared\s+(?:as\s+)?bd|pronounced\s+brain\s*dead|apnea\s+test\s+(?:was\s+)?positive|"
        r"positive\s+apnea\s+test|is\s+brain\s*dead)\b",
        lowered,
    )
    if declared:
        return "Yes", declared
    if not_yet:
        return "No", None
    return "", None


def _ventilator_from_text(text):
    lowered = text.lower()
    if re.search(r"\b(?:not\s+intubated|extubated|off\s+(?:the\s+)?(?:vent|mv|ventilator))\b", lowered):
        return "No"
    if re.search(
        r"\b(?:intubated|on\s+(?:mv|vent|mechanical\s+vent\w*|ventilator)|mechanically\s+ventilated|"
        r"ett\b|ambu[- ]?bag\w*|hooked\s+to\s+(?:mv|ventilator))",
        lowered,
    ):
        return "Yes"
    return ""


def _hospital_from_text(text):
    lowered = text.lower()
    for key, name in KNOWN_HOSPITALS:
        if re.search(r"\b" + re.escape(key) + r"\b", lowered):
            return name
    match = re.search(
        r"\b([A-Z][\w.&'-]*(?:\s+(?:[A-Z][\w.&'-]*|of|del|de|la))*\s+"
        r"(?:Hospital|Medical\s+Center|Medical\s+Centre|Infirmary|Medical\s+Hospital))\b",
        text,
    )
    return _clean(match.group(1)) if match else ""


def _ward_from_text(text):
    for pattern in WARD_PATTERNS:
        match = re.search(pattern, text, re.I)
        if match:
            return _clean(match.group(0))
    return ""


def _doctor_from_text(text):
    pattern = r"\b(?:Dr|Dra|Doc)\.?\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,4})"
    referred = re.search(r"(?:referred|ref'?d|referral)\s+(?:by|from)\s+" + pattern[2:], text)
    if referred:
        return "Dr. " + _clean(referred.group(1))
    match = re.search(pattern, text)
    return "Dr. " + _clean(match.group(1)) if match else ""


def _clean_name(value):
    """Keep the name part of 'ANA REYES, 62 y/o female, Red Zone'."""
    value = _clean(value)
    parts = re.split(r"\s*(?:,|/|\s-\s|\()\s*", value, maxsplit=1)
    if len(parts) == 2 and re.search(r"\d|\b(?:male|female|m|f)\b", parts[1], re.I):
        value = parts[0]
    value = re.sub(r"\s+\d{1,3}\s*(?:y/?o|yo|yrs?)?\s*(?:m|f|male|female)?$", "", value, flags=re.I)
    return _clean(value)


def _clean_doctor(value):
    value = _clean(value)
    value = re.sub(r"\s*(?:,|\()?\s*(?:prc|lic)\b.*$", "", value, flags=re.I)
    value = PHONE_RE.sub("", value)
    value = EMAIL_RE.sub("", value)
    return _clean(value)


def _prc_from_text(text):
    match = re.search(
        r"\b(?:prc|license|lic)\.?\s*(?:license\s*)?(?:no\.?|number|#)?\s*[:#]?\s*(\d{5,8})\b",
        text, re.I,
    )
    return match.group(1) if match else ""


def _normalize_phone(value):
    match = PHONE_RE.search(value or "")
    if not match:
        return ""
    digits = re.sub(r"\D", "", match.group(0))
    if digits.startswith("63"):
        digits = "0" + digits[2:]
    return digits


HEADING_RE = re.compile(r"^\s*\[?([A-Za-z][A-Za-z /&'().-]{1,60}?)\]?\s*:\s*$")
BLANK_RE = re.compile(r"^\s*$")
DIAGNOSIS_HEADINGS = (
    "current working impression", "working impression", "initial impression", "impression",
    "admitting diagnosis", "working diagnosis", "diagnosis", "assessment",
)
NEURO_HEADINGS = (
    "neuro pe", "neuro exam", "neurologic exam", "neurological exam", "neurologic examination",
    "neurological examination", "neuro",
)
BRAINSTEM_RE = re.compile(
    r"pupil|doll'?s\s*eye|oculocephalic|oculovestibular|caloric|corneal|gag\b|cough\s+reflex|"
    r"spontaneous\s+(?:breath|respiration)|apnea|brainstem|motor\s+response|posturing",
    re.I,
)
IMAGING_RE = re.compile(
    r"^\s*(?:(?:cranial|plain|cranial\s+plain|head)\s+)?(?:ct|mri)\b[^:\n]*?"
    r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})?\s*:?\s*$",
    re.I,
)


def _block_after(lines, index):
    """Lines after lines[index], up to the next blank line or heading."""
    body = []
    for following in lines[index + 1:]:
        if BLANK_RE.match(following) or HEADING_RE.match(following):
            break
        body.append(_clean(following))
    return body


def _section(text, names):
    """Lines under a heading that stands alone ('IMPRESSION:'), up to the next blank line or heading."""
    lines = text.split("\n")
    for index, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if match and _clean(match.group(1)).lower() in names:
            body = _block_after(lines, index)
            if body:
                return body
    return []


def _line_value(text, pattern):
    match = re.search(r"^\s*(?:" + pattern + r")\s*:\s*(.+)$", text, re.I | re.M)
    return _clean(match.group(1)) if match else ""


def _clinical_notes(text):
    """Clinical facts the SHARE coordinator needs that have no column of their own in the sheet."""
    notes = []

    def add(label, value):
        if value:
            notes.append(label + ": " + value)

    add("Chief complaint", _line_value(text, r"chief\s+complaint|cc"))
    add("Last known well", _line_value(text, r"last\s+known\s+well|lkw"))
    nihss = re.findall(r"\bnihss\b\s*[:=]?\s*(\d{1,2})\b", text, re.I)
    if nihss:
        add("NIHSS", nihss[-1])
    ich = re.search(r"\b(?:intracerebral\s+hemorrhage|ich)\s+score\s*[:=]?\s*(\d)\b", text, re.I)
    if ich:
        add("ICH score", ich.group(1))

    neuro = _section(text, NEURO_HEADINGS)
    pool = neuro or text.split("\n")
    brainstem = []
    for line in pool:
        line = _clean(line)
        if (line and len(line) <= 90 and BRAINSTEM_RE.search(line)
                and not re.match(r"^(?:no|denies)\b", line, re.I) and line not in brainstem):
            brainstem.append(line)
    add("Brainstem", "; ".join(brainstem))

    add("Vital signs", " | ".join(_section(text, ("vital signs", "vitals", "vs"))[:2]))

    lines = text.split("\n")
    for index, line in enumerate(lines):
        match = IMAGING_RE.match(line)
        body = _block_after(lines, index) if match else []
        if body:
            add("CT " + match.group(1) if match.group(1) else "CT", "; ".join(body))
            break

    remarks = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n", text):
        sentence = _clean(sentence)
        if (re.search(r"\b(?:bd|brain\s*death|brain\s*dead|apnea\s+test)\b", sentence, re.I)
                and not re.search(r"\brefer", sentence, re.I) and len(sentence) <= 240
                and not LABEL_RE.match(sentence) and sentence.rstrip(".") not in brainstem):
            remarks.append(sentence.rstrip(".") + ".")
    add("Brain death remark", " ".join(remarks[:3]))

    return "\n".join(notes)[:1990]


def parse_referral(text, today=None):
    """Read a free-text referral. Return fields, found, missing and notes."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    fields = {name: "" for name in FIELDS}
    labelled = _labelled_values(text)
    warnings = []

    fields["patient_name"] = _clean_name(labelled.get("patient_name", ""))
    fields["hrn"] = labelled.get("hrn", "")

    age, sex = "", ""
    if labelled.get("age_sex"):
        age, sex = _parse_age_sex(labelled["age_sex"])
    if labelled.get("age"):
        age = _normalize_age(labelled["age"]) or age
    if labelled.get("sex"):
        sex = _normalize_sex(labelled["sex"].split()[0] if labelled["sex"].split() else "") or sex
    if not age or not sex:
        free_age, free_sex = _parse_age_sex(text)
        age = age or free_age
        sex = sex or free_sex
    fields["age"] = _normalize_age(age)
    if age and not fields["age"]:
        warnings.append("Age '%s' looks wrong and was left blank." % age)
    fields["sex"] = sex

    fields["hospital"] = labelled.get("hospital") or _hospital_from_text(text)
    fields["ward"] = labelled.get("ward") or _ward_from_text(text)

    admission = labelled.get("admission_date", "")
    fields["admission_date"] = parse_date(admission, today) if admission else ""
    if not fields["admission_date"]:
        match = re.search(r"\badmitted\b[^\n]{0,40}", text, re.I)
        if match:
            fields["admission_date"] = parse_date(match.group(0), today)

    gcs_label = labelled.get("gcs", "")
    fields["gcs"] = _parse_gcs("GCS " + gcs_label) if gcs_label else ""
    fields["gcs"] = fields["gcs"] or _parse_gcs(text)

    fields["diagnosis"] = labelled.get("diagnosis", "")
    if not fields["diagnosis"]:
        fields["diagnosis"] = "; ".join(_section(text, DIAGNOSIS_HEADINGS))[:2000]

    bd_label = labelled.get("brain_death", "")
    fields["brain_death"] = _yes_no(bd_label) if bd_label else ""
    declared_match = None
    if not fields["brain_death"]:
        fields["brain_death"], declared_match = _brain_death_from_text(text)

    bd_time = labelled.get("brain_death_datetime", "")
    fields["brain_death_datetime"] = parse_datetime(bd_time, today) if bd_time else ""
    if not fields["brain_death_datetime"] and declared_match:
        window = text[declared_match.end():declared_match.end() + 60]
        fields["brain_death_datetime"] = parse_datetime(window, today)
    if fields["brain_death_datetime"] and not fields["brain_death"]:
        fields["brain_death"] = "Yes"

    vent = labelled.get("ventilator", "")
    fields["ventilator"] = _yes_no(vent) if vent else ""
    if not fields["ventilator"] and vent:
        fields["ventilator"] = _ventilator_from_text(vent)
    fields["ventilator"] = fields["ventilator"] or _ventilator_from_text(text)

    doctor = labelled.get("doctor_name", "")
    fields["doctor_name"] = _clean_doctor(doctor) if doctor else _doctor_from_text(text)

    prc = labelled.get("prc", "")
    fields["prc"] = re.sub(r"\D", "", prc)[:8] if prc else _prc_from_text(text)

    email_match = EMAIL_RE.search(labelled.get("doctor_email", "")) or EMAIL_RE.search(text)
    fields["doctor_email"] = email_match.group(0).lower() if email_match else ""

    fields["contact_number"] = _normalize_phone(labelled.get("contact_number", "")) or _normalize_phone(text)
    clinical = _clinical_notes(text)
    fields["notes"] = "\n".join(part for part in (labelled.get("notes", ""), clinical) if part)[:2000]

    found = [name for name in FIELDS if fields[name]]
    missing = [name for name in REQUIRED if not fields[name]]
    return {
        "fields": fields,
        "found": found,
        "missing": missing,
        "warnings": warnings,
        "reader": "offline-python",
    }


def parse_referral_json(text):
    return json.dumps(parse_referral(text))


if __name__ == "__main__" and __import__("sys").platform != "emscripten":
    import sys

    print(json.dumps(parse_referral(sys.stdin.read()), indent=2))
