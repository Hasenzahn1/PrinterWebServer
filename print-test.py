#!/usr/bin/env python3
import cups, os, time, sys

FILENAME = "test.png"  # ggf. anpassen

def pick_printer(conn: cups.Connection) -> str:
    default = conn.getDefault()
    if default:
        return default
    printers = conn.getPrinters()
    if not printers:
        raise RuntimeError("Keine Drucker bei CUPS gefunden. Bitte einen Drucker einrichten.")
    # nimm den ersten verfügbaren
    return sorted(printers.keys())[0]

def main():
    if not os.path.exists(FILENAME):
        print(f"Datei '{FILENAME}' nicht gefunden. Lege sie neben dieses Script oder passe den Pfad an.")
        sys.exit(1)

    conn = cups.Connection()
    printer = pick_printer(conn)
    print(f"Verwende Drucker: {printer}")

    # sinnvolle Standard-Optionen (je nach Druckermodell anpassbar)
    options = {
        "fit-to-page": "True",
        "media": "A4",
        # "print-quality": "5",   # 3=Draft, 4=Normal, 5=High (wenn unterstützt)
        # "ColorModel": "RGB",    # oder "CMYK"/"Gray" je nach Treiber
    }

    # Datei an CUPS schicken
    job_id = conn.printFile(printer, FILENAME, "pycups Testdruck", options)
    print(f"Job gestartet. Job-ID: {job_id}")

    # Einfache Status-Abfrage bis Abschluss/Fehler
    STATE_NAMES = {
        3: "PENDING",
        4: "HELD",
        5: "PROCESSING",
        6: "STOPPED",
        7: "CANCELED",
        8: "ABORTED",
        9: "COMPLETED",
    }

    timeout_s = 120  # 2 Minuten warten
    start = time.time()
    last_state = None

    while True:
        try:
            attrs = conn.getJobAttributes(job_id)
            state = attrs.get("job-state", 0)
            if state != last_state:
                print(f"Status: {STATE_NAMES.get(state, str(state))}")
                last_state = state
            if state in (7, 8, 9):  # beendet (canceled/aborted/completed)
                break
        except cups.IPPError as e:
            print(f"Fehler bei Statusabfrage: {e}")
            break

        if time.time() - start > timeout_s:
            print("Zeitüberschreitung beim Warten auf den Druckjob.")
            break
        time.sleep(1)

    if last_state == 9:
        print("✅ Druck abgeschlossen.")
    elif last_state in (7, 8):
        print("❌ Druck fehlgeschlagen oder abgebrochen.")
    else:
        print("ℹ️ Unklarer Endstatus. Prüfe die CUPS-Weboberfläche.")

if __name__ == "__main__":
    main()
