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
