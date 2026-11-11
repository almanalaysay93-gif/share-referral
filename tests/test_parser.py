import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "py"))

from referral_parser import parse_date, parse_datetime, parse_referral, parse_time  # noqa: E402

TODAY = date(2026, 11, 6)

LABELLED = """Good evening SHARE team, referral po:
Name: Juan Dela Cruz
HRN: 2026-123456
Age/Sex: 45/M
Hospital: Davao Doctors Hospital
Ward: ICU 3
Date of admission: 11/02/2026
GCS: 3T (E1VTM1)
Dx: Acute CVD Bleed, Left Thalamoganglionic Region, Hypertensive
Brain death declared: Yes
Date/time of brain death: 11/05/2026 3:40 PM
Intubated, on MV
Referred by: Dr. Maria Santos
PRC: 0123456
Email: msantos@example.com
Contact: 0917 123 4567
"""

MESSENGER = """Referral from SPMC Adult Neuro (Green Service)
Pt: ANA REYES, 62 y/o female, Red Zone (Plans: ER CIU)
Admitted 05 Nov 2026
Actual Diagnosis: Acute CVD Bleed, Pontine Region (~17 mL), Hypertensive Etiology; NIHSS 32, ICH Score 3
GCS 3, apnea test positive, declared brain dead on Nov 6, 2026 at 0215H
on mechanical ventilator
Dr. Jose Rizal Lim / 09181234567
"""

NOT_YET = """Pt name: Pedro Cruz
45 yo M, CIU
For brain death evaluation tomorrow, GCS E1V1M1
Ref by Dra. Liza Tan, VSMMC
"""


class ParseDateTests(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(parse_date("11/02/2026", TODAY), "2026-11-02")
        self.assertEqual(parse_date("2026-03-19", TODAY), "2026-03-19")
        self.assertEqual(parse_date("19 Mar 2026", TODAY), "2026-03-19")
        self.assertEqual(parse_date("March 19, 2026", TODAY), "2026-03-19")
        self.assertEqual(parse_date("25/10/2026", TODAY), "2026-10-25")
        self.assertEqual(parse_date("today", TODAY), "2026-11-06")
        self.assertEqual(parse_date("no date here", TODAY), "")

    def test_times(self):
        self.assertEqual(parse_time("3:40 PM"), "15:40")
        self.assertEqual(parse_time("12:05 am"), "00:05")
        self.assertEqual(parse_time("0215H"), "02:15")
        self.assertEqual(parse_time("at 11:11"), "11:11")
        self.assertEqual(parse_datetime("07 Apr 2026 11:11", TODAY), "2026-04-07T11:11")
        self.assertEqual(parse_datetime("11/05/2026 3:40 PM", TODAY), "2026-11-05T15:40")


class LabelledReferralTests(unittest.TestCase):
    def setUp(self):
        self.result = parse_referral(LABELLED, TODAY)
        self.f = self.result["fields"]

    def test_patient(self):
        self.assertEqual(self.f["patient_name"], "Juan Dela Cruz")
        self.assertEqual(self.f["hrn"], "2026-123456")
        self.assertEqual(self.f["age"], "45")
        self.assertEqual(self.f["sex"], "Male")
        self.assertEqual(self.f["hospital"], "Davao Doctors Hospital")
        self.assertEqual(self.f["ward"], "ICU 3")
        self.assertEqual(self.f["admission_date"], "2026-11-02")

    def test_clinical(self):
        self.assertEqual(self.f["gcs"], "3")
        self.assertTrue(self.f["diagnosis"].startswith("Acute CVD Bleed"))
        self.assertEqual(self.f["brain_death"], "Yes")
        self.assertEqual(self.f["brain_death_datetime"], "2026-11-05T15:40")
        self.assertEqual(self.f["ventilator"], "Yes")

    def test_referrer(self):
        self.assertEqual(self.f["doctor_name"], "Dr. Maria Santos")
        self.assertEqual(self.f["prc"], "0123456")
        self.assertEqual(self.f["doctor_email"], "msantos@example.com")
        self.assertEqual(self.f["contact_number"], "09171234567")
        self.assertEqual(self.result["missing"], [])


class MessengerReferralTests(unittest.TestCase):
    def setUp(self):
        self.f = parse_referral(MESSENGER, TODAY)["fields"]

    def test_free_text(self):
        self.assertEqual(self.f["patient_name"], "ANA REYES")
        self.assertEqual(self.f["age"], "62")
        self.assertEqual(self.f["sex"], "Female")
        self.assertEqual(self.f["hospital"], "Southern Philippines Medical Center")
        self.assertTrue(self.f["ward"].lower().startswith("red zone"))
        self.assertEqual(self.f["admission_date"], "2026-11-05")
        self.assertEqual(self.f["gcs"], "3")
        self.assertTrue(self.f["diagnosis"].startswith("Acute CVD Bleed, Pontine"))
        self.assertEqual(self.f["brain_death"], "Yes")
        self.assertEqual(self.f["brain_death_datetime"], "2026-11-06T02:15")
        self.assertEqual(self.f["ventilator"], "Yes")
        self.assertEqual(self.f["doctor_name"], "Dr. Jose Rizal Lim")
        self.assertEqual(self.f["contact_number"], "09181234567")


class NotYetDeclaredTests(unittest.TestCase):
    def test_not_declared(self):
        f = parse_referral(NOT_YET, TODAY)["fields"]
        self.assertEqual(f["patient_name"], "Pedro Cruz")
        self.assertEqual(f["age"], "45")
        self.assertEqual(f["sex"], "Male")
        self.assertEqual(f["ward"], "CIU")
        self.assertEqual(f["brain_death"], "No")
        self.assertEqual(f["gcs"], "3")
        self.assertEqual(f["doctor_name"], "Dr. Liza Tan")
        self.assertEqual(f["hospital"], "Vicente Sotto Memorial Medical Center")


class EdgeTests(unittest.TestCase):
    def test_empty(self):
        result = parse_referral("", TODAY)
        self.assertEqual(result["found"], [])
        self.assertEqual(result["missing"], ["patient_name", "hospital", "doctor_name"])

    def test_bad_age_and_gcs(self):
        f = parse_referral("Age: 250\nGCS: 22", TODAY)["fields"]
        self.assertEqual(f["age"], "")
        self.assertEqual(f["gcs"], "")

    def test_phone_with_country_code(self):
        f = parse_referral("Contact: +63 917 765 4321", TODAY)["fields"]
        self.assertEqual(f["contact_number"], "09177654321")


class NameAndHrnTests(unittest.TestCase):
    """Patient name and HRN in the shapes doctors type them, with and without 'Label:'."""

    CASES = [
        ("NAME: SANTOS, PEDRO (HRN 123456)\nAGE/SEX: 57/M", "SANTOS, PEDRO", "123456"),
        ("HRN 2026-004512\nPatient: Mr. Juan Dela Cruz", "Juan Dela Cruz", "2026-004512"),
        ("Pt: ANA REYES, 62 y/o F, HRN# 00123456", "ANA REYES", "00123456"),
        ("Referring patient DELA CRUZ, JUAN M., 45/M, Hosp no. 1234567, ICU", "DELA CRUZ, JUAN M.", "1234567"),
        ("Hosp # 2026-1234 / Name - Maria Clara", "Maria Clara", "2026-1234"),
        ("Respectfully referring:\nREYES, ANA B.\n62/F\nHRN: 778899", "REYES, ANA B.", "778899"),
        ("Mr. Pedro Santos, 57 years old male, admitted 11/2/26", "Pedro Santos", ""),
        ("Pt Name Juan Cruz\nHRN 445566", "Juan Cruz", "445566"),
        ("Referring Juan Dela Cruz, 45 y/o male, from SPMC", "Juan Dela Cruz", ""),
        ("Patient's name is Juan Cruz. Hospital number is 2026-555.", "Juan Cruz", "2026-555"),
        ("HRN: 2026-123456 (old chart)", "", "2026-123456"),
    ]

    def test_cases(self):
        for text, name, hrn in self.CASES:
            with self.subTest(text=text):
                f = parse_referral(text, TODAY)["fields"]
                self.assertEqual((f["patient_name"], f["hrn"]), (name, hrn))

    def test_greeting_and_ward_lines_are_not_names(self):
        for text in ("Hi team\n57/M, CIU", "Good evening doctors, 45/M for BD eval", "Davao Doctors Hospital\n45/M"):
            with self.subTest(text=text):
                self.assertEqual(parse_referral(text, TODAY)["fields"]["patient_name"], "")

    def test_prc_is_not_hrn(self):
        self.assertEqual(parse_referral("Dr. Ana Lim, PRC no. 0123456", TODAY)["fields"]["hrn"], "")


if __name__ == "__main__":
    unittest.main()


LONG = (Path(__file__).resolve().parent / "fixtures" / "long_ich_referral.txt").read_text(encoding="utf-8")


class LongClinicalReferralTests(unittest.TestCase):
    """De-identified copy of a real SPMC neurology referral with section headings."""

    def setUp(self):
        self.f = parse_referral(LONG, TODAY)["fields"]

    def test_identity(self):
        self.assertEqual(self.f["patient_name"], "SANTOS, PEDRO")
        self.assertEqual((self.f["age"], self.f["sex"]), ("57", "Male"))
        self.assertEqual(self.f["ward"], "ER RED ZONE")
        self.assertEqual(self.f["gcs"], "3")
        self.assertEqual(self.f["ventilator"], "Yes")

    def test_diagnosis_from_impression_block(self):
        dx = self.f["diagnosis"]
        self.assertTrue(dx.startswith("ACUTE CEREBROVASCULAR DISEASE BLEED"), dx)
        self.assertIn("DIABETES MELLITUS TYPE II", dx)
        self.assertNotIn("CHIEF COMPLAINT", dx)

    def test_admission_from_er_arrival(self):
        self.assertEqual(self.f["admission_date"], "2026-11-02")

    def test_bd_not_yet(self):
        self.assertEqual(self.f["brain_death"], "No")
        self.assertEqual(self.f["brain_death_datetime"], "")

    def test_clinical_notes(self):
        notes = self.f["notes"]
        for part in (
            "Chief complaint: RIGHT HEMIPLEGIA AND DECREASED SENSORIUM",
            "Last known well: 11/2/26 7AM",
            "NIHSS: 35",
            "ICH score: 4",
            "Fixed dilated pupils",
            "(-) corneal reflex, bilateral",
            "(+) spontaneous breathing",
            "BP: 180/110",
            "CT 11/2/26: ACUTE BLEED (144 CC)",
            "UNCAL HERNIATION",
            "will not proceed with BD yet since given with diazepam max dose",
        ):
            self.assertIn(part, notes)
        self.assertNotIn("No memory deficits", notes)
        self.assertNotIn("Mannitol", notes)
        self.assertLessEqual(len(notes), 2000)

    def test_short_referrals_keep_empty_notes(self):
        self.assertEqual(parse_referral(LABELLED, TODAY)["fields"]["notes"], "")


class UpdateTermsTests(unittest.TestCase):
    def test_expired_with_time(self):
        f = parse_referral("Update on SHR-ABC123: patient expired 11/08/2026 9:30 AM. Family opted for DNR.", TODAY)["fields"]
        self.assertEqual(f["expired"], "Yes")
        self.assertEqual(f["expired_datetime"], "2026-11-08T09:30")
        self.assertEqual(f["dnr"], "Yes")

    def test_time_of_death(self):
        f = parse_referral("Pronounced dead, time of death 0215H 11/09/2026", TODAY)["fields"]
        self.assertEqual(f["expired"], "Yes")

    def test_brain_dead_is_not_expired(self):
        f = parse_referral("Declared brain dead 11/05/2026 3:40 PM", TODAY)["fields"]
        self.assertEqual(f["expired"], "")
        self.assertEqual(f["dnr"], "")

    def test_not_dnr(self):
        f = parse_referral("Family not for DNR, full code", TODAY)["fields"]
        self.assertEqual(f["dnr"], "No")


import io as _io
import zipfile as _zipfile

from referral_parser import extract_text  # noqa: E402

W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def _docx(body_xml):
    buf = _io.BytesIO()
    with _zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", '<w:document %s><w:body>%s</w:body></w:document>' % (W_NS, body_xml))
    return buf.getvalue()


def _p(text):
    return "<w:p><w:r><w:t xml:space=\"preserve\">%s</w:t></w:r></w:p>" % text


def _row(*cells):
    return "<w:tr>%s</w:tr>" % "".join("<w:tc>%s</w:tc>" % _p(c) for c in cells)


def _xlsx(rows):
    strings = []
    sheet_rows = []
    for r, row in enumerate(rows, 1):
        cells = []
        for c, value in enumerate(row):
            ref = "ABCDEFGH"[c] + str(r)
            if isinstance(value, (int, float)):
                cells.append('<c r="%s"><v>%s</v></c>' % (ref, value))
            else:
                strings.append(value)
                cells.append('<c r="%s" t="s"><v>%d</v></c>' % (ref, len(strings) - 1))
        sheet_rows.append('<row r="%d">%s</row>' % (r, "".join(cells)))
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = _io.BytesIO()
    with _zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", "<sst %s>%s</sst>" % (ns, "".join("<si><t>%s</t></si>" % s for s in strings)))
        z.writestr("xl/worksheets/sheet1.xml", "<worksheet %s><sheetData>%s</sheetData></worksheet>" % (ns, "".join(sheet_rows)))
    return buf.getvalue()


class FileExtractTests(unittest.TestCase):
    def test_docx_paragraphs_and_label_table(self):
        raw = _docx(_p("Respectfully referring patient:") + "<w:tbl>" + _row("NAME", "SANTOS, PEDRO")
                    + _row("AGE/SEX", "57/M") + _row("LOCATION", "ER RED ZONE") + "</w:tbl>" + _p("GCS 3, intubated on MV"))
        text = extract_text("referral.docx", raw)
        self.assertIn("NAME: SANTOS, PEDRO", text)
        f = parse_referral(text, TODAY)["fields"]
        self.assertEqual(f["patient_name"], "SANTOS, PEDRO")
        self.assertEqual((f["age"], f["sex"], f["ward"], f["gcs"], f["ventilator"]), ("57", "Male", "ER RED ZONE", "3", "Yes"))

    def test_xlsx_label_column_layout(self):
        raw = _xlsx([["Patient name", "Juan Dela Cruz"], ["Age", 45], ["Hospital", "Davao Doctors Hospital"], ["GCS", 3]])
        f = parse_referral(extract_text("referral.xlsx", raw), TODAY)["fields"]
        self.assertEqual((f["patient_name"], f["age"], f["hospital"], f["gcs"]), ("Juan Dela Cruz", "45", "Davao Doctors Hospital", "3"))

    def test_xlsx_header_row_layout(self):
        raw = _xlsx([["Patient name", "Age/Sex", "Hospital", "Referred by"],
                     ["Ana Reyes", "62/F", "San Pedro Hospital", "Dr. Jose Lim"]])
        f = parse_referral(extract_text("log.xlsx", raw), TODAY)["fields"]
        self.assertEqual((f["patient_name"], f["age"], f["sex"], f["hospital"], f["doctor_name"]),
                         ("Ana Reyes", "62", "Female", "San Pedro Hospital", "Dr. Jose Lim"))

    def test_csv_and_text(self):
        f = parse_referral(extract_text("r.csv", "Name,Pedro Cruz\nWard,CIU\n".encode("utf-8-sig")), TODAY)["fields"]
        self.assertEqual((f["patient_name"], f["ward"]), ("Pedro Cruz", "CIU"))
        self.assertEqual(extract_text("r.txt", "GCS 3".encode()), "GCS 3")

    def test_unsupported_formats(self):
        for name in ("old.doc", "old.xls", "scan.pdf"):
            with self.assertRaises(ValueError):
                extract_text(name, b"xxxx")
        with self.assertRaises(ValueError):
            extract_text("broken.docx", b"not a zip")
